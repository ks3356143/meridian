package testitems

import (
	"context"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"chenmeridian/internal/id"
)

// ListSubItems 返回测试项内的测试子项（按序号）。
func (s *Service) ListSubItems(ctx context.Context, testItemID string) ([]SubItem, error) {
	var items []SubItem
	if err := s.db.WithContext(ctx).Where("test_item_id = ?", testItemID).
		Order("sort_order asc, created_at asc").Find(&items).Error; err != nil {
		return nil, fmt.Errorf("查询测试子项失败: %w", err)
	}
	return items, nil
}

// CreateSubItem 追加一个测试子项（序号自动排到末尾）。
func (s *Service) CreateSubItem(ctx context.Context, testItemID string, name string) (SubItem, error) {
	var created SubItem
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if _, err := findTestItem(tx, testItemID); err != nil {
			return err
		}
		next, err := nextSubItemOrder(tx, testItemID)
		if err != nil {
			return err
		}
		subID, err := id.New()
		if err != nil {
			return err
		}
		now := time.Now()
		created = SubItem{
			ID:         subID,
			TestItemID: testItemID,
			Seq:        next + 1,
			Name:       strings.TrimSpace(name),
			SortOrder:  next,
			CreatedAt:  now,
			UpdatedAt:  now,
		}
		if err := tx.Create(&created).Error; err != nil {
			return fmt.Errorf("创建测试子项失败: %w", err)
		}
		return nil
	})
	if err != nil {
		return SubItem{}, err
	}
	return created, nil
}

func nextSubItemOrder(tx *gorm.DB, testItemID string) (int, error) {
	var maxOrder *int
	if err := tx.Model(&SubItem{}).Where("test_item_id = ?", testItemID).
		Select("MAX(sort_order)").Scan(&maxOrder).Error; err != nil {
		return 0, fmt.Errorf("查询子项排序失败: %w", err)
	}
	if maxOrder == nil {
		return 0, nil
	}
	return *maxOrder + 1, nil
}

// CopySubItem 复制指定子项到末尾（子项操作/预期富文本由调用方按 block_key 复制）。
func (s *Service) CopySubItem(ctx context.Context, subItemID string) (SubItem, error) {
	var created SubItem
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var source SubItem
		if err := tx.Where("id = ?", subItemID).First(&source).Error; err != nil {
			return ErrNotFound
		}
		next, err := nextSubItemOrder(tx, source.TestItemID)
		if err != nil {
			return err
		}
		subID, err := id.New()
		if err != nil {
			return err
		}
		now := time.Now()
		created = SubItem{
			ID:          subID,
			TestItemID:  source.TestItemID,
			Seq:         next + 1,
			Name:        source.Name,
			Description: source.Description,
			Ops:         source.Ops,
			Expected:    source.Expected,
			SortOrder:   next,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		if err := tx.Create(&created).Error; err != nil {
			return fmt.Errorf("复制测试子项失败: %w", err)
		}
		return nil
	})
	if err != nil {
		return SubItem{}, err
	}
	return created, nil
}

// UpdateSubItemInput 子项行内更新入参；nil 字段表示不修改。
type UpdateSubItemInput struct {
	Name        *string
	Description *string
	Ops         *string
	Expected    *string
}

// UpdateSubItem 更新子项名称、描述、操作步骤与通过准则。
func (s *Service) UpdateSubItem(ctx context.Context, subItemID string, input UpdateSubItemInput) (SubItem, error) {
	updates := map[string]any{"updated_at": timeNow()}
	if input.Name != nil {
		updates["name"] = strings.TrimSpace(*input.Name)
	}
	if input.Description != nil {
		updates["description"] = strings.TrimSpace(*input.Description)
	}
	if input.Ops != nil {
		updates["ops"] = strings.TrimSpace(*input.Ops)
	}
	if input.Expected != nil {
		updates["expected"] = strings.TrimSpace(*input.Expected)
	}
	if err := s.db.WithContext(ctx).Model(&SubItem{}).Where("id = ?", subItemID).
		Updates(updates).Error; err != nil {
		return SubItem{}, fmt.Errorf("更新测试子项失败: %w", err)
	}

	var updated SubItem
	if err := s.db.WithContext(ctx).Where("id = ?", subItemID).First(&updated).Error; err != nil {
		return SubItem{}, ErrNotFound
	}
	return updated, nil
}

// DeleteSubItem 删除子项并重排剩余序号。
func (s *Service) DeleteSubItem(ctx context.Context, subItemID string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var sub SubItem
		if err := tx.Where("id = ?", subItemID).First(&sub).Error; err != nil {
			return ErrNotFound
		}
		if err := tx.Where("id = ?", subItemID).Delete(&SubItem{}).Error; err != nil {
			return fmt.Errorf("删除测试子项失败: %w", err)
		}
		return renumberSubItems(tx, sub.TestItemID)
	})
}

// MoveSubItem 把子项移动到目标位置（0 起）。
func (s *Service) MoveSubItem(ctx context.Context, subItemID string, targetIndex int) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var sub SubItem
		if err := tx.Where("id = ?", subItemID).First(&sub).Error; err != nil {
			return ErrNotFound
		}
		var items []SubItem
		if err := tx.Where("test_item_id = ?", sub.TestItemID).
			Order("sort_order asc, created_at asc").Find(&items).Error; err != nil {
			return fmt.Errorf("查询测试子项失败: %w", err)
		}

		from := -1
		for index, item := range items {
			if item.ID == subItemID {
				from = index
				break
			}
		}
		if from < 0 {
			return ErrNotFound
		}
		if targetIndex < 0 {
			targetIndex = 0
		}
		if targetIndex > len(items)-1 {
			targetIndex = len(items) - 1
		}
		if from == targetIndex {
			return nil
		}

		moved := items[from]
		rest := append(append([]SubItem{}, items[:from]...), items[from+1:]...)
		ordered := append(append([]SubItem{}, rest[:targetIndex]...), moved)
		ordered = append(ordered, rest[targetIndex:]...)

		// 两阶段重排：先写临时序号避开 (test_item_id, seq) 唯一约束，再写最终序号。
		now := timeNow()
		for index, item := range ordered {
			if err := tx.Model(&SubItem{}).Where("id = ?", item.ID).Updates(map[string]any{
				"sort_order": index,
				"seq":        -(index + 1),
				"updated_at": now,
			}).Error; err != nil {
				return fmt.Errorf("更新测试子项排序失败: %w", err)
			}
		}
		for index, item := range ordered {
			if err := tx.Model(&SubItem{}).Where("id = ?", item.ID).Updates(map[string]any{
				"seq":        index + 1,
				"updated_at": now,
			}).Error; err != nil {
				return fmt.Errorf("更新测试子项排序失败: %w", err)
			}
		}
		return nil
	})
}
