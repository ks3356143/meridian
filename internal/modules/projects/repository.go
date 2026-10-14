package projects

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"chenmeridian/internal/modules/users"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) ListDictionaryItems(ctx context.Context, enabledOnly bool) ([]DictionaryItem, error) {
	query := r.db.WithContext(ctx).Model(&DictionaryItem{})
	if enabledOnly {
		query = query.Where("is_enabled = ?", true)
	}
	var items []DictionaryItem
	if err := query.Order("category ASC, sort_order ASC, name ASC").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) ListReferenceStandards(ctx context.Context, enabledOnly bool) ([]ReferenceStandard, error) {
	query := r.db.WithContext(ctx).Model(&ReferenceStandard{})
	if enabledOnly {
		query = query.Where("is_enabled = ?", true)
	}
	var standards []ReferenceStandard
	if err := query.Order("sort_order ASC, name ASC").Find(&standards).Error; err != nil {
		return nil, err
	}
	return standards, nil
}

func (r *Repository) ListUsers(ctx context.Context) ([]users.User, error) {
	var allUsers []users.User
	if err := r.db.WithContext(ctx).Model(&users.User{}).Order("display_name ASC, username ASC").Find(&allUsers).Error; err != nil {
		return nil, err
	}
	return allUsers, nil
}

func (r *Repository) ListProjects(ctx context.Context) ([]Project, error) {
	var allProjects []Project
	if err := r.db.WithContext(ctx).Model(&Project{}).Order("updated_at DESC, code ASC").Find(&allProjects).Error; err != nil {
		return nil, err
	}
	return allProjects, nil
}

func (r *Repository) FindProjectByCode(ctx context.Context, code string) (Project, error) {
	var project Project
	if err := r.db.WithContext(ctx).Model(&Project{}).Where("code = ?", code).First(&project).Error; err != nil {
		return Project{}, err
	}
	return project, nil
}

func (r *Repository) ProjectCodeExists(ctx context.Context, code string) (bool, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&Project{}).Where("code = ?", code).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

type MemberSelection struct {
	ProjectID string
	UserID    string
	IsOwner   bool
}

func (r *Repository) ListProjectMembers(ctx context.Context, projectIDs []string) ([]MemberSelection, error) {
	if len(projectIDs) == 0 {
		return nil, nil
	}
	var members []MemberSelection
	err := r.db.WithContext(ctx).
		Table("project_members").
		Select("project_id", "user_id", "is_owner").
		Where("project_id IN ?", projectIDs).
		Order("is_owner DESC, created_at ASC").
		Scan(&members).Error
	if err != nil {
		return nil, err
	}
	return members, nil
}

type DictionarySelection struct {
	ProjectID string
	Category  string
	Name      string
}

func (r *Repository) ListProjectDictionaries(ctx context.Context, projectIDs []string) ([]DictionarySelection, error) {
	if len(projectIDs) == 0 {
		return nil, nil
	}
	languages, err := r.listDictionarySelections(ctx, "project_languages", projectIDs)
	if err != nil {
		return nil, err
	}
	runtimes, err := r.listDictionarySelections(ctx, "project_runtime_environments", projectIDs)
	if err != nil {
		return nil, err
	}
	developments, err := r.listDictionarySelections(ctx, "project_development_environments", projectIDs)
	if err != nil {
		return nil, err
	}
	return append(append(languages, runtimes...), developments...), nil
}

func (r *Repository) listDictionarySelections(
	ctx context.Context,
	table string,
	projectIDs []string,
) ([]DictionarySelection, error) {
	if len(projectIDs) == 0 {
		return nil, nil
	}
	var selections []DictionarySelection
	err := r.db.WithContext(ctx).
		Table(table+" AS pi").
		Select("pi.project_id", "di.category", "di.name").
		Joins("JOIN dictionary_items AS di ON di.id = pi.dictionary_item_id").
		Where("pi.project_id IN ?", projectIDs).
		Order("di.sort_order ASC, di.name ASC").
		Scan(&selections).Error
	if err != nil {
		return nil, err
	}
	return selections, nil
}

type StandardSelection struct {
	ProjectID     string
	Name          string
	Code          string
	PublishedDate string
	Source        string
	ID            string
	SortOrder     int
	IsEnabled     bool
	IsDefault     bool
}

func (r *Repository) ListProjectStandards(ctx context.Context, projectIDs []string) ([]StandardSelection, error) {
	if len(projectIDs) == 0 {
		return nil, nil
	}
	var selections []StandardSelection
	err := r.db.WithContext(ctx).
		Table("project_reference_standards AS prs").
		Select("prs.project_id", "rs.id", "rs.name", "rs.code", "rs.published_date", "rs.source", "rs.sort_order", "rs.is_enabled", "rs.is_default").
		Joins("JOIN reference_standards AS rs ON rs.id = prs.reference_standard_id").
		Where("prs.project_id IN ?", projectIDs).
		Order("rs.sort_order ASC, rs.name ASC").
		Scan(&selections).Error
	if err != nil {
		return nil, err
	}
	return selections, nil
}
func (r *Repository) CountUserReferences(ctx context.Context, userID string) (int64, error) {
	var memberCount int64
	if err := r.db.WithContext(ctx).Model(&ProjectMember{}).Where("user_id = ?", userID).Count(&memberCount).Error; err != nil {
		return 0, err
	}
	var ownerCount int64
	if err := r.db.WithContext(ctx).Model(&Project{}).Where("owner_id = ?", userID).Count(&ownerCount).Error; err != nil {
		return 0, err
	}
	return memberCount + ownerCount, nil
}

// WorkspaceCounts 是项目下工作区数据的实时计数。
// test_items / test_cases 由测试项模块维护，projects 表的 cases_total / cases_executed 是
// 没有写入方的历史列，读取时统一实时聚合，避免同类计数再次漂移。
type WorkspaceCounts struct {
	TestItems     int
	Cases         int
	CasesExecuted int
}

func (r *Repository) CountWorkspaceObjects(ctx context.Context, projectIDs []string) (map[string]WorkspaceCounts, error) {
	counts := make(map[string]WorkspaceCounts, len(projectIDs))
	if len(projectIDs) == 0 {
		return counts, nil
	}
	var itemRows []struct {
		ProjectID string
		Total     int
	}
	if err := r.db.WithContext(ctx).Table("test_items").
		Select("project_id, COUNT(*) AS total").
		Where("project_id IN ?", projectIDs).
		Group("project_id").
		Scan(&itemRows).Error; err != nil {
		return nil, fmt.Errorf("统计项目测试项失败: %w", err)
	}
	for _, row := range itemRows {
		entry := counts[row.ProjectID]
		entry.TestItems = row.Total
		counts[row.ProjectID] = entry
	}
	var caseRows []struct {
		ProjectID string
		Total     int
		Executed  int
	}
	if err := r.db.WithContext(ctx).Table("test_cases").
		Select("project_id, COUNT(*) AS total, SUM(CASE WHEN status = 'pending' THEN 0 ELSE 1 END) AS executed").
		Where("project_id IN ?", projectIDs).
		Group("project_id").
		Scan(&caseRows).Error; err != nil {
		return nil, fmt.Errorf("统计项目用例失败: %w", err)
	}
	for _, row := range caseRows {
		entry := counts[row.ProjectID]
		entry.Cases = row.Total
		entry.CasesExecuted = row.Executed
		counts[row.ProjectID] = entry
	}
	return counts, nil
}
