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

// CreateFolderInput 新建文件夹入参。
type CreateFolderInput struct {
	ProjectID string
	RoundID   string // 留空时使用当前轮次
	TypeCode  string
	ParentID  *string
	Name      string
}

// CreateFolder 新建文件夹（限同类型容器内）。
func (s *Service) CreateFolder(ctx context.Context, input CreateFolderInput) (Folder, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return Folder{}, ErrNameRequired
	}

	var created Folder
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		round, err := resolveRound(ctx, tx, input.ProjectID, input.RoundID)
		if err != nil {
			return err
		}
		input.RoundID = round.ID
		itemType, err := findItemType(tx, input.TypeCode)
		if err != nil {
			return err
		}
		if input.ParentID != nil {
			var parent Folder
			if err := tx.Where("id = ? AND project_id = ? AND round_id = ? AND type_code = ?",
				*input.ParentID, input.ProjectID, input.RoundID, itemType.Code).First(&parent).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return fmt.Errorf("%w：父文件夹不存在或不属于当前轮次", ErrRoundMismatch)
				}
				return fmt.Errorf("查询父文件夹失败: %w", err)
			}
		}
		var maxOrder *int
		query := tx.Model(&Folder{}).
			Where("project_id = ? AND round_id = ? AND type_code = ?", input.ProjectID, input.RoundID, itemType.Code)
		if input.ParentID == nil {
			query = query.Where("parent_id IS NULL")
		} else {
			query = query.Where("parent_id = ?", *input.ParentID)
		}
		if err := query.Select("MAX(sort_order)").Scan(&maxOrder).Error; err != nil {
			return fmt.Errorf("查询排序失败: %w", err)
		}
		sortOrder := 0
		if maxOrder != nil {
			sortOrder = *maxOrder + 1
		}

		folderID, err := id.New()
		if err != nil {
			return err
		}
		now := time.Now()
		created = Folder{
			ID:        folderID,
			ProjectID: input.ProjectID,
			RoundID:   input.RoundID,
			TypeCode:  itemType.Code,
			ParentID:  input.ParentID,
			Name:      name,
			SortOrder: sortOrder,
			CreatedAt: now,
			UpdatedAt: now,
		}
		if err := tx.Create(&created).Error; err != nil {
			return fmt.Errorf("创建文件夹失败: %w", err)
		}
		return nil
	})
	if err != nil {
		return Folder{}, err
	}
	return created, nil
}

// ListFolders 返回项目内文件夹（跨轮查询；兼容既有调用）。
func (s *Service) ListFolders(ctx context.Context, projectID string) ([]Folder, error) {
	return s.listFolders(ctx, projectID, "")
}

// ListFoldersByRound 返回指定轮次内的文件夹。
func (s *Service) ListFoldersByRound(ctx context.Context, projectID, roundID string) ([]Folder, error) {
	return s.listFolders(ctx, projectID, roundID)
}

func (s *Service) listFolders(ctx context.Context, projectID, roundID string) ([]Folder, error) {
	query := s.db.WithContext(ctx).Where("project_id = ?", projectID)
	if roundID != "" {
		query = query.Where("round_id = ?", roundID)
	}
	var folders []Folder
	if err := query.Order("type_code asc, sort_order asc, created_at asc").Find(&folders).Error; err != nil {
		return nil, fmt.Errorf("查询文件夹失败: %w", err)
	}
	return folders, nil
}

// UpdateFolder 重命名文件夹（类型归属与排序不变）。
func (s *Service) UpdateFolder(ctx context.Context, folderID string, name string) (Folder, error) {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return Folder{}, ErrNameRequired
	}
	var updated Folder
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ?", folderID).First(&updated).Error; err != nil {
			return ErrNotFound
		}
		now := time.Now()
		if err := tx.Model(&Folder{}).Where("id = ?", folderID).Updates(map[string]any{
			"name":       trimmed,
			"updated_at": now,
		}).Error; err != nil {
			return fmt.Errorf("重命名文件夹失败: %w", err)
		}
		updated.Name = trimmed
		updated.UpdatedAt = now
		return nil
	})
	if err != nil {
		return Folder{}, err
	}
	return updated, nil
}

// DeleteFolder 删除文件夹：其下测试项移到同类型根目录（folder_id 置空），不删除测试项。
func (s *Service) DeleteFolder(ctx context.Context, folderID string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var folder Folder
		if err := tx.Where("id = ?", folderID).First(&folder).Error; err != nil {
			return ErrNotFound
		}
		if err := tx.Model(&TestItem{}).Where("folder_id = ?", folderID).Updates(map[string]any{
			"folder_id":  nil,
			"updated_at": time.Now(),
		}).Error; err != nil {
			return fmt.Errorf("移出文件夹内测试项失败: %w", err)
		}
		if err := tx.Where("id = ?", folderID).Delete(&Folder{}).Error; err != nil {
			return fmt.Errorf("删除文件夹失败: %w", err)
		}
		return nil
	})
}

// MoveItem 拖拽落位：移到同类型文件夹（folderID 为 nil 表示类型根目录），并重排该容器内顺序。
func (s *Service) MoveItem(ctx context.Context, itemID string, folderID *string, targetIndex int) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var item TestItem
		if err := tx.Where("id = ?", itemID).First(&item).Error; err != nil {
			return ErrNotFound
		}
		if folderID != nil {
			var folder Folder
			if err := tx.Where("id = ?", *folderID).First(&folder).Error; err != nil {
				return ErrNotFound
			}
			if folder.ProjectID != item.ProjectID || folder.RoundID != item.RoundID || folder.TypeCode != item.TypeCode {
				return ErrFolderMismatch
			}
		}
		if err := tx.Model(&TestItem{}).Where("id = ?", itemID).Updates(map[string]any{
			"folder_id":  folderID,
			"updated_at": time.Now(),
		}).Error; err != nil {
			return fmt.Errorf("移动测试项失败: %w", err)
		}

		query := tx.Where("project_id = ? AND round_id = ? AND type_code = ?", item.ProjectID, item.RoundID, item.TypeCode)
		if folderID == nil {
			query = query.Where("folder_id IS NULL")
		} else {
			query = query.Where("folder_id = ?", *folderID)
		}
		var siblings []TestItem
		if err := query.Order("sort_order asc, created_at asc").Find(&siblings).Error; err != nil {
			return fmt.Errorf("查询同容器测试项失败: %w", err)
		}
		ordered := make([]string, 0, len(siblings))
		for _, sibling := range siblings {
			if sibling.ID != itemID {
				ordered = append(ordered, sibling.ID)
			}
		}
		if targetIndex < 0 {
			targetIndex = 0
		}
		if targetIndex > len(ordered) {
			targetIndex = len(ordered)
		}
		ordered = append(ordered[:targetIndex], append([]string{itemID}, ordered[targetIndex:]...)...)

		now := time.Now()
		for index, siblingID := range ordered {
			if err := tx.Model(&TestItem{}).Where("id = ?", siblingID).Updates(map[string]any{
				"sort_order": index,
				"updated_at": now,
			}).Error; err != nil {
				return fmt.Errorf("重排测试项失败: %w", err)
			}
		}
		return nil
	})
}
