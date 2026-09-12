package projects

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"gorm.io/gorm"

	"chenmeridian/internal/id"
	"chenmeridian/internal/modules/users"
)

var (
	ErrProjectNotFound          = errors.New("项目不存在")
	ErrProjectExists            = errors.New("项目标识已存在")
	ErrUserNotFound             = errors.New("项目人员不存在")
	ErrStandardNotFound         = errors.New("依据标准不存在")
	ErrProjectSelectionRequired = errors.New("技术字典和依据标准均至少选择一项")
)

var identifierPattern = regexp.MustCompile(`^[0-9]{4,5}$`)

type Service struct {
	repository *Repository
}

func NewService(db *gorm.DB) *Service {
	return &Service{repository: NewRepository(db)}
}

type CreateProjectInput struct {
	IdentifierSuffix        string   `json:"identifierSuffix"`
	Name                    string   `json:"name"`
	Nature                  string   `json:"nature"`
	Platform                string   `json:"platform"`
	SoftwareType            string   `json:"softwareType"`
	Classification          string   `json:"classification"`
	SecurityLevel           string   `json:"securityLevel"`
	Organization            string   `json:"organization"`
	OwnerID                 string   `json:"ownerId"`
	MemberIDs               []string `json:"memberIds"`
	Languages               []string `json:"languages"`
	RuntimeEnvironments     []string `json:"runtimeEnvironments"`
	DevelopmentEnvironments []string `json:"developmentEnvironments"`
	ReferenceStandardIDs    []string `json:"referenceStandardIds"`
}

type OpenIssues struct {
	Critical   int `json:"critical"`
	Serious    int `json:"serious"`
	Normal     int `json:"normal"`
	Suggestion int `json:"suggestion"`
}

type ProjectMemberResponse struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	IsOwner     bool   `json:"isOwner"`
}

type ReferenceStandardResponse struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Code          string `json:"code"`
	PublishedDate string `json:"publishedDate"`
	Source        string `json:"source"`
	SortOrder     int    `json:"sortOrder"`
	IsEnabled     bool   `json:"isEnabled"`
	IsDefault     bool   `json:"isDefault"`
}

type ProjectResponse struct {
	ID                      string                      `json:"id"`
	Name                    string                      `json:"name"`
	Nature                  string                      `json:"nature"`
	Platform                string                      `json:"platform"`
	SoftwareType            string                      `json:"softwareType"`
	Classification          string                      `json:"classification"`
	Level                   string                      `json:"level"`
	Organization            string                      `json:"organization"`
	Owner                   string                      `json:"owner"`
	Members                 []ProjectMemberResponse     `json:"members"`
	Languages               []string                    `json:"languages"`
	RuntimeEnvironments     []string                    `json:"runtimeEnvironments"`
	DevelopmentEnvironments []string                    `json:"developmentEnvironments"`
	ReferenceStandards      []ReferenceStandardResponse `json:"referenceStandards"`
	CasesTotal              int                         `json:"casesTotal"`
	CasesExecuted           int                         `json:"casesExecuted"`
	OpenIssues              OpenIssues                  `json:"openIssues"`
	Status                  string                      `json:"status"`
	UpdatedAt               string                      `json:"updatedAt"`
}

type DictionaryOption struct {
	ID        string `json:"id"`
	Category  string `json:"category"`
	Name      string `json:"name"`
	SortOrder int    `json:"sortOrder"`
	IsEnabled bool   `json:"isEnabled"`
	IsPreset  bool   `json:"isPreset"`
}

type UserOption struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
}

type ProjectOptionsResponse struct {
	Dictionaries []DictionaryOption          `json:"dictionaries"`
	Standards    []ReferenceStandardResponse `json:"standards"`
	Users        []UserOption                `json:"users"`
}

func (s *Service) List(ctx context.Context) ([]ProjectResponse, error) {
	allProjects, err := s.repository.ListProjects(ctx)
	if err != nil {
		return nil, fmt.Errorf("查询项目列表失败: %w", err)
	}
	return s.buildResponses(ctx, allProjects)
}

func (s *Service) FindByCode(ctx context.Context, code string) (ProjectResponse, error) {
	project, err := s.repository.FindProjectByCode(ctx, strings.ToUpper(strings.TrimSpace(code)))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ProjectResponse{}, ErrProjectNotFound
		}
		return ProjectResponse{}, fmt.Errorf("查询项目失败: %w", err)
	}
	responses, err := s.buildResponses(ctx, []Project{project})
	if err != nil {
		return ProjectResponse{}, err
	}
	return responses[0], nil
}

func (s *Service) Options(ctx context.Context) (ProjectOptionsResponse, error) {
	dictionaries, err := s.repository.ListDictionaryItems(ctx, true)
	if err != nil {
		return ProjectOptionsResponse{}, fmt.Errorf("查询技术字典失败: %w", err)
	}
	standards, err := s.repository.ListReferenceStandards(ctx, true)
	if err != nil {
		return ProjectOptionsResponse{}, fmt.Errorf("查询依据标准失败: %w", err)
	}
	allUsers, err := s.repository.ListUsers(ctx)
	if err != nil {
		return ProjectOptionsResponse{}, fmt.Errorf("查询项目人员失败: %w", err)
	}

	options := ProjectOptionsResponse{
		Dictionaries: make([]DictionaryOption, 0, len(dictionaries)),
		Standards:    make([]ReferenceStandardResponse, 0, len(standards)),
		Users:        make([]UserOption, 0, len(allUsers)),
	}
	for _, item := range dictionaries {
		options.Dictionaries = append(options.Dictionaries, DictionaryOption{
			ID:        item.ID,
			Category:  item.Category,
			Name:      item.Name,
			SortOrder: item.SortOrder,
			IsEnabled: item.IsEnabled,
			IsPreset:  item.IsPreset,
		})
	}
	for _, standard := range standards {
		options.Standards = append(options.Standards, toStandardResponse(standard))
	}
	for _, user := range allUsers {
		options.Users = append(options.Users, UserOption{
			ID:          user.ID,
			Username:    user.Username,
			DisplayName: user.DisplayName,
		})
	}
	return options, nil
}

func (s *Service) Create(ctx context.Context, input CreateProjectInput) (ProjectResponse, error) {
	identifierSuffix := strings.TrimSpace(input.IdentifierSuffix)
	if !identifierPattern.MatchString(identifierSuffix) {
		return ProjectResponse{}, fmt.Errorf("项目标识后缀必须是 4 到 5 位数字")
	}

	code := "R" + identifierSuffix
	name := strings.TrimSpace(input.Name)
	organization := strings.TrimSpace(input.Organization)
	if name == "" {
		return ProjectResponse{}, fmt.Errorf("项目名称不能为空")
	}

	if len(uniqueStrings(input.Languages)) == 0 ||
		len(uniqueStrings(input.RuntimeEnvironments)) == 0 ||
		len(uniqueStrings(input.DevelopmentEnvironments)) == 0 ||
		len(uniqueStrings(input.ReferenceStandardIDs)) == 0 {
		return ProjectResponse{}, ErrProjectSelectionRequired
	}

	allUsers, err := s.repository.ListUsers(ctx)
	if err != nil {
		return ProjectResponse{}, fmt.Errorf("查询项目人员失败: %w", err)
	}
	usersByID := make(map[string]users.User, len(allUsers))
	for _, user := range allUsers {
		usersByID[user.ID] = user
	}
	if _, ok := usersByID[input.OwnerID]; !ok {
		return ProjectResponse{}, ErrUserNotFound
	}

	memberIDs := uniqueStrings(append(input.MemberIDs, input.OwnerID))
	for _, memberID := range memberIDs {
		if _, ok := usersByID[memberID]; !ok {
			return ProjectResponse{}, ErrUserNotFound
		}
	}

	allStandards, err := s.repository.ListReferenceStandards(ctx, false)
	if err != nil {
		return ProjectResponse{}, fmt.Errorf("查询依据标准失败: %w", err)
	}
	standardsByID := make(map[string]ReferenceStandard, len(allStandards))
	for _, standard := range allStandards {
		standardsByID[standard.ID] = standard
	}
	standardIDs := uniqueStrings(input.ReferenceStandardIDs)
	for _, standardID := range standardIDs {
		if _, ok := standardsByID[standardID]; !ok {
			return ProjectResponse{}, ErrStandardNotFound
		}
	}

	var createdCode string
	err = s.repository.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var count int64
		if err := tx.Model(&Project{}).Where("code = ?", code).Count(&count).Error; err != nil {
			return fmt.Errorf("检查项目标识失败: %w", err)
		}
		if count > 0 {
			return ErrProjectExists
		}

		projectID, err := id.New()
		if err != nil {
			return err
		}
		now := time.Now()
		if err := tx.Create(&Project{
			ID:             projectID,
			Code:           code,
			Name:           name,
			Nature:         input.Nature,
			Platform:       input.Platform,
			SoftwareType:   input.SoftwareType,
			Classification: input.Classification,
			SecurityLevel:  input.SecurityLevel,
			Organization:   organization,
			OwnerID:        input.OwnerID,
			Status:         "编制大纲中",
			CreatedAt:      now,
			UpdatedAt:      now,
		}).Error; err != nil {
			return fmt.Errorf("创建项目失败: %w", err)
		}

		languageIDs, err := resolveDictionaryItems(ctx, tx, "language", uniqueStrings(input.Languages))
		if err != nil {
			return err
		}
		runtimeIDs, err := resolveDictionaryItems(ctx, tx, "runtime_environment", uniqueStrings(input.RuntimeEnvironments))
		if err != nil {
			return err
		}
		developmentIDs, err := resolveDictionaryItems(ctx, tx, "development_environment", uniqueStrings(input.DevelopmentEnvironments))
		if err != nil {
			return err
		}

		if err := createDictionaryRelations(ctx, tx, "project_languages", projectID, languageIDs); err != nil {
			return err
		}
		if err := createDictionaryRelations(ctx, tx, "project_runtime_environments", projectID, runtimeIDs); err != nil {
			return err
		}
		if err := createDictionaryRelations(ctx, tx, "project_development_environments", projectID, developmentIDs); err != nil {
			return err
		}

		for _, standardID := range standardIDs {
			relationID, err := id.New()
			if err != nil {
				return err
			}
			if err := tx.Table("project_reference_standards").Create(map[string]any{
				"id":                    relationID,
				"project_id":            projectID,
				"reference_standard_id": standardID,
				"created_at":            now,
				"updated_at":            now,
			}).Error; err != nil {
				return fmt.Errorf("保存项目依据标准失败: %w", err)
			}
		}

		for _, memberID := range memberIDs {
			relationID, err := id.New()
			if err != nil {
				return err
			}
			if err := tx.Create(&ProjectMember{
				ID:        relationID,
				ProjectID: projectID,
				UserID:    memberID,
				IsOwner:   memberID == input.OwnerID,
				CreatedAt: now,
				UpdatedAt: now,
			}).Error; err != nil {
				return fmt.Errorf("保存项目成员失败: %w", err)
			}
		}

		createdCode = code
		return nil
	})
	if err != nil {
		return ProjectResponse{}, err
	}

	return s.FindByCode(ctx, createdCode)
}

func resolveDictionaryItems(ctx context.Context, tx *gorm.DB, category string, names []string) ([]string, error) {
	ids := make([]string, 0, len(names))
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}

		var item DictionaryItem
		err := tx.WithContext(ctx).
			Where("category = ? AND lower(name) = lower(?)", category, name).
			First(&item).Error
		if err == nil {
			ids = append(ids, item.ID)
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("查询技术字典失败: %w", err)
		}

		nextID, err := id.New()
		if err != nil {
			return nil, err
		}
		var nextOrder int
		if err := tx.WithContext(ctx).Model(&DictionaryItem{}).
			Select("COALESCE(MAX(sort_order), 0)").
			Where("category = ?", category).
			Scan(&nextOrder).Error; err != nil {
			return nil, fmt.Errorf("查询技术字典排序失败: %w", err)
		}
		now := time.Now()
		item = DictionaryItem{
			ID:        nextID,
			Category:  category,
			Name:      name,
			SortOrder: nextOrder + 1,
			IsEnabled: true,
			IsPreset:  false,
			CreatedAt: now,
			UpdatedAt: now,
		}
		if err := tx.WithContext(ctx).Create(&item).Error; err != nil {
			return nil, fmt.Errorf("保存自定义技术字典失败: %w", err)
		}
		ids = append(ids, item.ID)
	}
	return ids, nil
}

func createDictionaryRelations(ctx context.Context, tx *gorm.DB, table string, projectID string, itemIDs []string) error {
	for _, itemID := range itemIDs {
		relationID, err := id.New()
		if err != nil {
			return err
		}
		now := time.Now()
		if err := tx.WithContext(ctx).Table(table).Create(map[string]any{
			"id":                 relationID,
			"project_id":         projectID,
			"dictionary_item_id": itemID,
			"created_at":         now,
			"updated_at":         now,
		}).Error; err != nil {
			return fmt.Errorf("保存项目技术字典失败: %w", err)
		}
	}
	return nil
}
func (s *Service) IsUserReferenced(ctx context.Context, userID string) (bool, error) {
	count, err := s.repository.CountUserReferences(ctx, userID)
	if err != nil {
		return false, fmt.Errorf("查询用户引用失败: %w", err)
	}
	return count > 0, nil
}
