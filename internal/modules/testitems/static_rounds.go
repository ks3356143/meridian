package testitems

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"chenmeridian/internal/id"
)

// ImportPreviousRoundFailedChecks 把上一轮 DC 不通过项补入当前轮审查单。
func (s *Service) ImportPreviousRoundFailedChecks(ctx context.Context, testItemID string) (StaticWorkbench, error) {
	item, kind, err := s.staticItemKind(ctx, testItemID)
	if err != nil {
		return StaticWorkbench{}, err
	}
	if kind != "DC" {
		return StaticWorkbench{}, ErrStaticInvalidState
	}
	previousItem, err := s.previousStaticItem(ctx, item)
	if err != nil {
		return StaticWorkbench{}, err
	}
	var previousRow staticWorkbenchRow
	err = s.db.WithContext(ctx).Where("test_item_id = ?", previousItem.ID).First(&previousRow).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return StaticWorkbench{}, ErrPreviousStaticItemMissing
	}
	if err != nil {
		return StaticWorkbench{}, fmt.Errorf("查询上一轮静态工作台失败: %w", err)
	}
	var previousState StaticState
	if err := json.Unmarshal([]byte(previousRow.Payload), &previousState); err != nil {
		return StaticWorkbench{}, fmt.Errorf("解析上一轮静态工作台失败: %w", err)
	}

	current, err := s.GetStaticWorkbench(ctx, testItemID)
	if err != nil {
		return StaticWorkbench{}, err
	}
	imported := carryFailedChecks(&current.State, &previousState)
	if imported == 0 {
		return current, nil
	}
	return s.SaveStaticWorkbench(ctx, testItemID, current.Version, current.State)
}

// carryFailedChecks 将上一轮不通过项标记到当前轮；返回新带入数量。
func carryFailedChecks(current, previous *StaticState) int {
	imported := 0
	for _, previousSheet := range previous.ReviewSheets {
		for _, previousCheck := range previousSheet.Checks {
			if previousCheck.Result != "failed" {
				continue
			}
			for sheetIndex := range current.ReviewSheets {
				sheet := &current.ReviewSheets[sheetIndex]
				// 新数据按审查文档类型匹配；两边都有类型但不同则绝不串单。
				sameDocument := sheet.DocumentType != "" && sheet.DocumentType == previousSheet.DocumentType
				if !sameDocument {
					if sheet.DocumentType != "" && previousSheet.DocumentType != "" {
						continue
					}
					if sheet.TemplateCode != previousSheet.TemplateCode &&
						reviewSheetNameKey(sheet.Name) != reviewSheetNameKey(previousSheet.Name) {
						continue
					}
				}
				for checkIndex := range sheet.Checks {
					check := &sheet.Checks[checkIndex]
					if check.Title != previousCheck.Title || check.CarriedFromPrevious {
						continue
					}
					// 本轮已经填过结果、备注、截图或问题单时不覆盖人工记录。
					if check.Result == "failed" || check.Result == "na" ||
						strings.TrimSpace(check.Notes) != "" || len(check.Images) > 0 || check.IssueID != "" {
						continue
					}
					// 带入只作历史参考：默认通过，不影响本轮判定。
					check.CarriedFromPrevious = true
					check.PreviousNote = previousCheck.Notes
					if check.PreviousNote == "" {
						check.PreviousNote = previousCheck.PreviousNote
					}
					check.PreviousImages = append([]string{}, previousCheck.Images...)
					if len(check.PreviousImages) == 0 {
						check.PreviousImages = append([]string{}, previousCheck.PreviousImages...)
					}
					check.Result = "passed"
					check.Notes = ""
					check.Images = []string{}
					check.IssueID = ""
					imported++
				}
			}
		}
	}
	return imported
}

// previousStaticItem 返回上一轮同类型静态测试项。
func (s *Service) previousStaticItem(ctx context.Context, item TestItem) (TestItem, error) {
	var currentRound Round
	if err := s.db.WithContext(ctx).Where("id = ?", item.RoundID).First(&currentRound).Error; err != nil {
		return TestItem{}, ErrPreviousStaticItemMissing
	}
	if currentRound.RoundNumber <= 1 {
		return TestItem{}, ErrPreviousStaticItemMissing
	}
	var previousRound Round
	err := s.db.WithContext(ctx).
		Where("project_id = ? AND round_number = ?", item.ProjectID, currentRound.RoundNumber-1).
		First(&previousRound).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return TestItem{}, ErrPreviousStaticItemMissing
	}
	if err != nil {
		return TestItem{}, fmt.Errorf("查询上一轮失败: %w", err)
	}
	var previousItem TestItem
	err = s.db.WithContext(ctx).
		Where("project_id = ? AND round_id = ? AND type_code = ?", item.ProjectID, previousRound.ID, item.TypeCode).
		First(&previousItem).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return TestItem{}, ErrPreviousStaticItemMissing
	}
	if err != nil {
		return TestItem{}, fmt.Errorf("查询上一轮静态测试项失败: %w", err)
	}
	return previousItem, nil
}

// copyStaticWorkbenchTx 复制静态工作台到新轮次：结果默认通过，上轮不通过项标记带入。
func (s *Service) copyStaticWorkbenchTx(tx *gorm.DB, sourceItem TestItem, newItemID, platform string, sheets []StaticSheetTemplate, importHistory bool) error {
	var sourceRow staticWorkbenchRow
	err := tx.Where("test_item_id = ?", sourceItem.ID).First(&sourceRow).Error
	var state StaticState
	if errors.Is(err, gorm.ErrRecordNotFound) {
		initial, initErr := defaultStaticState(newItemID, sourceItem.TypeCode, platform, sheets)
		if initErr != nil {
			return initErr
		}
		state = initial
	} else if err != nil {
		return fmt.Errorf("查询来源静态工作台失败: %w", err)
	} else if unmarshalErr := json.Unmarshal([]byte(sourceRow.Payload), &state); unmarshalErr != nil {
		return fmt.Errorf("解析来源静态工作台失败: %w", unmarshalErr)
	}

	if sourceItem.TypeCode == "DC" {
		state.Documents = copyStaticDocuments(state.Documents)
		for sheetIndex := range state.ReviewSheets {
			sheet := &state.ReviewSheets[sheetIndex]
			sheet.ID, _ = id.New()
			for checkIndex := range sheet.Checks {
				check := &sheet.Checks[checkIndex]
				check.ID, _ = id.New()
				// 默认不带历史；向导勾选后只把上轮“不通过”的记录作为历史参考。
				if importHistory && check.Result == "failed" {
					check.CarriedFromPrevious = true
					if check.Notes != "" {
						check.PreviousNote = check.Notes
					}
					if len(check.Images) > 0 {
						check.PreviousImages = append([]string{}, check.Images...)
					}
				} else {
					check.CarriedFromPrevious = false
					check.PreviousNote = ""
					check.PreviousImages = []string{}
				}
				check.Result = "passed"
				check.Notes = ""
				check.Images = []string{}
				check.IssueID = ""
			}
		}
	}

	payload, err := json.Marshal(state)
	if err != nil {
		return fmt.Errorf("序列化静态工作台失败: %w", err)
	}
	now := time.Now()
	row := staticWorkbenchRow{
		TestItemID: newItemID, ProjectID: sourceItem.ProjectID, Kind: sourceItem.TypeCode,
		Payload: string(payload), Version: 1, CreatedAt: now, UpdatedAt: now,
	}
	if err := tx.Create(&row).Error; err != nil {
		return fmt.Errorf("复制静态工作台失败: %w", err)
	}
	return nil
}

func copyStaticDocuments(documents []StaticDocument) []StaticDocument {
	copied := make([]StaticDocument, 0, len(documents))
	for _, doc := range documents {
		docID, err := id.New()
		if err != nil {
			continue
		}
		doc.ID = docID
		copied = append(copied, doc)
	}
	return copied
}

// previousFailedChecks 统计上一轮 DC 不通过项数量，用于壳用例复审话术。
func previousFailedCheckCount(tx *gorm.DB, sourceItemID string) int {
	var row staticWorkbenchRow
	if err := tx.Where("test_item_id = ?", sourceItemID).First(&row).Error; err != nil {
		return 0
	}
	var state StaticState
	if err := json.Unmarshal([]byte(row.Payload), &state); err != nil {
		return 0
	}
	count := 0
	for _, sheet := range state.ReviewSheets {
		for _, check := range sheet.Checks {
			if check.Result == "failed" {
				count++
			}
		}
	}
	return count
}

func reviewCaseSummary(base string, failed int, autoSummary string) string {
	const generated = "前一轮文档问题全部解决"
	trimmed := strings.TrimSpace(base)
	auto := strings.TrimSpace(autoSummary)
	// 空文案、上一轮自动文案或测试项默认描述都视为自动生成，可覆盖；人工综述保留。
	isAuto := trimmed == "" || trimmed == generated || (auto != "" && trimmed == auto)
	if failed <= 0 {
		if isAuto {
			return ""
		}
		return trimmed
	}
	if isAuto {
		return generated
	}
	return trimmed
}
