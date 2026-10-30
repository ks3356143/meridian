package testitems

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"chenmeridian/internal/id"
	"chenmeridian/internal/modules/contentblocks"
)

var (
	// ErrNotFound 目标不存在。
	ErrNotFound = errors.New("目标不存在")
	// ErrNameRequired 名称必填。
	ErrNameRequired = errors.New("名称不能为空")
	// ErrTypeNotFound 类型不存在或未启用。
	ErrTypeNotFound = errors.New("测试项类型不存在或未启用")
	// ErrTypePlatformMismatch 类型不适用于当前项目平台。
	ErrTypePlatformMismatch = errors.New("当前项目平台不适用该测试项类型")
	// ErrStaticNoRequirementLink 静态测试项不建立需求关联。
	ErrStaticNoRequirementLink = errors.New("静态测试项不建立需求关联")
	// ErrStaticTypeExists 同一轮次已存在该类型静态测试项。
	ErrStaticTypeExists = errors.New("同一轮次只能创建一个该类型静态测试项")
	// ErrImplicitWithRequirement 已关联需求的测试项不能标记为隐含需求（互斥）。
	ErrImplicitWithRequirement = errors.New("已关联需求，不能标记为隐含需求")
	// ErrSwitchToStaticWithLinks 已关联需求的测试项不能改为静态类型（静态项不建立需求关联）。
	ErrSwitchToStaticWithLinks = errors.New("已关联需求，不能改为静态测试项，请先解除关联")
	// ErrStaticTypeLocked 静态测试项（DC/SA/CR/CW）的类型不可修改。
	ErrStaticTypeLocked = errors.New("静态测试项的类型不可修改")
	// ErrStaticTypeDuplicate 静态测试项不允许复制新增（同类静态每轮只能建一个）。
	ErrStaticTypeDuplicate = errors.New("静态测试项不支持复制新增，请用「新增测试项」按类型创建")
	// ErrStaticAfterFirstRound 静态测试项只存在于第 1 轮。
	ErrStaticAfterFirstRound = errors.New("静态测试项只能存在于第 1 轮，不能出现在第二轮及以后轮次")
	// ErrRequirementIncomplete 需求描述待补全，暂不能建立关联。
	ErrRequirementIncomplete = errors.New("需求描述待补全，暂不能关联")
	// ErrRequirementNotOfficial 只有已确认需求可以建立测试项关联。
	ErrRequirementNotOfficial = errors.New("只有已确认需求可以关联测试项")
	// ErrProjectNotFound 项目不存在。
	ErrProjectNotFound = errors.New("项目不存在")
	// ErrFolderMismatch 目标文件夹与测试项类型不一致。
	ErrFolderMismatch = errors.New("目标文件夹与测试项类型不一致")
	// ErrSuffixExhausted 名称拼音前缀相同的测试项过多，后缀自动生成空间用尽（3 位前缀 + 36 种尾字符）。
	ErrSuffixExhausted = errors.New("名称前缀相同的测试项过多，标识自动生成失败，请手工指定标识后缀")
	// ErrImportAcrossProjects 跨用例复制步骤只允许在同一项目内。
	ErrImportAcrossProjects = errors.New("只能在同一项目内的用例之间复制步骤")
	// ErrRequirementSelectionRequired 批量创建必须指定需求。
	ErrRequirementSelectionRequired = errors.New("请选择需求")
)

// FindProjectID 按项目标识（RXXXXX）解析项目 id。
func (s *Service) FindProjectID(ctx context.Context, projectCode string) (string, error) {
	var project struct {
		ID string `gorm:"column:id"`
	}
	if err := s.db.WithContext(ctx).Table("projects").Select("id").
		Where("code = ?", strings.ToUpper(strings.TrimSpace(projectCode))).
		Scan(&project).Error; err != nil {
		return "", fmt.Errorf("查询项目失败: %w", err)
	}
	if project.ID == "" {
		return "", ErrProjectNotFound
	}
	return project.ID, nil
}

// Service 测试项与执行领域服务。
type Service struct {
	db *gorm.DB
	// blocks 内容块服务（用例步骤富文本，切片 5b）；未接线时步骤块退化为空视图。
	blocks *contentblocks.Service
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

// WithBlocks 接线内容块服务（步骤「输入及操作 / 实测结果」富文本）。
func (s *Service) WithBlocks(blocks *contentblocks.Service) *Service {
	s.blocks = blocks
	return s
}

func timeNow() time.Time { return time.Now() }

// itemTypePlatforms 项目平台枚举（projects.platform）到类型字典平台口径的映射。
var itemTypePlatforms = map[string]string{
	"CPU/非嵌": "cpu",
	"FPGA":   "fpga",
}

func typeFitsPlatform(typeScope string, projectPlatform string) bool {
	if typeScope == "" || typeScope == "all" {
		return true
	}
	return itemTypePlatforms[projectPlatform] == typeScope
}

func projectPlatform(tx *gorm.DB, projectID string) (string, error) {
	var platform string
	if err := tx.Table("projects").Select("platform").Where("id = ?", projectID).
		Scan(&platform).Error; err != nil {
		return "", fmt.Errorf("查询项目平台失败: %w", err)
	}
	if platform == "" {
		return "", ErrNotFound
	}
	return platform, nil
}

func findItemType(tx *gorm.DB, code string) (ItemType, error) {
	var itemType ItemType
	err := tx.Where("code = ? AND is_enabled = 1", strings.ToUpper(strings.TrimSpace(code))).
		First(&itemType).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ItemType{}, ErrTypeNotFound
	}
	if err != nil {
		return ItemType{}, fmt.Errorf("查询测试项类型失败: %w", err)
	}
	return itemType, nil
}

// ListTypes 返回按输出顺序排列的启用类型字典。
func (s *Service) ListTypes(ctx context.Context) ([]ItemType, error) {
	var items []ItemType
	if err := s.db.WithContext(ctx).Where("is_enabled = 1").
		Order("output_order asc").Find(&items).Error; err != nil {
		return nil, fmt.Errorf("查询测试项类型失败: %w", err)
	}
	return items, nil
}

func findTestItem(tx *gorm.DB, testItemID string) (TestItem, error) {
	var item TestItem
	err := tx.Where("id = ?", testItemID).First(&item).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return TestItem{}, ErrNotFound
	}
	if err != nil {
		return TestItem{}, fmt.Errorf("查询测试项失败: %w", err)
	}
	return item, nil
}

// EnsureRound 保证项目存在第 1 轮：新建项目在创建事务内调用，历史项目在进入测试项页时懒补齐。
func (s *Service) EnsureRound(ctx context.Context, projectID string) (Round, error) {
	return ensureRound(ctx, s.db, projectID)
}

// EnsureFirstRound 供项目创建事务调用（历史项目懒补齐走 Service.EnsureRound）。
func EnsureFirstRound(ctx context.Context, tx *gorm.DB, projectID string) error {
	_, err := ensureRound(ctx, tx, projectID)
	return err
}

func ensureRound(ctx context.Context, db *gorm.DB, projectID string) (Round, error) {
	db = db.Session(&gorm.Session{NewDB: true}).WithContext(ctx)

	var existing Round
	err := db.Table("test_rounds").Where("project_id = ? AND round_number = 1", projectID).First(&existing).Error
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return Round{}, fmt.Errorf("查询轮次失败: %w", err)
	}

	roundID, err := id.New()
	if err != nil {
		return Round{}, err
	}
	now := time.Now()
	round := Round{
		ID:          roundID,
		ProjectID:   projectID,
		RoundNumber: 1,
		Name:        "第 1 轮",
		RoundType:   "initial",
		Status:      "draft",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := db.Session(&gorm.Session{NewDB: true}).Create(&round).Error; err != nil {
		// 并发下可能已被另一个请求创建，重新读取。
		var retry Round
		if readErr := db.Table("test_rounds").Where("project_id = ? AND round_number = 1", projectID).First(&retry).Error; readErr == nil {
			return retry, nil
		}
		return Round{}, fmt.Errorf("创建第 1 轮失败: %w", err)
	}
	return round, nil
}

// CreateTestItemInput 新建测试项入参。
type CreateTestItemInput struct {
	ProjectID    string
	RoundID      string // 留空时使用当前轮次
	TypeCode     string
	Name         string
	Suffix       string // 留空时按名称自动生成
	Priority     string
	FolderID     *string
	Description  string
	Adequacy     string
	PassCriteria string
	// RequirementID 非空时按该需求创建测试项并建立关联；类型和名称留空时使用需求默认值。
	RequirementID string
	// CreateAnother 为 true 时跳过同类型同名称幂等复用，强制创建一条新的关联测试项。
	CreateAnother bool
	// ImplicitRequirement 隐含需求标记（不关联需求时按已满足追踪关系计）。
	ImplicitRequirement bool
}

// CreateTestItem 新建测试项；标识后缀留空时按名称拼音首字母自动生成，套话按类型预填。
func (s *Service) CreateTestItem(ctx context.Context, input CreateTestItemInput) (TestItem, error) {
	var created TestItem
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		round, err := resolveRound(ctx, tx, input.ProjectID, input.RoundID)
		if err != nil {
			return err
		}
		input.RoundID = round.ID
		if input.RequirementID != "" {
			requirement, err := loadRequirementForLink(tx, input.ProjectID, input.RequirementID)
			if err != nil {
				return err
			}
			if strings.TrimSpace(input.TypeCode) == "" {
				input.TypeCode = requirementTestItemType(requirement.PrimaryKind)
			}
			if strings.TrimSpace(input.Name) == "" {
				input.Name = requirement.Name
			}
			if input.ImplicitRequirement {
				return ErrImplicitWithRequirement
			}
		}

		name := strings.TrimSpace(input.Name)
		if name == "" {
			return ErrNameRequired
		}

		itemType, err := findItemType(tx, input.TypeCode)
		if err != nil {
			return err
		}
		if itemType.IsStatic && input.RequirementID != "" {
			return ErrStaticNoRequirementLink
		}
		platform, err := projectPlatform(tx, input.ProjectID)
		if err != nil {
			return err
		}
		if !typeFitsPlatform(itemType.PlatformScope, platform) {
			return ErrTypePlatformMismatch
		}
		if input.FolderID != nil {
			var folder Folder
			if err := tx.Where("id = ? AND project_id = ? AND round_id = ? AND type_code = ?",
				*input.FolderID, input.ProjectID, input.RoundID, itemType.Code).First(&folder).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return ErrFolderMismatch
				}
				return fmt.Errorf("查询目标文件夹失败: %w", err)
			}
		}
		if itemType.IsStatic && round.RoundNumber > 1 {
			return ErrStaticAfterFirstRound
		}
		// 每个轮次内 DC/SA/CR/CW 各只允许一个静态测试项。
		if itemType.IsStatic {
			var existing int64
			if err := tx.Model(&TestItem{}).
				Where("project_id = ? AND round_id = ? AND type_code = ?", input.ProjectID, input.RoundID, itemType.Code).
				Count(&existing).Error; err != nil {
				return fmt.Errorf("查询静态测试项失败: %w", err)
			}
			if existing > 0 {
				return ErrStaticTypeExists
			}
		}

		// 一键创建按「同需求 + 同类型 + 同名称」幂等；用户确认“再建一个”时跳过复用。
		if input.RequirementID != "" && !input.CreateAnother {
			var existing TestItem
			err := tx.Table("test_items AS item").
				Select("item.*").
				Joins("JOIN requirement_test_items AS link ON link.test_item_id = item.id").
				Where("link.requirement_id = ? AND item.project_id = ? AND item.round_id = ? AND item.type_code = ? AND item.name = ?",
					input.RequirementID, input.ProjectID, input.RoundID, itemType.Code, name).
				Take(&existing).Error
			if err == nil {
				created = existing
				return markRequirementTestItemCompletedTx(tx, input.ProjectID, input.RequirementID)
			}
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("查询已关联测试项失败: %w", err)
			}
		}

		suffix := strings.ToUpper(strings.TrimSpace(input.Suffix))
		if suffix == "" {
			generated, _, err := uniqueItemSuffix(tx, input.ProjectID, input.RoundID, itemType.Code, name)
			if err != nil {
				return err
			}
			suffix = generated
		} else {
			free, err := itemSuffixFree(tx, input.ProjectID, input.RoundID, itemType.Code, suffix)
			if err != nil {
				return err
			}
			if !free {
				return fmt.Errorf("标识后缀 %s 已被占用", suffix)
			}
		}

		priority := strings.TrimSpace(input.Priority)
		if priority == "" {
			priority = "中"
		}
		adequacy := strings.TrimSpace(input.Adequacy)
		if adequacy == "" {
			adequacy = itemType.DefaultAdequacy
		}
		passCriteria := strings.TrimSpace(input.PassCriteria)
		if passCriteria == "" {
			passCriteria = itemType.DefaultPassCriteria
		}

		sortOrder, err := nextItemSortOrder(tx, input.ProjectID, input.RoundID, itemType.Code, input.FolderID)
		if err != nil {
			return err
		}

		itemID, err := id.New()
		if err != nil {
			return err
		}
		now := time.Now()
		created = TestItem{
			ID:           itemID,
			ProjectID:    input.ProjectID,
			RoundID:      input.RoundID,
			TypeCode:     itemType.Code,
			Identifier:   testItemIdentifier(itemType.Code, suffix),
			Suffix:       suffix,
			Name:         name,
			Priority:     priority,
			FolderID:     input.FolderID,
			SortOrder:    sortOrder,
			Description:  defaultItemDescription(itemType, input.Description),
			Adequacy:     adequacy,
			PassCriteria: passCriteria,

			ImplicitRequirement: input.ImplicitRequirement,
			CreatedAt:           now,
			UpdatedAt:           now,
		}
		if err := tx.Create(&created).Error; err != nil {
			return fmt.Errorf("创建测试项失败: %w", err)
		}

		// 静态测试项自动带 1 条壳用例（老项目口径）。
		if itemType.IsStatic {
			if _, err := createCase(tx, created, "用例", ""); err != nil {
				return err
			}
		}
		// 类型带默认测试方法时（静态四类），同步种入 1 条默认子项，详情页开箱即用。
		if method := defaultTestMethod(itemType, platform); method != "" {
			if err := createDefaultMethodSubItem(tx, created, itemType, method, now); err != nil {
				return err
			}
		}
		if input.RequirementID != "" {
			return createRequirementLinkTx(tx, input.ProjectID, input.RequirementID, created.ID)
		}
		return nil
	})
	if err != nil {
		return TestItem{}, err
	}
	return created, nil
}

func requirementTestItemType(primaryKind string) string {
	switch strings.TrimSpace(primaryKind) {
	case "interface":
		return "IO"
	case "performance":
		return "AC"
	case "safety":
		return "SE"
	case "reliability":
		return "KK"
	default:
		return "SU"
	}
}

func nextItemSortOrder(tx *gorm.DB, projectID, roundID, typeCode string, folderID *string) (int, error) {
	query := tx.Model(&TestItem{}).Where("project_id = ? AND round_id = ? AND type_code = ?", projectID, roundID, typeCode)
	if folderID == nil {
		query = query.Where("folder_id IS NULL")
	} else {
		query = query.Where("folder_id = ?", *folderID)
	}
	var maxOrder *int
	if err := query.Select("MAX(sort_order)").Scan(&maxOrder).Error; err != nil {
		return 0, fmt.Errorf("查询排序失败: %w", err)
	}
	if maxOrder == nil {
		return 0, nil
	}
	return *maxOrder + 1, nil
}

// UpdateTestItemInput 行内更新入参；nil 字段表示不修改。
type UpdateTestItemInput struct {
	// TypeCode 修改测试项类型：标识、用例编号、树分组与未改动的套话随之更新。
	TypeCode     *string
	Name         *string
	Suffix       *string
	Priority     *string
	FolderID     *string
	ClearFolder  bool
	Description  *string
	Adequacy     *string
	PassCriteria *string
	// ImplicitRequirement 隐含需求标记。
	ImplicitRequirement *bool
}

// UpdateTestItem 行内更新测试项字段；改后缀会同步重排用例标识。
func (s *Service) UpdateTestItem(ctx context.Context, testItemID string, input UpdateTestItemInput) (TestItem, error) {
	var updated TestItem
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		item, err := findTestItem(tx, testItemID)
		if err != nil {
			return err
		}

		updates := map[string]any{"updated_at": timeNow()}
		if input.Name != nil {
			name := strings.TrimSpace(*input.Name)
			if name == "" {
				return ErrNameRequired
			}
			updates["name"] = name
		}
		if input.TypeCode != nil {
			typeCode := strings.TrimSpace(*input.TypeCode)
			if typeCode != "" && typeCode != item.TypeCode {
				// 静态四类（DC/SA/CR/CW）每轮各一个固定槽位，类型锁定不可改。
				if oldType, err := findItemType(tx, item.TypeCode); err == nil && oldType.IsStatic {
					return ErrStaticTypeLocked
				}
				newType, err := findItemType(tx, typeCode)
				if err != nil {
					return err
				}
				platform, err := projectPlatform(tx, item.ProjectID)
				if err != nil {
					return err
				}
				if !typeFitsPlatform(newType.PlatformScope, platform) {
					return ErrTypePlatformMismatch
				}
				if newType.IsStatic && item.RoundID != "" {
					var round Round
					if err := tx.Where("id = ? AND project_id = ?", item.RoundID, item.ProjectID).First(&round).Error; err != nil {
						return fmt.Errorf("查询测试项轮次失败: %w", err)
					}
					if round.RoundNumber > 1 {
						return ErrStaticAfterFirstRound
					}
				}
				if newType.IsStatic {
					var siblings int64
					if err := tx.Model(&TestItem{}).
						Where("project_id = ? AND round_id = ? AND type_code = ? AND id <> ?", item.ProjectID, item.RoundID, newType.Code, item.ID).
						Count(&siblings).Error; err != nil {
						return fmt.Errorf("查询同类型静态测试项失败: %w", err)
					}
					if siblings > 0 {
						return ErrStaticTypeExists
					}
					var links int64
					if err := tx.Model(&RequirementLink{}).
						Where("test_item_id = ?", item.ID).
						Count(&links).Error; err != nil {
						return fmt.Errorf("查询需求关联失败: %w", err)
					}
					if links > 0 {
						return ErrSwitchToStaticWithLinks
					}
					updates["implicit_requirement"] = false
				}

				// 后缀沿用；被新类型占用时按名称重新生成
				suffix := item.Suffix
				free, err := itemSuffixFree(tx, item.ProjectID, item.RoundID, newType.Code, suffix)
				if err != nil {
					return err
				}
				if !free {
					generated, _, err := uniqueItemSuffix(tx, item.ProjectID, item.RoundID, newType.Code, item.Name)
					if err != nil {
						return err
					}
					suffix = generated
				}
				updates["type_code"] = newType.Code
				updates["suffix"] = suffix
				updates["identifier"] = testItemIdentifier(newType.Code, suffix)

				// 文件夹按类型归属：跨类型后旧文件夹不再匹配，自动移出保证树上可见。
				if item.FolderID != nil {
					var folder Folder
					if err := tx.First(&folder, "id = ?", *item.FolderID).Error; err == nil && folder.TypeCode != newType.Code {
						updates["folder_id"] = nil
					}
				}

				// 套话没被用户改过时，跟随新类型
				if oldType, err := findItemType(tx, item.TypeCode); err == nil {
					if strings.TrimSpace(item.Adequacy) == strings.TrimSpace(oldType.DefaultAdequacy) {
						updates["adequacy"] = newType.DefaultAdequacy
					}
					if strings.TrimSpace(item.PassCriteria) == strings.TrimSpace(oldType.DefaultPassCriteria) {
						updates["pass_criteria"] = newType.DefaultPassCriteria
					}
				}
			}
		}
		if input.Suffix != nil {
			suffix := strings.ToUpper(strings.TrimSpace(*input.Suffix))
			if suffix == "" {
				return ErrNameRequired
			}
			if suffix != item.Suffix {
				free, err := itemSuffixFree(tx, item.ProjectID, item.RoundID, item.TypeCode, suffix)
				if err != nil {
					return err
				}
				if !free {
					return fmt.Errorf("标识后缀 %s 已被占用", suffix)
				}
				updates["suffix"] = suffix
				updates["identifier"] = testItemIdentifier(item.TypeCode, suffix)
			}
		}
		if input.Priority != nil {
			updates["priority"] = strings.TrimSpace(*input.Priority)
		}
		if input.ClearFolder {
			updates["folder_id"] = nil
		} else if input.FolderID != nil {
			folderType := item.TypeCode
			if updatedType, ok := updates["type_code"].(string); ok {
				folderType = updatedType
			}
			var folder Folder
			if err := tx.Where("id = ? AND project_id = ? AND round_id = ? AND type_code = ?",
				*input.FolderID, item.ProjectID, item.RoundID, folderType).First(&folder).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return ErrFolderMismatch
				}
				return fmt.Errorf("查询目标文件夹失败: %w", err)
			}
			updates["folder_id"] = *input.FolderID
		}
		if input.Description != nil {
			updates["description"] = strings.TrimSpace(*input.Description)
		}
		if input.Adequacy != nil {
			updates["adequacy"] = strings.TrimSpace(*input.Adequacy)
		}
		if input.PassCriteria != nil {
			updates["pass_criteria"] = strings.TrimSpace(*input.PassCriteria)
		}
		if input.ImplicitRequirement != nil {
			if *input.ImplicitRequirement {
				// 隐含需求 = 没有可关联的需求：已有关联时拒绝（与前端按钮禁用同源）。
				var linkCount int64
				if err := tx.Model(&RequirementLink{}).
					Where("test_item_id = ?", testItemID).
					Count(&linkCount).Error; err != nil {
					return fmt.Errorf("查询需求关联失败: %w", err)
				}
				if linkCount > 0 {
					return ErrImplicitWithRequirement
				}
			}
			updates["implicit_requirement"] = *input.ImplicitRequirement
		}

		if err := tx.Model(&TestItem{}).Where("id = ?", testItemID).Updates(updates).Error; err != nil {
			return fmt.Errorf("更新测试项失败: %w", err)
		}
		if _, changed := updates["suffix"]; changed {
			if err := renumberCases(tx, testItemID); err != nil {
				return err
			}
		}
		updated, err = findTestItem(tx, testItemID)
		return err
	})
	if err != nil {
		return TestItem{}, err
	}
	return updated, nil
}

// DeleteTestItem 删除测试项（用例/子项/步骤随外键级联删除），并清理其全部内容块。
func (s *Service) DeleteTestItem(ctx context.Context, testItemID string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var item TestItem
		if err := tx.Where("id = ?", testItemID).First(&item).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrNotFound
			}
			return fmt.Errorf("查询测试项失败: %w", err)
		}
		if err := deleteTestItemTreeBlocksTx(tx, item.ID); err != nil {
			return err
		}
		result := tx.Where("id = ?", testItemID).Delete(&TestItem{})
		if result.Error != nil {
			return fmt.Errorf("删除测试项失败: %w", result.Error)
		}
		if result.RowsAffected == 0 {
			return ErrNotFound
		}
		return nil
	})
}

// deleteTestItemTreeBlocksTx 删除测试项自身、子项及用例树上的内容块。
// content_blocks 是 owner_type + owner_id 的多态表，无法用单列外键级联。
func deleteTestItemTreeBlocksTx(tx *gorm.DB, testItemID string) error {
	var cases []Case
	if err := tx.Where("test_item_id = ?", testItemID).Find(&cases).Error; err != nil {
		return fmt.Errorf("查询测试项用例失败: %w", err)
	}
	for _, itemCase := range cases {
		if err := contentblocks.DeleteOwnerBlocksTx(tx, contentblocks.OwnerTypeTestCase, itemCase.ID); err != nil {
			return err
		}
	}
	return contentblocks.DeleteOwnerBlocksTx(tx, contentblocks.OwnerTypeTestItem, testItemID)
}

// ListTestItems 返回项目内测试项（跨轮查询；兼容既有调用）。
func (s *Service) ListTestItems(ctx context.Context, projectID string) ([]TestItem, error) {
	return s.listTestItems(ctx, projectID, "")
}

// ListTestItemsByRound 返回指定轮次内的测试项（按类型、容器内排序）。
func (s *Service) ListTestItemsByRound(ctx context.Context, projectID, roundID string) ([]TestItem, error) {
	return s.listTestItems(ctx, projectID, roundID)
}

func (s *Service) listTestItems(ctx context.Context, projectID, roundID string) ([]TestItem, error) {
	query := s.db.WithContext(ctx).Where("project_id = ?", projectID)
	if roundID != "" {
		query = query.Where("round_id = ?", roundID)
	}
	var items []TestItem
	if err := query.Order("type_code asc, sort_order asc, created_at asc").Find(&items).Error; err != nil {
		return nil, fmt.Errorf("查询测试项失败: %w", err)
	}
	return items, nil
}

// ItemCounts 树徽章用的每项子级计数。
type ItemCounts struct {
	SubItemCount     int `json:"subItemCount"`
	RequirementCount int `json:"requirementCount"`
	// IncompleteSubItemCount：操作步骤或通过准则为空的子项数（测试方法完善度、树徽章"未完善"共用）。
	IncompleteSubItemCount int `json:"incompleteSubItemCount"`
	// 静态工作台进度（DC/CR 已审 / 总数；CW 文件数）。
	StaticReviewed  int `json:"staticReviewed,omitempty"`
	StaticTotal     int `json:"staticTotal,omitempty"`
	StaticFileCount int `json:"staticFileCount,omitempty"`
	// SubItemNames：子项名称（树搜索按子项名匹配用）。
	SubItemNames []string `json:"subItemNames"`
}

// CountItemChildren 按测试项统计子项数与关联需求数（跨轮查询；兼容既有调用）。
func (s *Service) CountItemChildren(ctx context.Context, projectID string) (map[string]ItemCounts, error) {
	return s.countItemChildren(ctx, projectID, "")
}

// CountItemChildrenByRound 按指定轮次统计树徽章数据。
func (s *Service) CountItemChildrenByRound(ctx context.Context, projectID, roundID string) (map[string]ItemCounts, error) {
	return s.countItemChildren(ctx, projectID, roundID)
}

func (s *Service) countItemChildren(ctx context.Context, projectID, roundID string) (map[string]ItemCounts, error) {
	counts := map[string]ItemCounts{}

	var subRows []struct {
		TestItemID string
		Total      int
		Incomplete int
	}
	subQuery := s.db.WithContext(ctx).Table("test_sub_items AS sub").
		Select(`sub.test_item_id AS test_item_id, COUNT(*) AS total,
			SUM(CASE WHEN TRIM(COALESCE(sub.ops, ''), ' ' || char(9) || char(10) || char(13)) = ''
				OR TRIM(COALESCE(sub.expected, ''), ' ' || char(9) || char(10) || char(13)) = ''
				THEN 1 ELSE 0 END) AS incomplete`).
		Joins("JOIN test_items AS item ON item.id = sub.test_item_id").
		Where("item.project_id = ?", projectID)
	if roundID != "" {
		subQuery = subQuery.Where("item.round_id = ?", roundID)
	}
	if err := subQuery.Group("sub.test_item_id").Scan(&subRows).Error; err != nil {
		return nil, fmt.Errorf("统计测试子项失败: %w", err)
	}
	for _, row := range subRows {
		counts[row.TestItemID] = ItemCounts{
			SubItemCount:           row.Total,
			IncompleteSubItemCount: row.Incomplete,
		}
	}

	var linkRows []struct {
		TestItemID string
		Total      int
	}
	linkQuery := s.db.WithContext(ctx).Table("requirement_test_items AS link").
		Select("link.test_item_id AS test_item_id, COUNT(*) AS total").
		Where("link.project_id = ?", projectID)
	if roundID != "" {
		linkQuery = linkQuery.Joins("JOIN test_items AS item ON item.id = link.test_item_id").
			Where("item.round_id = ?", roundID)
	}
	if err := linkQuery.Group("link.test_item_id").Scan(&linkRows).Error; err != nil {
		return nil, fmt.Errorf("统计关联需求失败: %w", err)
	}
	for _, row := range linkRows {
		entry := counts[row.TestItemID]
		entry.RequirementCount = row.Total
		counts[row.TestItemID] = entry
	}

	// 子项名称（树搜索按子项名匹配；按子项排序输出，供工作台一次下发）。
	var nameRows []struct {
		TestItemID string
		Name       string
	}
	nameQuery := s.db.WithContext(ctx).Table("test_sub_items AS sub").
		Select("sub.test_item_id AS test_item_id, sub.name AS name").
		Joins("JOIN test_items AS item ON item.id = sub.test_item_id").
		Where("item.project_id = ?", projectID)
	if roundID != "" {
		nameQuery = nameQuery.Where("item.round_id = ?", roundID)
	}
	if err := nameQuery.Order("sub.test_item_id, sub.sort_order, sub.seq").Scan(&nameRows).Error; err != nil {
		return nil, fmt.Errorf("读取测试子项名称失败: %w", err)
	}
	for _, row := range nameRows {
		entry := counts[row.TestItemID]
		entry.SubItemNames = append(entry.SubItemNames, row.Name)
		counts[row.TestItemID] = entry
	}

	var staticRows []staticWorkbenchRow
	staticQuery := s.db.WithContext(ctx).Where("project_id = ?", projectID)
	if roundID != "" {
		staticQuery = staticQuery.Where("test_item_id IN (SELECT id FROM test_items WHERE project_id = ? AND round_id = ?)", projectID, roundID)
	}
	if err := staticQuery.Find(&staticRows).Error; err != nil {
		return nil, fmt.Errorf("统计静态测试进度失败: %w", err)
	}
	for _, row := range staticRows {
		var state StaticState
		if err := json.Unmarshal([]byte(row.Payload), &state); err != nil {
			continue
		}
		entry := counts[row.TestItemID]
		switch row.Kind {
		case "DC":
			for _, sheet := range state.ReviewSheets {
				entry.StaticTotal += len(sheet.Checks)
				for _, check := range sheet.Checks {
					if check.Result != "" && check.Result != "unreviewed" {
						entry.StaticReviewed++
					}
				}
			}
		case "CR":
			for _, target := range state.ReviewTargets {
				entry.StaticTotal += len(target.Checks)
				for _, check := range target.Checks {
					if check.Result != "" && check.Result != "unreviewed" {
						entry.StaticReviewed++
					}
				}
			}
		case "CW":
			entry.StaticFileCount = len(state.CodeFiles)
		}
		counts[row.TestItemID] = entry
	}

	return counts, nil
}

// GetTestItem 按 id 返回测试项。
func (s *Service) GetTestItem(ctx context.Context, testItemID string) (TestItem, error) {
	return findTestItem(s.db.WithContext(ctx), testItemID)
}

// defaultItemDescription 测试项描述缺省时回落到类型默认描述（如文档审查）。
func defaultItemDescription(itemType ItemType, input string) string {
	if text := strings.TrimSpace(input); text != "" {
		return text
	}
	return strings.TrimSpace(itemType.DefaultDescription)
}

// defaultTestMethod 取类型默认测试方法（FPGA 项目优先用 FPGA 变体）。
func defaultTestMethod(itemType ItemType, platform string) string {
	if platform == "FPGA" && strings.TrimSpace(itemType.DefaultTestMethodFPGA) != "" {
		return strings.TrimSpace(itemType.DefaultTestMethodFPGA)
	}
	return strings.TrimSpace(itemType.DefaultTestMethod)
}

func createDefaultMethodSubItem(tx *gorm.DB, item TestItem, itemType ItemType, method string, now time.Time) error {
	subID, err := id.New()
	if err != nil {
		return err
	}
	// 默认子项口径（迁移 0024）：名称默认"<类型名>方法"，类型给了 default_sub_item_name 时用类型名；
	// 测试方法文案写进"操作步骤"，通过准则取 default_expected。
	name := strings.TrimSpace(itemType.DefaultSubItemName)
	if name == "" {
		name = itemType.Name + "方法"
	}
	sub := SubItem{
		ID:          subID,
		TestItemID:  item.ID,
		Seq:         1,
		Name:        name,
		Description: strings.TrimSpace(itemType.DefaultSubItemDesc),
		Ops:         method,
		Expected:    strings.TrimSpace(itemType.DefaultExpected),
		SortOrder:   0,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := tx.Create(&sub).Error; err != nil {
		return fmt.Errorf("创建默认测试方法子项失败: %w", err)
	}
	return nil
}

// EnsureStaticItemDefaults 为历史静态测试项懒补齐默认测试方法子项（幂等；已被用户改动过的不覆盖）。
func (s *Service) EnsureStaticItemDefaults(ctx context.Context, projectID string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		firstRound, err := ensureRound(ctx, tx, projectID)
		if err != nil {
			return err
		}
		var types []ItemType
		if err := tx.Where("is_static = 1 AND (default_test_method <> '' OR default_test_method_fpga <> '')").
			Find(&types).Error; err != nil {
			return fmt.Errorf("查询静态类型默认方法失败: %w", err)
		}
		if len(types) == 0 {
			return nil
		}
		platform, err := projectPlatform(tx, projectID)
		if err != nil {
			return err
		}
		now := time.Now()
		for _, itemType := range types {
			method := defaultTestMethod(itemType, platform)
			if method == "" {
				continue
			}
			var items []TestItem
			if err := tx.Where("project_id = ? AND round_id = ? AND type_code = ?", projectID, firstRound.ID, itemType.Code).
				Find(&items).Error; err != nil {
				return fmt.Errorf("查询静态测试项失败: %w", err)
			}
			for _, item := range items {
				var existing int64
				if err := tx.Model(&SubItem{}).Where("test_item_id = ?", item.ID).
					Count(&existing).Error; err != nil {
					return fmt.Errorf("查询子项失败: %w", err)
				}
				if existing > 0 {
					continue
				}
				if err := createDefaultMethodSubItem(tx, item, itemType, method, now); err != nil {
					return err
				}
			}
		}
		return nil
	})
}
