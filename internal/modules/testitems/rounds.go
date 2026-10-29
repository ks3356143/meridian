package testitems

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"

	"chenmeridian/internal/id"
	"chenmeridian/internal/modules/contentblocks"
)

var (
	// ErrRoundNotFound 轮次不存在或不属于当前项目。
	ErrRoundNotFound = errors.New("轮次不存在")
	// ErrRoundMismatch 目标对象不属于当前轮次，禁止跨轮写入。
	ErrRoundMismatch = errors.New("目标对象不属于当前轮次")
	// ErrRoundCopyItemOutsideSource 客户端提交了不属于来源轮次的测试项。
	ErrRoundCopyItemOutsideSource = errors.New("所选测试项不属于来源轮次")
	// ErrRoundCopyStaticForbidden 静态测试项不能带入第二轮及以后轮次。
	ErrRoundCopyStaticForbidden = errors.New("静态测试项不能带入第二轮及以后轮次")
	// ErrRoundCopyItemIDRequired 选择的测试项 id 不能为空。
	ErrRoundCopyItemIDRequired = errors.New("测试项 id 不能为空")
	// ErrRoundCopyFolderMissing 来源测试项的文件夹链不完整。
	ErrRoundCopyFolderMissing = errors.New("来源测试项的文件夹链不完整")
	// ErrRoundCopySourceNotPrevious 只能从紧邻上一轮复制。
	ErrRoundCopySourceNotPrevious = errors.New("来源轮次不是紧邻上一轮")
)

// RoundCopyCandidate 是轮次复制向导中的一个测试项候选。
type RoundCopyCandidate struct {
	TestItemID      string `json:"testItemId"`
	Identifier      string `json:"identifier"`
	Name            string `json:"name"`
	TypeCode        string `json:"typeCode"`
	TypeName        string `json:"typeName"`
	DefaultSelected bool   `json:"defaultSelected"`
	PassedCount     int    `json:"passedCount"`
	FailedCount     int    `json:"failedCount"`
}

// RoundCopyPreview 是来源轮可带入测试项的预览。
type RoundCopyPreview struct {
	SourceRound Round                `json:"sourceRound"`
	TestItems   []RoundCopyCandidate `json:"testItems"`
}

// CreateRoundCopyInput 新建后续轮并复制选定测试项树的入参。
type CreateRoundCopyInput struct {
	ProjectID     string
	SourceRoundID string
	TestItemIDs   []string
	Name          string
	DutVersion    string
	StartedOn     *string
	EndedOn       *string
	ChangeReason  string
	ReasonSummary string
}

// RoundCopyResult 是轮次复制结果摘要。
type RoundCopyResult struct {
	Round                Round `json:"round"`
	FolderCount          int   `json:"folderCount"`
	TestItemCount        int   `json:"testItemCount"`
	SubItemCount         int   `json:"subItemCount"`
	CaseCount            int   `json:"caseCount"`
	StepCount            int   `json:"stepCount"`
	RequirementLinkCount int   `json:"requirementLinkCount"`
	OpBlockCount         int   `json:"opBlockCount"`
}

// ResolveRound 解析当前轮次：有 roundId 时严格校验；没有时取最新未关闭轮次，全部关闭则取最新轮次。
func (s *Service) ResolveRound(ctx context.Context, projectID, roundID string) (Round, error) {
	return resolveRound(ctx, s.db, projectID, roundID)
}

func resolveRound(ctx context.Context, db *gorm.DB, projectID, roundID string) (Round, error) {
	roundID = strings.TrimSpace(roundID)
	if roundID != "" {
		var round Round
		err := db.WithContext(ctx).Where("id = ? AND project_id = ?", roundID, projectID).First(&round).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return Round{}, ErrRoundNotFound
		}
		if err != nil {
			return Round{}, fmt.Errorf("查询轮次失败: %w", err)
		}
		return round, nil
	}

	var round Round
	err := db.WithContext(ctx).Where("project_id = ? AND status <> ?", projectID, "closed").
		Order("round_number desc").First(&round).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		err = db.WithContext(ctx).Where("project_id = ?", projectID).
			Order("round_number desc").First(&round).Error
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ensureRound(ctx, db, projectID)
	}
	if err != nil {
		return Round{}, fmt.Errorf("查询当前轮次失败: %w", err)
	}
	return round, nil
}

// sourceRoundMustBePrevious 返回下一个轮次号，并校验来源轮是当前最新轮次。
func sourceRoundMustBePrevious(tx *gorm.DB, projectID string, source Round) (int, error) {
	var maxNumber *int
	if err := tx.Model(&Round{}).Where("project_id = ?", projectID).
		Select("MAX(round_number)").Scan(&maxNumber).Error; err != nil {
		return 0, fmt.Errorf("查询轮次编号失败: %w", err)
	}
	if maxNumber == nil {
		return 0, ErrRoundNotFound
	}
	if source.RoundNumber != *maxNumber {
		return 0, fmt.Errorf("%w：只能从第 %d 轮复制", ErrRoundCopySourceNotPrevious, *maxNumber)
	}
	return *maxNumber + 1, nil
}

type roundCopyPreviewRow struct {
	TestItemID  string `gorm:"column:test_item_id"`
	Identifier  string `gorm:"column:identifier"`
	Name        string `gorm:"column:name"`
	TypeCode    string `gorm:"column:type_code"`
	TypeName    string `gorm:"column:type_name"`
	PassedCount int    `gorm:"column:passed_count"`
	FailedCount int    `gorm:"column:failed_count"`
}

// PreviewRoundCopy 返回来源轮中可带入后续轮次的动态测试项。
func (s *Service) PreviewRoundCopy(ctx context.Context, projectID, sourceRoundID string) (RoundCopyPreview, error) {
	var sourceRound Round
	err := s.db.WithContext(ctx).
		Where("id = ? AND project_id = ?", strings.TrimSpace(sourceRoundID), projectID).
		First(&sourceRound).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return RoundCopyPreview{}, ErrRoundNotFound
	}
	if err != nil {
		return RoundCopyPreview{}, fmt.Errorf("查询来源轮次失败: %w", err)
	}
	if _, err := sourceRoundMustBePrevious(s.db.WithContext(ctx), projectID, sourceRound); err != nil {
		return RoundCopyPreview{}, err
	}

	var rows []roundCopyPreviewRow
	if err := s.db.WithContext(ctx).Table("test_items AS item").
		Select(`item.id AS test_item_id, item.identifier, item.name, item.type_code, typ.name AS type_name,
			COALESCE(SUM(CASE WHEN c.status = 'passed' THEN 1 ELSE 0 END), 0) AS passed_count,
			COALESCE(SUM(CASE WHEN c.status = 'failed' THEN 1 ELSE 0 END), 0) AS failed_count`).
		Joins("JOIN test_item_types AS typ ON typ.code = item.type_code").
		Joins("LEFT JOIN test_cases AS c ON c.test_item_id = item.id").
		Where("item.project_id = ? AND item.round_id = ? AND typ.is_static = 0", projectID, sourceRound.ID).
		Group("item.id, item.identifier, item.name, item.type_code, typ.name, typ.output_order, item.sort_order, item.created_at").
		Order("typ.output_order asc, item.type_code asc, item.sort_order asc, item.created_at asc").
		Scan(&rows).Error; err != nil {
		return RoundCopyPreview{}, fmt.Errorf("查询轮次复制候选失败: %w", err)
	}

	candidates := make([]RoundCopyCandidate, 0, len(rows))
	for _, row := range rows {
		candidates = append(candidates, RoundCopyCandidate{
			TestItemID:      row.TestItemID,
			Identifier:      row.Identifier,
			Name:            row.Name,
			TypeCode:        row.TypeCode,
			TypeName:        row.TypeName,
			DefaultSelected: row.FailedCount > 0,
			PassedCount:     row.PassedCount,
			FailedCount:     row.FailedCount,
		})
	}
	return RoundCopyPreview{SourceRound: sourceRound, TestItems: candidates}, nil
}

// CreateRoundCopy 在单事务内新建后续轮并复制选中的动态测试项树。
func (s *Service) CreateRoundCopy(ctx context.Context, input CreateRoundCopyInput) (RoundCopyResult, error) {
	itemIDs, err := normalizeRoundItemIDs(input.TestItemIDs)
	if err != nil {
		return RoundCopyResult{}, err
	}

	var result RoundCopyResult
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var sourceRound Round
		if err := tx.Where("id = ? AND project_id = ?", strings.TrimSpace(input.SourceRoundID), input.ProjectID).
			First(&sourceRound).Error; errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrRoundNotFound
		} else if err != nil {
			return fmt.Errorf("查询来源轮次失败: %w", err)
		}
		nextNumber, err := sourceRoundMustBePrevious(tx, input.ProjectID, sourceRound)
		if err != nil {
			return err
		}

		var sourceItems []TestItem
		if err := tx.Where("project_id = ? AND round_id = ?", input.ProjectID, sourceRound.ID).
			Find(&sourceItems).Error; err != nil {
			return fmt.Errorf("查询来源测试项失败: %w", err)
		}
		sourceByID := make(map[string]TestItem, len(sourceItems))
		for _, item := range sourceItems {
			sourceByID[item.ID] = item
		}

		selected := make([]TestItem, 0, len(itemIDs))
		types := make(map[string]ItemType)
		for _, itemID := range itemIDs {
			item, ok := sourceByID[itemID]
			if !ok {
				return fmt.Errorf("%w：%s", ErrRoundCopyItemOutsideSource, itemID)
			}
			itemType, ok := types[item.TypeCode]
			if !ok {
				if err := tx.Where("code = ?", item.TypeCode).First(&itemType).Error; errors.Is(err, gorm.ErrRecordNotFound) {
					return ErrTypeNotFound
				} else if err != nil {
					return fmt.Errorf("查询测试项类型失败: %w", err)
				}
				types[item.TypeCode] = itemType
			}
			if itemType.IsStatic {
				return fmt.Errorf("%w：%s（%s）", ErrRoundCopyStaticForbidden, item.Name, item.Identifier)
			}
			selected = append(selected, item)
		}
		sort.SliceStable(selected, func(i, j int) bool {
			left, right := types[selected[i].TypeCode], types[selected[j].TypeCode]
			if left.OutputOrder != right.OutputOrder {
				return left.OutputOrder < right.OutputOrder
			}
			if selected[i].TypeCode != selected[j].TypeCode {
				return selected[i].TypeCode < selected[j].TypeCode
			}
			if selected[i].SortOrder != selected[j].SortOrder {
				return selected[i].SortOrder < selected[j].SortOrder
			}
			return selected[i].CreatedAt.Before(selected[j].CreatedAt)
		})

		roundID, err := id.New()
		if err != nil {
			return err
		}
		now := time.Now()
		name := strings.TrimSpace(input.Name)
		if name == "" {
			name = fmt.Sprintf("第 %d 轮", nextNumber)
		}
		sourceID := sourceRound.ID
		createdRound := Round{
			ID:            roundID,
			ProjectID:     input.ProjectID,
			RoundNumber:   nextNumber,
			Name:          name,
			RoundType:     "regression",
			Status:        "draft",
			StartedOn:     input.StartedOn,
			EndedOn:       input.EndedOn,
			DutVersion:    strings.TrimSpace(input.DutVersion),
			ChangeReason:  strings.TrimSpace(input.ChangeReason),
			ReasonSummary: strings.TrimSpace(input.ReasonSummary),
			SourceRoundID: &sourceID,
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		if err := tx.Create(&createdRound).Error; err != nil {
			return fmt.Errorf("创建轮次失败: %w", err)
		}

		var sourceFolders []Folder
		if err := tx.Where("project_id = ? AND round_id = ?", input.ProjectID, sourceRound.ID).
			Find(&sourceFolders).Error; err != nil {
			return fmt.Errorf("查询来源文件夹失败: %w", err)
		}
		folderByID := make(map[string]Folder, len(sourceFolders))
		for _, folder := range sourceFolders {
			folderByID[folder.ID] = folder
		}
		newFolderIDs := make(map[string]string)
		visitingFolders := make(map[string]bool)
		var copyFolder func(string) (string, error)
		copyFolder = func(folderID string) (string, error) {
			if copied, ok := newFolderIDs[folderID]; ok {
				return copied, nil
			}
			if visitingFolders[folderID] {
				return "", fmt.Errorf("%w：文件夹存在循环引用", ErrRoundCopyFolderMissing)
			}
			sourceFolder, ok := folderByID[folderID]
			if !ok {
				return "", fmt.Errorf("%w：%s", ErrRoundCopyFolderMissing, folderID)
			}
			visitingFolders[folderID] = true
			newFolderID, err := id.New()
			if err != nil {
				return "", err
			}
			var newParentID *string
			if sourceFolder.ParentID != nil {
				parentID, err := copyFolder(*sourceFolder.ParentID)
				if err != nil {
					return "", err
				}
				newParentID = &parentID
			}
			copied := sourceFolder
			copied.ID = newFolderID
			copied.RoundID = createdRound.ID
			copied.ParentID = newParentID
			copied.CreatedAt = now
			copied.UpdatedAt = now
			if err := tx.Create(&copied).Error; err != nil {
				return "", fmt.Errorf("复制测试项文件夹失败: %w", err)
			}
			newFolderIDs[folderID] = newFolderID
			delete(visitingFolders, folderID)
			result.FolderCount++
			return newFolderID, nil
		}
		for _, item := range selected {
			if item.FolderID != nil {
				if _, err := copyFolder(*item.FolderID); err != nil {
					return err
				}
			}
		}

		newItemIDs := make(map[string]string, len(selected))
		for _, item := range selected {
			newItemID, err := id.New()
			if err != nil {
				return err
			}
			var folderID *string
			if item.FolderID != nil {
				copiedFolderID, ok := newFolderIDs[*item.FolderID]
				if !ok {
					return fmt.Errorf("%w：%s", ErrRoundCopyFolderMissing, *item.FolderID)
				}
				folderID = &copiedFolderID
			}
			copied := item
			copied.ID = newItemID
			copied.RoundID = createdRound.ID
			copied.FolderID = folderID
			copied.CreatedAt = now
			copied.UpdatedAt = now
			if err := tx.Create(&copied).Error; err != nil {
				return fmt.Errorf("复制测试项失败: %w", err)
			}
			newItemIDs[item.ID] = newItemID
			result.TestItemCount++
		}

		for _, item := range selected {
			newItemID := newItemIDs[item.ID]
			var subItems []SubItem
			if err := tx.Where("test_item_id = ?", item.ID).
				Order("sort_order asc, created_at asc").Find(&subItems).Error; err != nil {
				return fmt.Errorf("查询来源测试子项失败: %w", err)
			}
			for _, subItem := range subItems {
				newSubItemID, err := id.New()
				if err != nil {
					return err
				}
				copied := subItem
				copied.ID = newSubItemID
				copied.TestItemID = newItemID
				copied.CreatedAt = now
				copied.UpdatedAt = now
				if err := tx.Create(&copied).Error; err != nil {
					return fmt.Errorf("复制测试子项失败: %w", err)
				}
				if err := contentblocks.CopyPrefixedOwnerBlocksTx(
					tx,
					contentblocks.OwnerTypeTestItem,
					item.ID,
					contentblocks.SubItemBlockPrefix(subItem.ID),
					contentblocks.OwnerTypeTestItem,
					newItemID,
					contentblocks.SubItemBlockPrefix(newSubItemID),
				); err != nil {
					return err
				}
				result.SubItemCount++
			}

			var links []RequirementLink
			if err := tx.Where("test_item_id = ?", item.ID).Find(&links).Error; err != nil {
				return fmt.Errorf("查询来源需求关联失败: %w", err)
			}
			for _, link := range links {
				linkID, err := id.New()
				if err != nil {
					return err
				}
				link.ID = linkID
				link.TestItemID = newItemID
				link.CreatedAt = now
				if err := tx.Create(&link).Error; err != nil {
					return fmt.Errorf("复制需求关联失败: %w", err)
				}
				result.RequirementLinkCount++
			}

			var cases []Case
			if err := tx.Where("test_item_id = ?", item.ID).
				Order("sort_order asc, created_at asc").Find(&cases).Error; err != nil {
				return fmt.Errorf("查询来源用例失败: %w", err)
			}
			for _, sourceCase := range cases {
				newCaseID, err := id.New()
				if err != nil {
					return err
				}
				copiedCase := sourceCase
				copiedCase.ID = newCaseID
				copiedCase.TestItemID = newItemID
				copiedCase.TesterID = nil
				copiedCase.MonitorID = nil
				copiedCase.ExecDate = nil
				copiedCase.Status = "pending"
				copiedCase.Notes = ""
				copiedCase.NotExecutedReason = ""
				copiedCase.CreatedAt = now
				copiedCase.UpdatedAt = now
				if err := tx.Create(&copiedCase).Error; err != nil {
					return fmt.Errorf("复制用例失败: %w", err)
				}
				result.CaseCount++

				var steps []CaseStep
				if err := tx.Where("test_case_id = ?", sourceCase.ID).
					Order("sort_order asc, created_at asc").Find(&steps).Error; err != nil {
					return fmt.Errorf("查询来源用例步骤失败: %w", err)
				}
				for _, sourceStep := range steps {
					newStepID, err := id.New()
					if err != nil {
						return err
					}
					copiedStep := sourceStep
					copiedStep.ID = newStepID
					copiedStep.TestCaseID = newCaseID
					copiedStep.Passed = "none"
					copiedStep.CreatedAt = now
					copiedStep.UpdatedAt = now
					if err := tx.Create(&copiedStep).Error; err != nil {
						return fmt.Errorf("复制用例步骤失败: %w", err)
					}
					if err := contentblocks.CopyStepBlockTx(tx, sourceStep.ID, newCaseID, newStepID, contentblocks.StepKindOp); err != nil {
						return err
					}
					result.StepCount++
				}
			}
		}

		if len(newItemIDs) > 0 {
			caseIDs := make([]string, 0)
			for _, newItemID := range newItemIDs {
				var copiedCases []Case
				if err := tx.Where("test_item_id = ?", newItemID).Find(&copiedCases).Error; err != nil {
					return fmt.Errorf("统计复制用例失败: %w", err)
				}
				for _, copiedCase := range copiedCases {
					caseIDs = append(caseIDs, copiedCase.ID)
				}
			}
			if len(caseIDs) > 0 {
				var opCount int64
				if err := tx.Model(&contentblocks.ContentBlock{}).
					Where("owner_type = ? AND owner_id IN ? AND block_key LIKE ?",
						contentblocks.OwnerTypeTestCase, caseIDs, "step.%.op").Count(&opCount).Error; err != nil {
					return fmt.Errorf("统计复制操作块失败: %w", err)
				}
				result.OpBlockCount = int(opCount)
			}
		}
		result.Round = createdRound
		return nil
	})
	if err != nil {
		return RoundCopyResult{}, err
	}
	return result, nil
}

func normalizeRoundItemIDs(raw []string) ([]string, error) {
	ids := make([]string, 0, len(raw))
	seen := make(map[string]struct{}, len(raw))
	for _, value := range raw {
		itemID := strings.TrimSpace(value)
		if itemID == "" {
			return nil, ErrRoundCopyItemIDRequired
		}
		if _, exists := seen[itemID]; exists {
			continue
		}
		seen[itemID] = struct{}{}
		ids = append(ids, itemID)
	}
	return ids, nil
}
