package testitems

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

const (
	BatchOutcomeCreated            = "created"
	BatchOutcomeSkippedExisting    = "skipped_existing"
	BatchOutcomeSkippedIncomplete  = "skipped_incomplete"
	BatchOutcomeSkippedNotOfficial = "skipped_not_official"
	BatchOutcomeFailed             = "failed"
)

// BatchCreateFromRequirementsItem 单个需求的批量创建结果。
type BatchCreateFromRequirementsItem struct {
	RequirementID      string `json:"requirementId"`
	ChapterNumber      string `json:"chapterNumber"`
	Name               string `json:"name"`
	Outcome            string `json:"outcome"`
	TestItemID         string `json:"testItemId,omitempty"`
	TestItemIdentifier string `json:"testItemIdentifier,omitempty"`
	Message            string `json:"message,omitempty"`
}

// BatchCreateFromRequirementsResult 批量创建汇总。
type BatchCreateFromRequirementsResult struct {
	Total   int                               `json:"total"`
	Created int                               `json:"created"`
	Skipped int                               `json:"skipped"`
	Failed  int                               `json:"failed"`
	Items   []BatchCreateFromRequirementsItem `json:"items"`
}

type batchRequirement struct {
	ID            string `gorm:"column:id"`
	ChapterNumber string `gorm:"column:chapter_number"`
	Name          string `gorm:"column:name"`
	Status        string `gorm:"column:status"`
	Description   string `gorm:"column:description"`
}

// CreateTestItemsFromRequirements 按需求批量创建测试项；默认跳过已关联和待补描述需求。
func (s *Service) CreateTestItemsFromRequirements(
	ctx context.Context,
	projectID string,
	requirementIDs []string,
	all bool,
) (BatchCreateFromRequirementsResult, error) {
	result := BatchCreateFromRequirementsResult{}
	query := s.db.WithContext(ctx).Table("software_requirements").
		Select("id, chapter_number, name, status, description").
		Where("project_id = ?", projectID)
	if all {
		query = query.Where("status = ?", "official").Order("chapter_number asc, name asc")
	} else {
		ids := uniqueRequirementIDs(requirementIDs)
		if len(ids) == 0 {
			return result, ErrRequirementSelectionRequired
		}
		query = query.Where("id IN ? AND status = ?", ids, "official").Order("chapter_number asc, name asc")
	}

	var requirements []batchRequirement
	if err := query.Scan(&requirements).Error; err != nil {
		return result, fmt.Errorf("查询待创建需求失败: %w", err)
	}
	result.Total = len(requirements)
	result.Items = make([]BatchCreateFromRequirementsItem, 0, len(requirements))

	linkedRequirementIDs := make(map[string]struct{})
	if len(requirements) > 0 {
		var linkedIDs []string
		if err := s.db.WithContext(ctx).Table("requirement_test_items").
			Where("project_id = ?", projectID).
			Distinct("requirement_id").
			Pluck("requirement_id", &linkedIDs).Error; err != nil {
			return result, fmt.Errorf("查询需求测试项关联失败: %w", err)
		}
		for _, requirementID := range linkedIDs {
			linkedRequirementIDs[requirementID] = struct{}{}
		}
	}

	for _, requirement := range requirements {
		item := BatchCreateFromRequirementsItem{
			RequirementID: requirement.ID,
			ChapterNumber: requirement.ChapterNumber,
			Name:          requirement.Name,
		}
		if requirement.Status != "official" {
			item.Outcome = BatchOutcomeSkippedNotOfficial
			item.Message = ErrRequirementNotOfficial.Error()
			result.Skipped++
			result.Items = append(result.Items, item)
			continue
		}
		if strings.TrimSpace(requirement.Description) == "" {
			item.Outcome = BatchOutcomeSkippedIncomplete
			item.Message = ErrRequirementIncomplete.Error()
			result.Skipped++
			result.Items = append(result.Items, item)
			continue
		}

		if _, linked := linkedRequirementIDs[requirement.ID]; linked {
			item.Outcome = BatchOutcomeSkippedExisting
			item.Message = "已有关联测试项"
			result.Skipped++
			result.Items = append(result.Items, item)
			continue
		}

		created, err := s.CreateTestItem(ctx, CreateTestItemInput{
			ProjectID:     projectID,
			RequirementID: requirement.ID,
		})
		if err != nil {
			switch {
			case errors.Is(err, ErrRequirementIncomplete):
				item.Outcome = BatchOutcomeSkippedIncomplete
				item.Message = err.Error()
				result.Skipped++
			case errors.Is(err, ErrRequirementNotOfficial):
				item.Outcome = BatchOutcomeSkippedNotOfficial
				item.Message = err.Error()
				result.Skipped++
			default:
				item.Outcome = BatchOutcomeFailed
				item.Message = err.Error()
				result.Failed++
			}
			result.Items = append(result.Items, item)
			continue
		}
		item.Outcome = BatchOutcomeCreated
		item.TestItemID = created.ID
		item.TestItemIdentifier = created.Identifier
		result.Created++
		result.Items = append(result.Items, item)
	}
	return result, nil
}

func uniqueRequirementIDs(ids []string) []string {
	seen := make(map[string]struct{}, len(ids))
	result := make([]string, 0, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result
}
