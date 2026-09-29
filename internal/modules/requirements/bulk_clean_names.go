package requirements

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"gorm.io/gorm"
)

var candidateNameIdentifierPrefix = regexp.MustCompile(`(?i)^\s*\[RQGN[^\]]+\]\s*`)

type BulkCleanNamesInput struct {
	ProjectCode string
	IDs         []string
	OperatedBy  string
}

type BulkCleanNamesResult struct {
	UpdatedCount int `json:"updatedCount"`
}

func (s *Service) BulkCleanNames(ctx context.Context, input BulkCleanNamesInput) (BulkCleanNamesResult, error) {
	if len(input.IDs) == 0 {
		return BulkCleanNamesResult{}, ErrNoRequirements
	}

	projectID, err := s.findProject(ctx, input.ProjectCode)
	if err != nil {
		return BulkCleanNamesResult{}, err
	}

	var requirements []Requirement
	if err := s.db.WithContext(ctx).
		Where("project_id = ? AND id IN ?", projectID, input.IDs).
		Order("source_version_id, chapter_number, id").
		Find(&requirements).Error; err != nil {
		return BulkCleanNamesResult{}, fmt.Errorf("查询软件需求失败: %w", err)
	}
	if len(requirements) != len(input.IDs) {
		return BulkCleanNamesResult{}, ErrRequirementNotFound
	}

	type cleanNameItem struct {
		requirement Requirement
		newName     string
		changed     bool
	}
	updates := make([]cleanNameItem, 0, len(requirements))
	hasChanged := false
	for _, requirement := range requirements {
		if requirement.Status != StatusCandidate {
			return BulkCleanNamesResult{}, ErrRequirementNotCandidate
		}
		newName := strings.TrimSpace(candidateNameIdentifierPrefix.ReplaceAllString(requirement.Name, ""))
		if newName == "" {
			return BulkCleanNamesResult{}, ErrReplaceNameEmpty
		}
		if len([]rune(newName)) > 240 {
			return BulkCleanNamesResult{}, ErrReplaceNameTooLong
		}
		changed := newName != requirement.Name
		hasChanged = hasChanged || changed
		updates = append(updates, cleanNameItem{requirement: requirement, newName: newName, changed: changed})
	}
	if !hasChanged {
		return BulkCleanNamesResult{}, ErrNoChanges
	}

	result := BulkCleanNamesResult{}
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, update := range updates {
			if !update.changed {
				continue
			}
			current := update.requirement
			var activeNameCount int64
			if err := tx.Model(&Requirement{}).
				Where("source_version_id = ? AND name = ? AND status IN ? AND id <> ?",
					current.SourceVersionID, update.newName,
					[]string{StatusCandidate, StatusOfficial}, current.ID).
				Count(&activeNameCount).Error; err != nil {
				return fmt.Errorf("检查需求名称冲突失败: %w", err)
			}
			if activeNameCount > 0 {
				return ErrRequirementName
			}

			now := time.Now()
			if err := tx.Model(&Requirement{}).Where("id = ?", current.ID).Updates(map[string]any{
				"name":       update.newName,
				"updated_at": now,
			}).Error; err != nil {
				return fmt.Errorf("批量清理需求名称失败: %w", err)
			}
			if err := createEvent(tx, current.ProjectID, current.ID, "update", StatusCandidate, StatusCandidate,
				fmt.Sprintf("批量清理名称「%s」→「%s」", current.Name, update.newName),
				input.OperatedBy, now); err != nil {
				return err
			}
			result.UpdatedCount++
		}
		return nil
	})
	if err != nil {
		return BulkCleanNamesResult{}, err
	}
	return result, nil
}
