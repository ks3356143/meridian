package testitems

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

var (
	// ErrCaseSelectionRequired 批量操作未选择用例。
	ErrCaseSelectionRequired = errors.New("请选择用例")
	// ErrNothingToAssign 批量操作没有提交任何字段。
	ErrNothingToAssign = errors.New("请至少选择一项要修改的内容")
	// ErrInvalidCaseStatus 用例状态不在三态枚举内。
	ErrInvalidCaseStatus = errors.New("用例状态不合法")
	// ErrInvalidExecDate 执行日期格式不合法。
	ErrInvalidExecDate = errors.New("执行日期格式应为 YYYY-MM-DD")
)

// BatchAssignCasesInput 批量指派入参；nil 表示不修改，空字符串表示清除。
type BatchAssignCasesInput struct {
	CaseIDs  []string
	TesterID *string
	Status   *string
	ExecDate *string
}

// BatchAssignCases 在同一测试项内批量设置测试人员、执行状态和执行日期。
func (s *Service) BatchAssignCases(ctx context.Context, testItemID string, input BatchAssignCasesInput) ([]Case, error) {
	ids := make([]string, 0, len(input.CaseIDs))
	seen := make(map[string]struct{}, len(input.CaseIDs))
	for _, raw := range input.CaseIDs {
		caseID := strings.TrimSpace(raw)
		if caseID == "" {
			continue
		}
		if _, exists := seen[caseID]; exists {
			continue
		}
		seen[caseID] = struct{}{}
		ids = append(ids, caseID)
	}
	if len(ids) == 0 {
		return nil, ErrCaseSelectionRequired
	}

	updates := map[string]any{"updated_at": time.Now()}
	if input.TesterID != nil {
		updates["tester_id"] = emptyToNil(*input.TesterID)
	}
	if input.Status != nil {
		status := strings.TrimSpace(*input.Status)
		if status != "pending" && status != "passed" && status != "failed" {
			return nil, ErrInvalidCaseStatus
		}
		updates["status"] = status
	}
	if input.ExecDate != nil {
		raw := strings.TrimSpace(*input.ExecDate)
		if raw == "" {
			updates["exec_date"] = nil
		} else {
			parsed, err := time.ParseInLocation("2006-01-02", raw, time.Local)
			if err != nil {
				return nil, ErrInvalidExecDate
			}
			updates["exec_date"] = parsed
		}
	}
	if len(updates) == 1 {
		return nil, ErrNothingToAssign
	}

	var updated []Case
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if _, err := findTestItem(tx, testItemID); err != nil {
			return err
		}
		var count int64
		if err := tx.Model(&Case{}).
			Where("test_item_id = ? AND id IN ?", testItemID, ids).
			Count(&count).Error; err != nil {
			return fmt.Errorf("查询批量用例失败: %w", err)
		}
		if count != int64(len(ids)) {
			return ErrNotFound
		}
		if err := tx.Model(&Case{}).
			Where("test_item_id = ? AND id IN ?", testItemID, ids).
			Updates(updates).Error; err != nil {
			return fmt.Errorf("批量更新用例失败: %w", err)
		}
		return tx.Where("id IN ?", ids).Order("sort_order asc, created_at asc").Find(&updated).Error
	})
	if err != nil {
		return nil, err
	}
	return updated, nil
}
