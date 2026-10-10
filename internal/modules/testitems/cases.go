package testitems

import (
	"context"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"chenmeridian/internal/id"
)

// ListCases 返回测试项下的用例（按序号）。
func (s *Service) ListCases(ctx context.Context, testItemID string) ([]Case, error) {
	var cases []Case
	if err := s.db.WithContext(ctx).Where("test_item_id = ?", testItemID).
		Order("sort_order asc, created_at asc").Find(&cases).Error; err != nil {
		return nil, fmt.Errorf("查询用例失败: %w", err)
	}
	return cases, nil
}

// ListCasesByProject 返回项目内全部用例（工作台摘要用）。
func (s *Service) ListCasesByProject(ctx context.Context, projectID string) ([]Case, error) {
	var cases []Case
	if err := s.db.WithContext(ctx).Where("project_id = ?", projectID).
		Order("test_item_id asc, sort_order asc, created_at asc").Find(&cases).Error; err != nil {
		return nil, fmt.Errorf("查询用例失败: %w", err)
	}
	return cases, nil
}

// GetCase 按 id 返回用例。
func (s *Service) GetCase(ctx context.Context, caseID string) (Case, error) {
	var itemCase Case
	err := s.db.WithContext(ctx).Where("id = ?", caseID).First(&itemCase).Error
	if err != nil {
		return Case{}, ErrNotFound
	}
	return itemCase, nil
}

// CreateCase 在测试项末尾追加一条用例（序号与标识自动生成）。
func (s *Service) CreateCase(ctx context.Context, testItemID string, name string) (Case, error) {
	var created Case
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		item, err := findTestItem(tx, testItemID)
		if err != nil {
			return err
		}
		var maxOrder *int
		if err := tx.Model(&Case{}).Where("test_item_id = ?", testItemID).
			Select("MAX(sort_order)").Scan(&maxOrder).Error; err != nil {
			return fmt.Errorf("查询用例排序失败: %w", err)
		}
		nextOrder := 0
		if maxOrder != nil {
			nextOrder = *maxOrder + 1
		}
		created, err = createCaseAt(tx, item, nextOrder, name)
		return err
	})
	if err != nil {
		return Case{}, err
	}
	return created, nil
}

// DuplicateCase 复制用例（含步骤与执行状态重置）。
func (s *Service) DuplicateCase(ctx context.Context, caseID string) (Case, error) {
	var created Case
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var source Case
		if err := tx.Where("id = ?", caseID).First(&source).Error; err != nil {
			return ErrNotFound
		}
		item, err := findTestItem(tx, source.TestItemID)
		if err != nil {
			return err
		}
		var maxOrder *int
		if err := tx.Model(&Case{}).Where("test_item_id = ?", source.TestItemID).
			Select("MAX(sort_order)").Scan(&maxOrder).Error; err != nil {
			return fmt.Errorf("查询用例排序失败: %w", err)
		}
		nextOrder := 0
		if maxOrder != nil {
			nextOrder = *maxOrder + 1
		}
		created, err = createCaseAt(tx, item, nextOrder, source.Name+"-副本")
		if err != nil {
			return err
		}
		if err := tx.Model(&Case{}).Where("id = ?", created.ID).Updates(map[string]any{
			"summary":       source.Summary,
			"init_text":     source.InitText,
			"prerequisites": source.Prerequisites,
			"designer_id":   source.DesignerID,
			"monitor_id":    source.MonitorID,
			"updated_at":    timeNow(),
		}).Error; err != nil {
			return fmt.Errorf("复制用例字段失败: %w", err)
		}

		var steps []CaseStep
		if err := tx.Where("test_case_id = ?", source.ID).
			Order("sort_order asc, created_at asc").Find(&steps).Error; err != nil {
			return fmt.Errorf("查询用例步骤失败: %w", err)
		}
		for _, step := range steps {
			if _, err := insertStep(tx, created.ID, step.ExpectText); err != nil {
				return err
			}
		}
		created, err = findCase(tx, created.ID)
		return err
	})
	if err != nil {
		return Case{}, err
	}
	return created, nil
}

func createCaseAt(tx *gorm.DB, item TestItem, sortOrder int, name string) (Case, error) {
	caseID, err := id.New()
	if err != nil {
		return Case{}, err
	}
	seq := sortOrder + 1
	now := time.Now()
	created := Case{
		ID:         caseID,
		ProjectID:  item.ProjectID,
		TestItemID: item.ID,
		Identifier: caseIdentifier(item.TypeCode, item.Suffix, seq),
		Seq:        seq,
		Name:       strings.TrimSpace(name),
		SortOrder:  sortOrder,
		Status:     "pending",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := tx.Create(&created).Error; err != nil {
		return Case{}, fmt.Errorf("创建用例失败: %w", err)
	}
	return created, nil
}

func createCase(tx *gorm.DB, item TestItem, name string, summary string) (Case, error) {
	created, err := createCaseAt(tx, item, 0, name)
	if err != nil {
		return Case{}, err
	}
	if summary != "" {
		if err := tx.Model(&Case{}).Where("id = ?", created.ID).
			Updates(map[string]any{"summary": summary, "updated_at": timeNow()}).Error; err != nil {
			return Case{}, fmt.Errorf("更新用例综述失败: %w", err)
		}
	}
	return findCase(tx, created.ID)
}

func findCase(tx *gorm.DB, caseID string) (Case, error) {
	var itemCase Case
	err := tx.Where("id = ?", caseID).First(&itemCase).Error
	if err != nil {
		return Case{}, ErrNotFound
	}
	return itemCase, nil
}

// UpdateCaseInput 用例行内更新入参；nil 表示不修改。
type UpdateCaseInput struct {
	Name              *string
	Summary           *string
	InitText          *string
	Prerequisites     *string
	DesignerID        *string
	TesterID          *string
	MonitorID         *string
	Notes             *string
	NotExecutedReason *string
	ClearExecDate     bool
}

// UpdateCase 行内更新用例字段。
func (s *Service) UpdateCase(ctx context.Context, caseID string, input UpdateCaseInput) (Case, error) {
	updates := map[string]any{"updated_at": timeNow()}
	if input.Name != nil {
		updates["name"] = strings.TrimSpace(*input.Name)
	}
	if input.Summary != nil {
		updates["summary"] = strings.TrimSpace(*input.Summary)
	}
	if input.InitText != nil {
		updates["init_text"] = strings.TrimSpace(*input.InitText)
	}
	if input.Prerequisites != nil {
		updates["prerequisites"] = strings.TrimSpace(*input.Prerequisites)
	}
	if input.DesignerID != nil {
		updates["designer_id"] = emptyToNil(*input.DesignerID)
	}
	if input.TesterID != nil {
		updates["tester_id"] = emptyToNil(*input.TesterID)
	}
	if input.MonitorID != nil {
		updates["monitor_id"] = emptyToNil(*input.MonitorID)
	}
	if input.Notes != nil {
		updates["notes"] = strings.TrimSpace(*input.Notes)
	}
	if input.NotExecutedReason != nil {
		updates["not_executed_reason"] = strings.TrimSpace(*input.NotExecutedReason)
	}
	if input.ClearExecDate {
		updates["exec_date"] = nil
	}

	if err := s.db.WithContext(ctx).Model(&Case{}).Where("id = ?", caseID).
		Updates(updates).Error; err != nil {
		return Case{}, fmt.Errorf("更新用例失败: %w", err)
	}
	return s.GetCase(ctx, caseID)
}

func emptyToNil(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

// SetCaseExecDate 显式设置执行时间。
func (s *Service) SetCaseExecDate(ctx context.Context, caseID string, execDate time.Time) error {
	if err := s.db.WithContext(ctx).Model(&Case{}).Where("id = ?", caseID).
		Updates(map[string]any{"exec_date": execDate, "updated_at": timeNow()}).Error; err != nil {
		return fmt.Errorf("更新执行时间失败: %w", err)
	}
	return nil
}

// DeleteCase 删除用例并重排剩余用例序号与标识。
func (s *Service) DeleteCase(ctx context.Context, caseID string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var itemCase Case
		if err := tx.Where("id = ?", caseID).First(&itemCase).Error; err != nil {
			return ErrNotFound
		}
		if err := tx.Where("id = ?", caseID).Delete(&Case{}).Error; err != nil {
			return fmt.Errorf("删除用例失败: %w", err)
		}
		return renumberCases(tx, itemCase.TestItemID)
	})
}

// MoveCase 把用例移动到目标测试项的目标位置（同项内排序 / 跨项移动）。
func (s *Service) MoveCase(ctx context.Context, caseID string, targetItemID string, targetIndex int) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var itemCase Case
		if err := tx.Where("id = ?", caseID).First(&itemCase).Error; err != nil {
			return ErrNotFound
		}
		targetItem, err := findTestItem(tx, targetItemID)
		if err != nil {
			return err
		}

		sourceItemID := itemCase.TestItemID
		if err := tx.Model(&Case{}).Where("id = ?", caseID).
			Updates(map[string]any{"test_item_id": targetItemID, "updated_at": timeNow()}).Error; err != nil {
			return fmt.Errorf("移动用例失败: %w", err)
		}

		var targetCases []Case
		if err := tx.Where("test_item_id = ?", targetItemID).
			Order("sort_order asc, created_at asc").Find(&targetCases).Error; err != nil {
			return fmt.Errorf("查询用例失败: %w", err)
		}

		ordered := make([]string, 0, len(targetCases))
		for _, candidate := range targetCases {
			if candidate.ID != caseID {
				ordered = append(ordered, candidate.ID)
			}
		}
		if targetIndex < 0 {
			targetIndex = 0
		}
		if targetIndex > len(ordered) {
			targetIndex = len(ordered)
		}
		ordered = append(ordered[:targetIndex], append([]string{caseID}, ordered[targetIndex:]...)...)

		// 两阶段重排：先写临时序号避开唯一约束，再写最终序号与标识。
		now := timeNow()
		for index, idValue := range ordered {
			if err := tx.Model(&Case{}).Where("id = ?", idValue).Updates(map[string]any{
				"sort_order": index,
				"seq":        -(index + 1),
				"updated_at": now,
			}).Error; err != nil {
				return fmt.Errorf("重排用例失败: %w", err)
			}
		}
		for index, idValue := range ordered {
			if err := tx.Model(&Case{}).Where("id = ?", idValue).Updates(map[string]any{
				"seq":        index + 1,
				"identifier": caseIdentifier(targetItem.TypeCode, targetItem.Suffix, index+1),
				"updated_at": now,
			}).Error; err != nil {
				return fmt.Errorf("重排用例失败: %w", err)
			}
		}

		if sourceItemID != targetItemID {
			if err := renumberCases(tx, sourceItemID); err != nil {
				return err
			}
		}
		return nil
	})
}
