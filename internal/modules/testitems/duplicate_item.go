package testitems

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"

	"chenmeridian/internal/id"
)

// DuplicateItem 复制新增测试项：复制内容字段与子项，标识按"-副本"重新生成；副本紧跟在原件之后。
// 追踪关系与"隐含需求"标记不复制（新项需要自己的追踪决策）；静态类型不允许复制。
func (s *Service) DuplicateItem(ctx context.Context, testItemID string) (TestItem, error) {
	var created TestItem
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var source TestItem
		if err := tx.Where("id = ?", testItemID).First(&source).Error; err != nil {
			return ErrNotFound
		}
		itemType, err := findItemType(tx, source.TypeCode)
		if err != nil {
			return err
		}
		if itemType.IsStatic {
			return ErrStaticTypeDuplicate
		}
		suffix, _, err := uniqueItemSuffix(tx, source.ProjectID, source.RoundID, source.TypeCode, source.Name+"-副本")
		if err != nil {
			return err
		}
		itemID, err := id.New()
		if err != nil {
			return err
		}
		now := time.Now()
		created = TestItem{
			ID:           itemID,
			ProjectID:    source.ProjectID,
			RoundID:      source.RoundID,
			TypeCode:     source.TypeCode,
			Identifier:   testItemIdentifier(source.TypeCode, suffix),
			Suffix:       suffix,
			Name:         source.Name + "-副本",
			Priority:     source.Priority,
			FolderID:     source.FolderID,
			SortOrder:    source.SortOrder + 1,
			Description:  source.Description,
			Adequacy:     source.Adequacy,
			PassCriteria: source.PassCriteria,
			CreatedAt:    now,
			UpdatedAt:    now,
		}
		if err := tx.Create(&created).Error; err != nil {
			return fmt.Errorf("复制测试项失败: %w", err)
		}
		moveQuery := tx.Model(&TestItem{}).
			Where("project_id = ? AND round_id = ? AND type_code = ? AND id <> ? AND sort_order > ?",
				source.ProjectID, source.RoundID, source.TypeCode, itemID, source.SortOrder)
		if source.FolderID == nil {
			moveQuery = moveQuery.Where("folder_id IS NULL")
		} else {
			moveQuery = moveQuery.Where("folder_id = ?", *source.FolderID)
		}
		if err := moveQuery.Update("sort_order", gorm.Expr("sort_order + 1")).Error; err != nil {
			return fmt.Errorf("调整复制项排序失败: %w", err)
		}
		var subs []SubItem
		if err := tx.Where("test_item_id = ?", source.ID).
			Order("sort_order asc, created_at asc").Find(&subs).Error; err != nil {
			return fmt.Errorf("查询测试子项失败: %w", err)
		}
		for index, sub := range subs {
			subID, err := id.New()
			if err != nil {
				return err
			}
			copied := SubItem{
				ID:          subID,
				TestItemID:  itemID,
				Seq:         index + 1,
				Name:        sub.Name,
				Description: sub.Description,
				Ops:         sub.Ops,
				Expected:    sub.Expected,
				SortOrder:   index,
				CreatedAt:   now,
				UpdatedAt:   now,
			}
			if err := tx.Create(&copied).Error; err != nil {
				return fmt.Errorf("复制测试子项失败: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		return TestItem{}, err
	}
	return created, nil
}
