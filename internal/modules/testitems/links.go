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

// RequirementRef 需求引用（用于测试项详情的需求描述与追踪关系；带来源文档名，支持多份来源文档）。
type RequirementRef struct {
	ID                 string `gorm:"column:id" json:"id"`
	ChapterNumber      string `gorm:"column:chapter_number" json:"chapterNumber"`
	Name               string `gorm:"column:name" json:"name"`
	ExternalIdentifier string `gorm:"column:external_identifier" json:"externalIdentifier"`
	Status             string `gorm:"column:status" json:"status"`
	SourceName         string `gorm:"column:source_name" json:"sourceName"`
	SourceVersion      string `gorm:"column:source_version" json:"sourceVersion"`
}

const requirementRefSelect = "req.id, req.chapter_number, req.name, req.external_identifier, req.status, " +
	"wo.name AS source_name, ver.version AS source_version"

// requirementRefJoins 关联需求来源文档（工作对象版本 -> 工作对象）。
const requirementRefJoins = "JOIN software_requirements AS req ON req.id = link.requirement_id " +
	"JOIN work_object_versions AS ver ON ver.id = req.source_version_id " +
	"JOIN work_objects AS wo ON wo.id = ver.work_object_id"

type requirementForLink struct {
	Status      string `gorm:"column:status"`
	PrimaryKind string `gorm:"column:primary_kind"`
	Name        string `gorm:"column:name"`
	Description string `gorm:"column:description"`
}

// loadRequirementForLink 统一校验需求归属、正式状态和描述完整度。
func loadRequirementForLink(tx *gorm.DB, projectID string, requirementID string) (requirementForLink, error) {
	var requirement requirementForLink
	err := tx.Table("software_requirements").
		Select("status, primary_kind, name, description").
		Where("id = ? AND project_id = ?", requirementID, projectID).
		Take(&requirement).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return requirement, ErrNotFound
	}
	if err != nil {
		return requirement, fmt.Errorf("查询需求失败: %w", err)
	}
	if requirement.Status != "official" {
		return requirement, ErrRequirementNotOfficial
	}
	if strings.TrimSpace(requirement.Description) == "" {
		return requirement, ErrRequirementIncomplete
	}
	return requirement, nil
}

func markRequirementTestItemCompletedTx(tx *gorm.DB, projectID string, requirementID string) error {
	if err := tx.Table("software_requirements").
		Where("id = ? AND project_id = ?", requirementID, projectID).
		Update("test_item_task_status", "completed").Error; err != nil {
		return fmt.Errorf("更新需求测试项任务状态失败: %w", err)
	}
	return nil
}

func createRequirementLinkTx(tx *gorm.DB, projectID string, requirementID string, testItemID string) error {
	linkID, err := id.New()
	if err != nil {
		return err
	}
	link := RequirementLink{
		ID:            linkID,
		ProjectID:     projectID,
		RequirementID: requirementID,
		TestItemID:    testItemID,
		CreatedAt:     time.Now(),
	}
	if err := tx.Create(&link).Error; err != nil {
		return fmt.Errorf("关联需求失败: %w", err)
	}
	return markRequirementTestItemCompletedTx(tx, projectID, requirementID)
}

// ListRequirements 返回测试项关联的需求（静态测试项始终为空）。
func (s *Service) ListRequirements(ctx context.Context, testItemID string) ([]RequirementRef, error) {
	var refs []RequirementRef
	if err := s.db.WithContext(ctx).
		Table("requirement_test_items AS link").
		Select(requirementRefSelect).
		Joins(requirementRefJoins).
		Where("link.test_item_id = ?", testItemID).
		Order("wo.name asc, req.chapter_number asc").
		Scan(&refs).Error; err != nil {
		return nil, fmt.Errorf("查询关联需求失败: %w", err)
	}
	return refs, nil
}

// LinkRequirement 关联需求与测试项（静态测试项拒绝）。
func (s *Service) LinkRequirement(ctx context.Context, projectID string, testItemID string, requirementID string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		item, err := findTestItem(tx, testItemID)
		if err != nil {
			return err
		}
		itemType, err := findItemType(tx, item.TypeCode)
		if err != nil {
			return err
		}
		if itemType.IsStatic {
			return ErrStaticNoRequirementLink
		}
		if item.ImplicitRequirement {
			return ErrImplicitWithRequirement
		}
		if _, err := loadRequirementForLink(tx, projectID, requirementID); err != nil {
			return err
		}
		return createRequirementLinkTx(tx, projectID, requirementID, testItemID)
	})
}

// UnlinkRequirement 解除需求与测试项的关联。
func (s *Service) UnlinkRequirement(ctx context.Context, testItemID string, requirementID string) error {
	result := s.db.WithContext(ctx).
		Where("test_item_id = ? AND requirement_id = ?", testItemID, requirementID).
		Delete(&RequirementLink{})
	if result.Error != nil {
		return fmt.Errorf("解除关联失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// ListTestItemsByRequirement 返回指定轮次内关联到某需求的测试项；roundId 为空时取当前轮次。
func (s *Service) ListTestItemsByRequirement(ctx context.Context, requirementID, roundID string) ([]TestItem, error) {
	var projectID string
	if err := s.db.WithContext(ctx).Table("software_requirements").
		Select("project_id").Where("id = ?", requirementID).Scan(&projectID).Error; err != nil {
		return nil, fmt.Errorf("查询需求项目失败: %w", err)
	}
	if projectID == "" {
		return nil, ErrNotFound
	}
	round, err := s.ResolveRound(ctx, projectID, roundID)
	if err != nil {
		return nil, err
	}
	var items []TestItem
	if err := s.db.WithContext(ctx).
		Table("test_items AS item").
		Select("item.*").
		Joins("JOIN requirement_test_items AS link ON link.test_item_id = item.id").
		Where("link.requirement_id = ? AND item.round_id = ?", requirementID, round.ID).
		Order("item.type_code asc, item.sort_order asc").
		Scan(&items).Error; err != nil {
		return nil, fmt.Errorf("查询测试项失败: %w", err)
	}
	return items, nil
}
