package testitems

import (
	"context"
	"fmt"
	"strings"
)

// RequirementTestItemCandidate 测试项页“从需求创建”入口的一行候选。
type RequirementTestItemCandidate struct {
	RequirementID       string `json:"requirementId"`
	ChapterNumber       string `json:"chapterNumber"`
	Name                string `json:"name"`
	PrimaryKind         string `json:"primaryKind"`
	MappedTypeCode      string `json:"mappedTypeCode"`
	HasDescription      bool   `json:"hasDescription"`
	LinkedTestItemCount int    `json:"linkedTestItemCount"`
	CanCreate           bool   `json:"canCreate"`
	BlockReason         string `json:"blockReason,omitempty"`
}

type RequirementTestItemPreview struct {
	Total       int                            `json:"total"`
	Creatable   int                            `json:"creatable"`
	Linked      int                            `json:"linked"`
	Incomplete  int                            `json:"incomplete"`
	Requirement []RequirementTestItemCandidate `json:"requirements"`
}

// PreviewRequirementTestItems 返回已确认需求的可创建状态，供测试项页入口预览。
func (s *Service) PreviewRequirementTestItems(ctx context.Context, projectID string) (RequirementTestItemPreview, error) {
	var rows []struct {
		ID            string `gorm:"column:id"`
		ChapterNumber string `gorm:"column:chapter_number"`
		Name          string `gorm:"column:name"`
		PrimaryKind   string `gorm:"column:primary_kind"`
		Description   string `gorm:"column:description"`
		LinkedCount   int    `gorm:"column:linked_count"`
	}
	if err := s.db.WithContext(ctx).Table("software_requirements AS requirement").
		Select(`requirement.id, requirement.chapter_number, requirement.name,
			requirement.primary_kind, requirement.description,
			COUNT(link.id) AS linked_count`).
		Joins("LEFT JOIN requirement_test_items AS link ON link.requirement_id = requirement.id").
		Where("requirement.project_id = ? AND requirement.status = ?", projectID, "official").
		Group("requirement.id").
		Order("requirement.chapter_number ASC, requirement.name ASC").
		Scan(&rows).Error; err != nil {
		return RequirementTestItemPreview{}, fmt.Errorf("查询需求创建候选失败: %w", err)
	}

	preview := RequirementTestItemPreview{Requirement: make([]RequirementTestItemCandidate, 0, len(rows))}
	for _, row := range rows {
		hasDescription := strings.TrimSpace(row.Description) != ""
		candidate := RequirementTestItemCandidate{
			RequirementID:       row.ID,
			ChapterNumber:       row.ChapterNumber,
			Name:                row.Name,
			PrimaryKind:         row.PrimaryKind,
			MappedTypeCode:      requirementTestItemType(row.PrimaryKind),
			HasDescription:      hasDescription,
			LinkedTestItemCount: row.LinkedCount,
		}
		switch {
		case row.LinkedCount > 0:
			candidate.BlockReason = fmt.Sprintf("已关联 %d 个测试项", row.LinkedCount)
			preview.Linked++
		case !hasDescription:
			candidate.BlockReason = "待补描述"
			preview.Incomplete++
		default:
			candidate.CanCreate = true
			preview.Creatable++
		}
		preview.Requirement = append(preview.Requirement, candidate)
	}
	preview.Total = len(rows)
	return preview, nil
}
