package testitems

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"chenmeridian/internal/id"
)

var (
	// ErrIssueNotFound 问题单不存在。
	ErrIssueNotFound = errors.New("问题单不存在")
	// ErrIssueAlreadyOpen 同一检查项已有未关闭问题单。
	ErrIssueAlreadyOpen = errors.New("该检查项已有未关闭的问题单")
	// ErrIssueInvalid 问题单内容不合法。
	ErrIssueInvalid = errors.New("问题单内容不合法")
	// ErrIssueNotDC 只有文档审查的不通过项可以立单。
	ErrIssueNotDC = errors.New("只有文档审查的不通过项可以立单")
)

// Issue 正式问题单（当前服务于 DC 文档审查闭环）。
type Issue struct {
	ID                 string     `gorm:"column:id;primaryKey" json:"id"`
	ProjectID          string     `gorm:"column:project_id" json:"projectId"`
	RoundID            string     `gorm:"column:round_id" json:"roundId"`
	RoundNumber        int        `gorm:"column:round_number" json:"roundNumber"`
	TestItemID         string     `gorm:"column:test_item_id" json:"testItemId"`
	TestItemIdentifier string     `gorm:"column:test_item_identifier" json:"testItemIdentifier"`
	SourceSheetID      string     `gorm:"column:source_sheet_id" json:"sourceSheetId"`
	SourceSheetName    string     `gorm:"column:source_sheet_name" json:"sourceSheetName"`
	SourceCheckID      string     `gorm:"column:source_check_id" json:"sourceCheckId"`
	SourceCheckTitle   string     `gorm:"column:source_check_title" json:"sourceCheckTitle"`
	TargetDocument     string     `gorm:"column:target_document" json:"targetDocument"`
	Title              string     `gorm:"column:title" json:"title"`
	Description        string     `gorm:"column:description" json:"description"`
	DefectType         string     `gorm:"column:defect_type" json:"defectType"`
	Level              string     `gorm:"column:level" json:"level"`
	ClosureMethod      string     `gorm:"column:closure_method" json:"closureMethod"`
	Status             string     `gorm:"column:status" json:"status"`
	ClosureNote        string     `gorm:"column:closure_note" json:"closureNote"`
	CreatedBy          string     `gorm:"column:created_by" json:"createdBy"`
	ClosedBy           *string    `gorm:"column:closed_by" json:"closedBy"`
	ClosedAt           *time.Time `gorm:"column:closed_at" json:"closedAt"`
	CreatedAt          time.Time  `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt          time.Time  `gorm:"column:updated_at" json:"updatedAt"`
}

func (Issue) TableName() string { return "issues" }

// CreateIssueInput 立单入参。
type CreateIssueInput struct {
	ProjectID     string `json:"-"`
	RoundID       string `json:"roundId"`
	TestItemID    string `json:"testItemId"`
	SheetID       string `json:"sheetId"`
	SheetName     string `json:"sheetName"`
	CheckID       string `json:"checkId"`
	CheckTitle    string `json:"checkTitle"`
	TargetDoc     string `json:"targetDocument"`
	Title         string `json:"title"`
	Description   string `json:"description"`
	DefectType    string `json:"defectType"`
	Level         string `json:"level"`
	ClosureMethod string `json:"closureMethod"`
	CreatedBy     string `json:"-"`
}

// UpdateIssueInput 问题单更新入参；指针为空表示不改。
type UpdateIssueInput struct {
	Title         *string `json:"title"`
	Description   *string `json:"description"`
	Level         *string `json:"level"`
	ClosureMethod *string `json:"closureMethod"`
	Status        *string `json:"status"`
	ClosureNote   *string `json:"closureNote"`
	UpdatedBy     string  `json:"-"`
}

// CreateIssue 从 DC 不通过项立单。
func (s *Service) CreateIssue(ctx context.Context, input CreateIssueInput) (Issue, error) {
	title := strings.TrimSpace(input.Title)
	if title == "" {
		return Issue{}, ErrIssueInvalid
	}
	item, err := s.GetTestItem(ctx, input.TestItemID)
	if err != nil {
		return Issue{}, err
	}
	if item.ProjectID != input.ProjectID {
		return Issue{}, ErrNotFound
	}
	if item.TypeCode != "DC" {
		return Issue{}, ErrIssueNotDC
	}
	roundID := strings.TrimSpace(input.RoundID)
	if roundID == "" {
		roundID = item.RoundID
	}
	var round Round
	if err := s.db.WithContext(ctx).Where("id = ? AND project_id = ?", roundID, item.ProjectID).First(&round).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return Issue{}, ErrRoundNotFound
		}
		return Issue{}, fmt.Errorf("查询问题单轮次失败: %w", err)
	}
	if strings.TrimSpace(input.CheckID) != "" {
		var open int64
		if err := s.db.WithContext(ctx).Model(&Issue{}).
			Where("test_item_id = ? AND source_check_id = ? AND status = 'open'", item.ID, input.CheckID).
			Count(&open).Error; err != nil {
			return Issue{}, fmt.Errorf("查询未关闭问题单失败: %w", err)
		}
		if open > 0 {
			return Issue{}, ErrIssueAlreadyOpen
		}
	}
	issueID, err := id.New()
	if err != nil {
		return Issue{}, err
	}
	now := time.Now()
	issue := Issue{
		ID: issueID, ProjectID: item.ProjectID, RoundID: round.ID, RoundNumber: round.RoundNumber,
		TestItemID: item.ID, TestItemIdentifier: item.Identifier,
		SourceSheetID: input.SheetID, SourceSheetName: input.SheetName,
		SourceCheckID: input.CheckID, SourceCheckTitle: input.CheckTitle,
		TargetDocument: input.TargetDoc, Title: title, Description: input.Description,
		DefectType:    defaultString(input.DefectType, "文档问题"),
		Level:         defaultString(input.Level, "一般"),
		ClosureMethod: defaultString(input.ClosureMethod, "修改文档"),
		Status:        "open", CreatedBy: input.CreatedBy, CreatedAt: now, UpdatedAt: now,
	}
	if issue.CreatedBy == "" {
		return Issue{}, ErrIssueInvalid
	}
	if err := s.db.WithContext(ctx).Create(&issue).Error; err != nil {
		return Issue{}, fmt.Errorf("创建问题单失败: %w", err)
	}
	return issue, nil
}

// ListIssues 按项目与轮次列出问题单；roundID 为空取全部。
func (s *Service) ListIssues(ctx context.Context, projectID, roundID string) ([]Issue, error) {
	query := s.db.WithContext(ctx).Model(&Issue{}).Where("project_id = ?", projectID)
	if trimmed := strings.TrimSpace(roundID); trimmed != "" && trimmed != "all" {
		query = query.Where("round_id = ?", trimmed)
	}
	var issues []Issue
	if err := query.Order("round_number desc, created_at desc").Find(&issues).Error; err != nil {
		return nil, fmt.Errorf("查询问题单失败: %w", err)
	}
	return issues, nil
}

// GetIssue 读取问题单。
func (s *Service) GetIssue(ctx context.Context, issueID string) (Issue, error) {
	var issue Issue
	err := s.db.WithContext(ctx).Where("id = ?", issueID).First(&issue).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Issue{}, ErrIssueNotFound
	}
	if err != nil {
		return Issue{}, fmt.Errorf("查询问题单失败: %w", err)
	}
	return issue, nil
}

// UpdateIssue 更新内容或关闭/重新打开。
func (s *Service) UpdateIssue(ctx context.Context, issueID string, input UpdateIssueInput) (Issue, error) {
	issue, err := s.GetIssue(ctx, issueID)
	if err != nil {
		return Issue{}, err
	}
	now := time.Now()
	if input.Title != nil {
		title := strings.TrimSpace(*input.Title)
		if title == "" {
			return Issue{}, ErrIssueInvalid
		}
		issue.Title = title
	}
	if input.Description != nil {
		issue.Description = *input.Description
	}
	if input.Level != nil && strings.TrimSpace(*input.Level) != "" {
		issue.Level = strings.TrimSpace(*input.Level)
	}
	if input.ClosureMethod != nil && strings.TrimSpace(*input.ClosureMethod) != "" {
		issue.ClosureMethod = strings.TrimSpace(*input.ClosureMethod)
	}
	if input.Status != nil {
		switch strings.TrimSpace(*input.Status) {
		case "closed":
			if strings.TrimSpace(valueOr(input.ClosureNote, "")) == "" {
				return Issue{}, ErrIssueInvalid
			}
			issue.Status = "closed"
			issue.ClosureNote = strings.TrimSpace(valueOr(input.ClosureNote, ""))
			issue.ClosedAt = &now
			if input.UpdatedBy != "" {
				closedBy := input.UpdatedBy
				issue.ClosedBy = &closedBy
			}
		case "open":
			issue.Status = "open"
			issue.ClosureNote = ""
			issue.ClosedAt = nil
			issue.ClosedBy = nil
		default:
			return Issue{}, ErrIssueInvalid
		}
	}
	issue.UpdatedAt = now
	if err := s.db.WithContext(ctx).Save(&issue).Error; err != nil {
		return Issue{}, fmt.Errorf("保存问题单失败: %w", err)
	}
	return issue, nil
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

func valueOr(value *string, fallback string) string {
	if value == nil {
		return fallback
	}
	if strings.TrimSpace(*value) == "" {
		return fallback
	}
	return *value
}
