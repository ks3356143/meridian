package requirements

import (
	"context"
	"fmt"
	"strings"
)

const (
	descriptionExcerptLimit = 80
	searchExcerptLimit      = 120
)

type RequirementSearchHit struct {
	ID      string   `json:"id"`
	Fields  []string `json:"fields"`
	Excerpt string   `json:"excerpt"`
}

type RequirementSearchResult struct {
	Items []RequirementSearchHit `json:"items"`
	Total int                    `json:"total"`
}

func (s *Service) SearchRequirements(
	ctx context.Context,
	projectCode string,
	sourceVersionID string,
	query string,
) (RequirementSearchResult, error) {
	projectID, err := s.findProject(ctx, projectCode)
	if err != nil {
		return RequirementSearchResult{}, err
	}

	sources, err := s.listSources(ctx, projectID)
	if err != nil {
		return RequirementSearchResult{}, err
	}
	if sourceVersionID != "" {
		valid := false
		for _, source := range sources {
			if source.ID == sourceVersionID {
				valid = true
				break
			}
		}
		if !valid {
			return RequirementSearchResult{}, ErrSourceNotFound
		}
	}

	normalizedQuery := strings.ToLower(strings.TrimSpace(query))
	if normalizedQuery == "" {
		return RequirementSearchResult{Items: []RequirementSearchHit{}, Total: 0}, nil
	}

	var requirements []Requirement
	dbQuery := s.db.WithContext(ctx).Where("project_id = ?", projectID)
	if sourceVersionID != "" {
		dbQuery = dbQuery.Where("source_version_id = ?", sourceVersionID)
	}
	if err := dbQuery.Find(&requirements).Error; err != nil {
		return RequirementSearchResult{}, fmt.Errorf("查询软件需求搜索数据失败: %w", err)
	}
	sortRequirements(requirements)

	items := make([]RequirementSearchHit, 0)
	for _, requirement := range requirements {
		fields, excerpt := matchRequirementSearch(requirement, normalizedQuery)
		if len(fields) == 0 {
			continue
		}
		items = append(items, RequirementSearchHit{
			ID:      requirement.ID,
			Fields:  fields,
			Excerpt: excerpt,
		})
	}

	return RequirementSearchResult{Items: items, Total: len(items)}, nil
}

func matchRequirementSearch(requirement Requirement, query string) ([]string, string) {
	fields := make([]string, 0, 5)
	chapterQuery := strings.TrimPrefix(query, "§")
	chapterNumber := strings.ToLower(requirement.ChapterNumber)
	if chapterQuery != "" &&
		(chapterNumber == chapterQuery || strings.HasPrefix(chapterNumber, chapterQuery+".")) {
		fields = append(fields, "chapter")
	}
	if strings.Contains(strings.ToLower(requirement.Name), query) {
		fields = append(fields, "name")
	}
	if strings.Contains(strings.ToLower(requirement.Description), query) {
		fields = append(fields, "description")
	}
	if strings.Contains(strings.ToLower(requirement.ExternalIdentifier), query) {
		fields = append(fields, "externalIdentifier")
	}
	if strings.Contains(strings.ToLower(strings.Join(parseTags(requirement.Tags), " / ")), query) {
		fields = append(fields, "tags")
	}
	if len(fields) == 0 {
		return fields, ""
	}
	return fields, buildRequirementSearchExcerpt(requirement, query, fields)
}

func buildRequirementSearchExcerpt(requirement Requirement, query string, fields []string) string {
	var source string
	switch {
	case containsSearchField(fields, "description"):
		source = requirement.Description
	case containsSearchField(fields, "name"):
		source = requirement.Name
	case containsSearchField(fields, "chapter"):
		source = "§" + requirement.ChapterNumber + " " + requirement.Name
	case containsSearchField(fields, "externalIdentifier"):
		source = requirement.ExternalIdentifier
	default:
		source = strings.Join(parseTags(requirement.Tags), " / ")
	}

	normalizedSource := strings.Join(strings.Fields(source), " ")
	if normalizedSource == "" {
		return ""
	}
	sourceRunes := []rune(normalizedSource)
	queryRunes := []rune(query)
	matchIndex := indexRunes([]rune(strings.ToLower(normalizedSource)), queryRunes)
	if matchIndex < 0 {
		return buildDescriptionExcerpt(normalizedSource, searchExcerptLimit)
	}

	start := matchIndex - 42
	if start < 0 {
		start = 0
	}
	end := matchIndex + len(queryRunes) + 72
	if end > len(sourceRunes) {
		end = len(sourceRunes)
	}
	prefix := ""
	if start > 0 {
		prefix = "..."
	}
	suffix := ""
	if end < len(sourceRunes) {
		suffix = "..."
	}
	return prefix + string(sourceRunes[start:end]) + suffix
}

func buildDescriptionExcerpt(value string, limit int) string {
	normalized := strings.Join(strings.Fields(value), " ")
	if normalized == "" {
		return ""
	}
	runes := []rune(normalized)
	if len(runes) <= limit {
		return normalized
	}
	return string(runes[:limit]) + "…"
}

func containsSearchField(fields []string, target string) bool {
	for _, field := range fields {
		if field == target {
			return true
		}
	}
	return false
}

func indexRunes(source []rune, target []rune) int {
	if len(target) == 0 || len(target) > len(source) {
		return -1
	}
	for index := 0; index <= len(source)-len(target); index++ {
		matched := true
		for offset := range target {
			if source[index+offset] != target[offset] {
				matched = false
				break
			}
		}
		if matched {
			return index
		}
	}
	return -1
}
