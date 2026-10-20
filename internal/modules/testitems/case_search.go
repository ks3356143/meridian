package testitems

import (
	"context"
	"fmt"
	"strings"

	"chenmeridian/internal/modules/contentblocks"
)

// CaseSearchHit 测试项内查找结果：用例字段命中或步骤字段命中。
type CaseSearchHit struct {
	Kind           string `json:"kind"`
	CaseID         string `json:"caseId"`
	CaseIdentifier string `json:"caseIdentifier"`
	CaseName       string `json:"caseName"`
	Field          string `json:"field"`
	Snippet        string `json:"snippet"`
	StepID         string `json:"stepId,omitempty"`
	StepSeq        int    `json:"stepSeq,omitempty"`
}

// SearchCases 在当前测试项内查找用例正文与步骤（含富文本纯文本快照）。
func (s *Service) SearchCases(ctx context.Context, testItemID, query string) ([]CaseSearchHit, error) {
	keyword := strings.TrimSpace(query)
	if keyword == "" {
		return []CaseSearchHit{}, nil
	}
	if _, err := s.GetTestItem(ctx, testItemID); err != nil {
		return nil, err
	}

	var cases []Case
	if err := s.db.WithContext(ctx).Where("test_item_id = ?", testItemID).
		Order("sort_order asc, created_at asc").Find(&cases).Error; err != nil {
		return nil, fmt.Errorf("查询待搜索用例失败: %w", err)
	}
	if len(cases) == 0 {
		return []CaseSearchHit{}, nil
	}

	hits := make([]CaseSearchHit, 0, 16)
	caseByID := make(map[string]Case, len(cases))
	caseIDs := make([]string, 0, len(cases))
	for _, itemCase := range cases {
		caseByID[itemCase.ID] = itemCase
		caseIDs = append(caseIDs, itemCase.ID)
		fields := []struct {
			label string
			value string
		}{
			{"用例名称", itemCase.Name},
			{"用例综述", itemCase.Summary},
			{"用例初始化", itemCase.InitText},
			{"前提和约束", itemCase.Prerequisites},
			{"终止条件", itemCase.TerminationText},
			{"通过准则", itemCase.PassCriteria},
		}
		for _, field := range fields {
			if containsSearch(field.value, keyword) {
				hits = append(hits, CaseSearchHit{
					Kind:           "case",
					CaseID:         itemCase.ID,
					CaseIdentifier: itemCase.Identifier,
					CaseName:       itemCase.Name,
					Field:          field.label,
					Snippet:        searchSnippet(field.value, keyword),
				})
				break
			}
		}
	}

	var steps []CaseStep
	if err := s.db.WithContext(ctx).Where("test_case_id IN ?", caseIDs).
		Order("test_case_id asc, sort_order asc, created_at asc").Find(&steps).Error; err != nil {
		return nil, fmt.Errorf("查询待搜索步骤失败: %w", err)
	}
	blocksByStep := make(map[string]map[string]string)
	if len(steps) > 0 {
		var blocks []contentblocks.ContentBlock
		if err := s.db.WithContext(ctx).
			Where("owner_type = ? AND owner_id IN ? AND block_key LIKE ?",
				contentblocks.OwnerTypeTestCase, caseIDs, "step.%").
			Find(&blocks).Error; err != nil {
			return nil, fmt.Errorf("查询步骤正文失败: %w", err)
		}
		for _, block := range blocks {
			stepID := stepIDFromBlockKey(block.BlockKey)
			if stepID == "" || strings.TrimSpace(block.PlainText) == "" {
				continue
			}
			if blocksByStep[stepID] == nil {
				blocksByStep[stepID] = map[string]string{}
			}
			blocksByStep[stepID][block.BlockKey] = block.PlainText
		}
	}

	for _, step := range steps {
		itemCase := caseByID[step.TestCaseID]
		fields := []struct {
			label string
			value string
		}{
			{"期望结果", step.ExpectText},
			{"输入及操作", blocksByStep[step.ID][contentblocks.StepBlockKey(step.ID, contentblocks.StepKindOp)]},
			{"实测结果", blocksByStep[step.ID][contentblocks.StepBlockKey(step.ID, contentblocks.StepKindAct)]},
		}
		for _, field := range fields {
			if !containsSearch(field.value, keyword) {
				continue
			}
			hits = append(hits, CaseSearchHit{
				Kind:           "step",
				CaseID:         step.TestCaseID,
				CaseIdentifier: itemCase.Identifier,
				CaseName:       itemCase.Name,
				Field:          field.label,
				Snippet:        searchSnippet(field.value, keyword),
				StepID:         step.ID,
				StepSeq:        step.Seq,
			})
			break
		}
		if len(hits) >= 60 {
			break
		}
	}
	if len(hits) > 60 {
		hits = hits[:60]
	}
	return hits, nil
}

func stepIDFromBlockKey(key string) string {
	rest, ok := strings.CutPrefix(key, "step.")
	if !ok {
		return ""
	}
	index := strings.LastIndexByte(rest, '.')
	if index <= 0 {
		return ""
	}
	return rest[:index]
}

func containsSearch(value, keyword string) bool {
	return strings.Contains(strings.ToLower(value), strings.ToLower(keyword))
}

func searchSnippet(value, keyword string) string {
	normalized := strings.Join(strings.Fields(value), " ")
	runes := []rune(normalized)
	needle := []rune(strings.ToLower(keyword))
	if len(runes) == 0 || len(needle) == 0 || len(runes) <= 80 {
		return normalized
	}
	index := indexRunesFold(runes, needle)
	if index < 0 {
		if len(runes) > 80 {
			return string(runes[:80]) + "…"
		}
		return normalized
	}
	start := index - 24
	if start < 0 {
		start = 0
	}
	end := start + 80
	if end > len(runes) {
		end = len(runes)
		start = max(0, end-80)
	}
	value = string(runes[start:end])
	if start > 0 {
		value = "…" + value
	}
	if end < len(runes) {
		value += "…"
	}
	return value
}

func indexRunesFold(haystack, needle []rune) int {
	lowerHaystack := []rune(strings.ToLower(string(haystack)))
	if len(needle) > len(lowerHaystack) {
		return -1
	}
	for start := 0; start <= len(lowerHaystack)-len(needle); start++ {
		matched := true
		for offset := range needle {
			if lowerHaystack[start+offset] != needle[offset] {
				matched = false
				break
			}
		}
		if matched {
			return start
		}
	}
	return -1
}
