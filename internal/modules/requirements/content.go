package requirements

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

type RequirementContentResponse struct {
	ID             string `json:"id"`
	Description    string `json:"description"`
	HasDescription bool   `json:"hasDescription"`
	UpdatedAt      string `json:"updatedAt"`
}

func (s *Service) RequirementContent(ctx context.Context, requirementID string) (RequirementContentResponse, error) {
	var requirement Requirement
	if err := s.db.WithContext(ctx).Where("id = ?", requirementID).First(&requirement).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return RequirementContentResponse{}, ErrRequirementNotFound
		}
		return RequirementContentResponse{}, fmt.Errorf("查询软件需求详情失败: %w", err)
	}

	return RequirementContentResponse{
		ID:             requirement.ID,
		Description:    requirement.Description,
		HasDescription: strings.TrimSpace(requirement.Description) != "",
		UpdatedAt:      requirement.UpdatedAt.Format(time.RFC3339),
	}, nil
}
