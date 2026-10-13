package testitems

import (
	"fmt"
	"strings"

	pinyinlib "github.com/mozillazg/go-pinyin"
	"gorm.io/gorm"
)

const (
	identifierSuffixMax = 4
	identifierFallback  = "XQ"
	identifierAlphabet  = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
)

// SuffixSeed 由名称生成标识后缀种子：拼音首字母，最多 4 位。
func SuffixSeed(name string) string {
	args := pinyinlib.NewArgs()
	args.Style = pinyinlib.FirstLetter
	args.Fallback = func(r rune, _ pinyinlib.Args) []string {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			return []string{strings.ToUpper(string(r))}
		}
		return nil
	}

	var seed strings.Builder
	for _, values := range pinyinlib.Pinyin(name, args) {
		if len(values) == 0 || values[0] == "" {
			continue
		}
		seed.WriteString(strings.ToUpper(values[0][:1]))
		if seed.Len() >= identifierSuffixMax {
			break
		}
	}
	if seed.Len() == 0 {
		return identifierFallback
	}
	return seed.String()
}

func testItemIdentifier(typeCode string, suffix string) string {
	return "XQ_" + typeCode + "_" + suffix
}

func caseIdentifier(typeCode string, itemSuffix string, seq int) string {
	return fmt.Sprintf("YL_%s_%s_%03d", typeCode, itemSuffix, seq)
}

// uniqueItemSuffix 生成项目内唯一的后缀；冲突时保留前 3 位并逐位替换尾字符。
func uniqueItemSuffix(tx *gorm.DB, projectID string, typeCode string, name string) (string, bool, error) {
	seed := SuffixSeed(name)
	free, err := itemSuffixFree(tx, projectID, typeCode, seed)
	if err != nil {
		return "", false, err
	}
	if free {
		return seed, false, nil
	}

	base := seed
	if len(base) > 3 {
		base = base[:3]
	}
	for len(base) < 3 {
		base += "X"
	}
	for _, ch := range identifierAlphabet {
		candidate := base + string(ch)
		free, err := itemSuffixFree(tx, projectID, typeCode, candidate)
		if err != nil {
			return "", false, err
		}
		if free {
			return candidate, true, nil
		}
	}
	return "", false, ErrSuffixExhausted
}

func itemSuffixFree(tx *gorm.DB, projectID string, typeCode string, suffix string) (bool, error) {
	var count int64
	err := tx.Model(&TestItem{}).
		Where("project_id = ? AND identifier = ?", projectID, testItemIdentifier(typeCode, suffix)).
		Count(&count).Error
	return count == 0, err
}

// renumberCases 重排测试项内用例序号、标识与排序（删除/移动/改后缀后调用）。
func renumberCases(tx *gorm.DB, testItemID string) error {
	item, err := findTestItem(tx, testItemID)
	if err != nil {
		return err
	}

	var cases []Case
	if err := tx.Where("test_item_id = ?", testItemID).
		Order("sort_order asc, created_at asc").Find(&cases).Error; err != nil {
		return fmt.Errorf("查询用例失败: %w", err)
	}

	// 两阶段重排：先写入临时序号避开 (test_item_id, seq) 唯一约束，再写最终序号。
	now := timeNow()
	for index, itemCase := range cases {
		if err := tx.Model(&Case{}).Where("id = ?", itemCase.ID).Updates(map[string]any{
			"seq":        -(index + 1),
			"sort_order": index,
			"updated_at": now,
		}).Error; err != nil {
			return fmt.Errorf("重排用例失败: %w", err)
		}
	}
	for index, itemCase := range cases {
		seq := index + 1
		if err := tx.Model(&Case{}).Where("id = ?", itemCase.ID).Updates(map[string]any{
			"seq":        seq,
			"identifier": caseIdentifier(item.TypeCode, item.Suffix, seq),
			"updated_at": now,
		}).Error; err != nil {
			return fmt.Errorf("重排用例失败: %w", err)
		}
	}
	return nil
}

// renumberSubItems 重排子项序号与排序。
func renumberSubItems(tx *gorm.DB, testItemID string) error {
	var items []SubItem
	if err := tx.Where("test_item_id = ?", testItemID).
		Order("sort_order asc, created_at asc").Find(&items).Error; err != nil {
		return fmt.Errorf("查询测试子项失败: %w", err)
	}

	now := timeNow()
	for index, sub := range items {
		if err := tx.Model(&SubItem{}).Where("id = ?", sub.ID).Updates(map[string]any{
			"seq":        -(index + 1),
			"sort_order": index,
			"updated_at": now,
		}).Error; err != nil {
			return fmt.Errorf("重排测试子项失败: %w", err)
		}
	}
	for index, sub := range items {
		if err := tx.Model(&SubItem{}).Where("id = ?", sub.ID).Updates(map[string]any{
			"seq":        index + 1,
			"updated_at": now,
		}).Error; err != nil {
			return fmt.Errorf("重排测试子项失败: %w", err)
		}
	}
	return nil
}

// renumberSteps 重排步骤序号与排序。
func renumberSteps(tx *gorm.DB, testCaseID string) error {
	var steps []CaseStep
	if err := tx.Where("test_case_id = ?", testCaseID).
		Order("sort_order asc, created_at asc").Find(&steps).Error; err != nil {
		return fmt.Errorf("查询用例步骤失败: %w", err)
	}

	now := timeNow()
	for index, step := range steps {
		if err := tx.Model(&CaseStep{}).Where("id = ?", step.ID).Updates(map[string]any{
			"seq":        -(index + 1),
			"sort_order": index,
			"updated_at": now,
		}).Error; err != nil {
			return fmt.Errorf("重排用例步骤失败: %w", err)
		}
	}
	for index, step := range steps {
		if err := tx.Model(&CaseStep{}).Where("id = ?", step.ID).Updates(map[string]any{
			"seq":        index + 1,
			"updated_at": now,
		}).Error; err != nil {
			return fmt.Errorf("重排用例步骤失败: %w", err)
		}
	}
	return nil
}
