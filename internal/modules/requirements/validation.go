package requirements

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

// 需求字段的校验与归一化：章节号、名称、标识、类型、标签、剔除原因。
func validateSection(chapter string, title string) (string, string, error) {
	chapter = strings.TrimSpace(chapter)
	title = strings.TrimSpace(title)
	if !chapterPattern.MatchString(chapter) {
		return "", "", ErrChapterInvalid
	}
	if title == "" {
		return "", "", fmt.Errorf("章节标题不能为空")
	}
	if len([]rune(title)) > 240 {
		return "", "", fmt.Errorf("章节标题最多 240 个字符")
	}
	return chapter, title, nil
}

func validateRequirement(chapter string, name string, description string) (string, string, string, error) {
	chapter = strings.TrimSpace(chapter)
	name = strings.TrimSpace(name)
	description = strings.TrimSpace(description)
	if !chapterPattern.MatchString(chapter) {
		return "", "", "", ErrChapterInvalid
	}
	if name == "" {
		return "", "", "", fmt.Errorf("需求名称不能为空")
	}
	if len([]rune(name)) > 240 {
		return "", "", "", fmt.Errorf("需求名称最多 240 个字符")
	}
	return chapter, name, description, nil
}

func validateBulkRequirement(
	chapter string,
	name string,
	description string,
) (string, string, string, error) {
	return validateRequirement(chapter, name, description)
}

func validatePrimaryKind(kind string) error {
	switch kind {
	case KindFunctional, KindPerformance, KindInterface, KindSafety, KindReliability, KindOther:
		return nil
	default:
		return ErrInvalidKind
	}
}

func normalizeSecondaryKinds(primaryKind string, values []string) ([]string, error) {
	orders := map[string]int{
		KindFunctional: 0, KindPerformance: 1, KindInterface: 2,
		KindSafety: 3, KindReliability: 4, KindOther: 5,
	}
	seen := make(map[string]bool, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		_, valid := orders[value]
		if !valid {
			return nil, ErrInvalidSecondaryKind
		}
		if value == primaryKind {
			return nil, ErrSecondaryKindRepeat
		}
		if seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}
	sort.Slice(result, func(i int, j int) bool { return orders[result[i]] < orders[result[j]] })
	return result, nil
}

func normalizeTags(values []string) []string {
	seen := make(map[string]bool)
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		if len([]rune(value)) > 32 {
			value = string([]rune(value)[:32])
		}
		seen[value] = true
		result = append(result, value)
	}
	if len(result) > 12 {
		result = result[:12]
	}
	return result
}

func marshalTags(values []string) string {
	if len(values) == 0 {
		return "[]"
	}
	data, err := json.Marshal(values)
	if err != nil {
		return "[]"
	}
	return string(data)
}

func parseTags(value string) []string {
	return normalizeTags(parseStringArray(value))
}

func parseSecondaryKinds(value string) []string {
	values, _ := normalizeSecondaryKinds("", parseStringArray(value))
	return values
}

func parseStringArray(value string) []string {
	var result []string
	if err := json.Unmarshal([]byte(value), &result); err != nil {
		return []string{}
	}
	return result
}

func validatePurgeReason(raw string) error {
	reason := strings.TrimSpace(raw)
	if reason == "" {
		return ErrPurgeReasonRequired
	}
	if len([]rune(reason)) > 500 {
		return ErrReasonTooLong
	}
	return nil
}
