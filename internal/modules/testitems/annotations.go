package testitems

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"chenmeridian/internal/modules/contentblocks"
)

const (
	AnnotationKindRequirementBody = "requirement_body"
	AnnotationKindStepOp          = "step_op"
	AnnotationKindStepAct         = "step_act"
)

const annotationContextRunes = 80

type AnnotationRow struct {
	ID                 string    `json:"id"`
	Kind               string    `json:"kind"`
	BlockID            string    `json:"blockId"`
	Text               string    `json:"text"`
	ContextBefore      string    `json:"contextBefore"`
	ContextAfter       string    `json:"contextAfter"`
	UpdatedAt          time.Time `json:"updatedAt"`
	RoundID            string    `json:"roundId"`
	RoundNumber        int       `json:"roundNumber"`
	RoundName          string    `json:"roundName"`
	RequirementID      string    `json:"requirementId,omitempty"`
	SourceName         string    `json:"sourceName,omitempty"`
	SourceVersion      string    `json:"sourceVersion,omitempty"`
	ChapterNumber      string    `json:"chapterNumber,omitempty"`
	ExternalIdentifier string    `json:"externalIdentifier,omitempty"`
	RequirementName    string    `json:"requirementName,omitempty"`
	TestItemID         string    `json:"testItemId"`
	TestItemIdentifier string    `json:"testItemIdentifier"`
	TestItemName       string    `json:"testItemName"`
	TestItemTypeCode   string    `json:"testItemTypeCode"`
	CaseID             string    `json:"caseId"`
	CaseIdentifier     string    `json:"caseIdentifier"`
	CaseName           string    `json:"caseName"`
	StepID             string    `json:"stepId"`
	StepSeq            int       `json:"stepSeq"`
}

type AnnotationSummary struct {
	Total           int `json:"total"`
	RequirementBody int `json:"requirementBody"`
	StepOp          int `json:"stepOp"`
	StepAct         int `json:"stepAct"`
	Requirements    int `json:"requirements"`
	Cases           int `json:"cases"`
}

type AnnotationResult struct {
	AllRounds bool              `json:"allRounds"`
	Round     *Round            `json:"round"`
	Rounds    []Round           `json:"rounds"`
	Summary   AnnotationSummary `json:"summary"`
	Rows      []AnnotationRow   `json:"rows"`
}

type annotationBlock struct {
	ID        string    `gorm:"column:id"`
	OwnerID   string    `gorm:"column:owner_id"`
	BlockKey  string    `gorm:"column:block_key"`
	BodyJSON  string    `gorm:"column:body_json"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

type annotationRequirementMeta struct {
	RequirementID      string `gorm:"column:requirement_id"`
	SourceName         string `gorm:"column:source_name"`
	SourceVersion      string `gorm:"column:source_version"`
	ChapterNumber      string `gorm:"column:chapter_number"`
	ExternalIdentifier string `gorm:"column:external_identifier"`
	RequirementName    string `gorm:"column:requirement_name"`
}

type annotationStepMeta struct {
	StepID             string `gorm:"column:step_id"`
	StepSeq            int    `gorm:"column:step_seq"`
	CaseID             string `gorm:"column:case_id"`
	CaseIdentifier     string `gorm:"column:case_identifier"`
	CaseName           string `gorm:"column:case_name"`
	TestItemID         string `gorm:"column:test_item_id"`
	TestItemIdentifier string `gorm:"column:test_item_identifier"`
	TestItemName       string `gorm:"column:test_item_name"`
	TestItemTypeCode   string `gorm:"column:test_item_type_code"`
	RoundID            string `gorm:"column:round_id"`
	RoundNumber        int    `gorm:"column:round_number"`
	RoundName          string `gorm:"column:round_name"`
}

type annotationNode struct {
	Type    string           `json:"type"`
	Content []annotationNode `json:"content"`
	Text    string           `json:"text"`
	Marks   []struct {
		Type string `json:"type"`
	} `json:"marks"`
}

type annotationSpan struct {
	start int
	end   int
}

type annotationSegment struct {
	Text          string
	ContextBefore string
	ContextAfter  string
}

// Annotations 扫描内容块中的 highlight 标记，只读汇总需求正文和用例步骤标注。
// 需求正文是项目级数据，跨轮只返回一次；步骤 op/act 按轮归属。
func (s *Service) Annotations(ctx context.Context, projectID, roundID string) (AnnotationResult, error) {
	allRounds := strings.EqualFold(strings.TrimSpace(roundID), "all")
	var rounds []Round
	var current *Round
	var err error
	if allRounds {
		rounds, err = s.ListRounds(ctx, projectID)
	} else {
		round, resolveErr := s.ResolveRound(ctx, projectID, roundID)
		if resolveErr != nil {
			return AnnotationResult{}, resolveErr
		}
		current = &round
		rounds = []Round{round}
	}
	if err != nil {
		return AnnotationResult{}, err
	}
	if rounds == nil {
		rounds = []Round{}
	}
	roundIDs := make([]string, 0, len(rounds))
	for _, round := range rounds {
		roundIDs = append(roundIDs, round.ID)
	}

	result := AnnotationResult{AllRounds: allRounds, Round: current, Rounds: rounds}
	requirementSeen := make(map[string]bool)
	caseSeen := make(map[string]bool)

	var requirementBlocks []annotationBlock
	if err := s.db.WithContext(ctx).Table("content_blocks").
		Select("id, owner_id, block_key, body_json, updated_at").
		Where("project_id = ? AND owner_type = ? AND block_key = ? AND body_json LIKE ?",
			projectID, contentblocks.OwnerTypeRequirement, contentblocks.BlockKeyRequirementBody, `%"highlight"%`).
		Find(&requirementBlocks).Error; err != nil {
		return AnnotationResult{}, fmt.Errorf("查询需求正文标注失败: %w", err)
	}

	var requirementMeta []annotationRequirementMeta
	if len(requirementBlocks) > 0 {
		ids := uniqueAnnotationIDs(requirementBlocks, func(block annotationBlock) string { return block.OwnerID })
		if err := s.db.WithContext(ctx).Table("software_requirements AS req").
			Select(`req.id AS requirement_id, COALESCE(wo.name, '') AS source_name,
				COALESCE(wov.version, '') AS source_version, req.chapter_number,
				req.external_identifier, req.name AS requirement_name`).
			Joins("JOIN work_object_versions AS wov ON wov.id = req.source_version_id").
			Joins("JOIN work_objects AS wo ON wo.id = wov.work_object_id").
			Where("req.project_id = ? AND req.status = ? AND req.id IN ?", projectID, "official", ids).
			Scan(&requirementMeta).Error; err != nil {
			return AnnotationResult{}, fmt.Errorf("查询标注需求信息失败: %w", err)
		}
	}
	requirementByID := make(map[string]annotationRequirementMeta, len(requirementMeta))
	for _, requirement := range requirementMeta {
		requirementByID[requirement.RequirementID] = requirement
	}
	for _, block := range requirementBlocks {
		requirement, ok := requirementByID[block.OwnerID]
		if !ok {
			continue
		}
		segments, err := scanHighlightSegments(block.BodyJSON)
		if err != nil {
			return AnnotationResult{}, fmt.Errorf("解析需求正文标注块 %s 失败: %w", block.ID, err)
		}
		if len(segments) == 0 {
			continue
		}
		requirementSeen[requirement.RequirementID] = true
		for index, segment := range segments {
			result.Rows = append(result.Rows, AnnotationRow{
				ID:                 block.ID + ":" + strconv.Itoa(index),
				Kind:               AnnotationKindRequirementBody,
				BlockID:            block.ID,
				Text:               segment.Text,
				ContextBefore:      segment.ContextBefore,
				ContextAfter:       segment.ContextAfter,
				UpdatedAt:          block.UpdatedAt,
				RequirementID:      requirement.RequirementID,
				SourceName:         requirement.SourceName,
				SourceVersion:      requirement.SourceVersion,
				ChapterNumber:      requirement.ChapterNumber,
				ExternalIdentifier: requirement.ExternalIdentifier,
				RequirementName:    requirement.RequirementName,
			})
		}
	}

	var stepBlocks []annotationBlock
	if err := s.db.WithContext(ctx).Table("content_blocks").
		Select("id, owner_id, block_key, body_json, updated_at").
		Where("project_id = ? AND owner_type = ? AND (block_key LIKE ? OR block_key LIKE ?) AND body_json LIKE ?",
			projectID, contentblocks.OwnerTypeTestCase, "step.%.op", "step.%.act", `%"highlight"%`).
		Find(&stepBlocks).Error; err != nil {
		return AnnotationResult{}, fmt.Errorf("查询用例步骤标注失败: %w", err)
	}

	stepKinds := make(map[string]string, len(stepBlocks))
	for _, block := range stepBlocks {
		if stepID, kind, ok := parseAnnotationStepBlockKey(block.BlockKey); ok {
			stepKinds[stepID] = kind
		}
	}
	stepMeta := make([]annotationStepMeta, 0)
	if len(stepKinds) > 0 {
		stepIDs := make([]string, 0, len(stepKinds))
		for stepID := range stepKinds {
			stepIDs = append(stepIDs, stepID)
		}
		if err := s.db.WithContext(ctx).Table("test_case_steps AS step").
			Select(`step.id AS step_id, step.seq AS step_seq,
				item_case.id AS case_id, item_case.identifier AS case_identifier, item_case.name AS case_name,
				item.id AS test_item_id, item.identifier AS test_item_identifier, item.name AS test_item_name,
				item.type_code AS test_item_type_code, round.id AS round_id, round.round_number,
				round.name AS round_name`).
			Joins("JOIN test_cases AS item_case ON item_case.id = step.test_case_id").
			Joins("JOIN test_items AS item ON item.id = item_case.test_item_id").
			Joins("JOIN test_rounds AS round ON round.id = item.round_id").
			Where("item.project_id = ? AND item.round_id IN ? AND step.id IN ?", projectID, roundIDs, stepIDs).
			Scan(&stepMeta).Error; err != nil {
			return AnnotationResult{}, fmt.Errorf("查询步骤标注位置失败: %w", err)
		}
	}

	stepByID := make(map[string]annotationStepMeta, len(stepMeta))
	for _, step := range stepMeta {
		stepByID[step.StepID] = step
	}
	for _, block := range stepBlocks {
		stepID, kind, ok := parseAnnotationStepBlockKey(block.BlockKey)
		if !ok {
			continue
		}
		step, exists := stepByID[stepID]
		if !exists || step.CaseID != block.OwnerID {
			continue
		}
		segments, err := scanHighlightSegments(block.BodyJSON)
		if err != nil {
			return AnnotationResult{}, fmt.Errorf("解析步骤标注块 %s 失败: %w", block.ID, err)
		}
		if len(segments) == 0 {
			continue
		}
		caseSeen[step.CaseID] = true
		for index, segment := range segments {
			result.Rows = append(result.Rows, AnnotationRow{
				ID:                 block.ID + ":" + strconv.Itoa(index),
				Kind:               kind,
				BlockID:            block.ID,
				Text:               segment.Text,
				ContextBefore:      segment.ContextBefore,
				ContextAfter:       segment.ContextAfter,
				UpdatedAt:          block.UpdatedAt,
				RoundID:            step.RoundID,
				RoundNumber:        step.RoundNumber,
				RoundName:          step.RoundName,
				TestItemID:         step.TestItemID,
				TestItemIdentifier: step.TestItemIdentifier,
				TestItemName:       step.TestItemName,
				TestItemTypeCode:   step.TestItemTypeCode,
				CaseID:             step.CaseID,
				CaseIdentifier:     step.CaseIdentifier,
				CaseName:           step.CaseName,
				StepID:             step.StepID,
				StepSeq:            step.StepSeq,
			})

		}
	}

	sort.SliceStable(result.Rows, func(left, right int) bool {
		a, b := result.Rows[left], result.Rows[right]
		if a.Kind == AnnotationKindRequirementBody && b.Kind != AnnotationKindRequirementBody {
			return true
		}
		if b.Kind == AnnotationKindRequirementBody && a.Kind != AnnotationKindRequirementBody {
			return false
		}
		if a.RoundNumber != b.RoundNumber {
			return a.RoundNumber < b.RoundNumber
		}
		if a.TestItemIdentifier != b.TestItemIdentifier {
			return a.TestItemIdentifier < b.TestItemIdentifier
		}
		if a.CaseIdentifier != b.CaseIdentifier {
			return a.CaseIdentifier < b.CaseIdentifier
		}
		if a.StepSeq != b.StepSeq {
			return a.StepSeq < b.StepSeq
		}
		if a.Kind != b.Kind {
			return a.Kind < b.Kind
		}
		return a.ID < b.ID
	})
	if result.Rows == nil {
		result.Rows = []AnnotationRow{}
	}

	for _, row := range result.Rows {
		result.Summary.Total++
		switch row.Kind {
		case AnnotationKindRequirementBody:
			result.Summary.RequirementBody++
		case AnnotationKindStepOp:
			result.Summary.StepOp++
		case AnnotationKindStepAct:
			result.Summary.StepAct++
		}

	}
	result.Summary.Requirements = len(requirementSeen)
	result.Summary.Cases = len(caseSeen)
	return result, nil
}

func parseAnnotationStepBlockKey(key string) (string, string, bool) {
	rest, ok := strings.CutPrefix(key, "step.")
	if !ok {
		return "", "", false
	}
	stepID, kind, ok := strings.Cut(rest, ".")
	if !ok || stepID == "" {
		return "", "", false
	}
	switch kind {
	case contentblocks.StepKindOp:
		return stepID, AnnotationKindStepOp, true
	case contentblocks.StepKindAct:
		return stepID, AnnotationKindStepAct, true
	default:
		return "", "", false
	}
}

func uniqueStrings(values []string) []string {
	seen := make(map[string]bool, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}
	return result
}

func uniqueAnnotationIDs(blocks []annotationBlock, value func(annotationBlock) string) []string {
	ids := make([]string, 0, len(blocks))
	for _, block := range blocks {
		ids = append(ids, value(block))
	}
	return uniqueStrings(ids)
}

func scanHighlightSegments(bodyJSON string) ([]annotationSegment, error) {
	var root annotationNode
	if err := json.Unmarshal([]byte(bodyJSON), &root); err != nil {
		return nil, err
	}
	var text strings.Builder
	spans := make([]annotationSpan, 0)
	collectHighlightSpans(root, &text, &spans)
	full := text.String()
	segments := make([]annotationSegment, 0, len(spans))
	for _, span := range spans {
		selected := normalizeAnnotationText(full[span.start:span.end])
		if selected == "" {
			continue
		}
		segments = append(segments, annotationSegment{
			Text:          clipAnnotationRunes(selected, 240),
			ContextBefore: clipAnnotationBefore(full[:span.start], annotationContextRunes),
			ContextAfter:  clipAnnotationAfter(full[span.end:], annotationContextRunes),
		})
	}
	return segments, nil
}

func collectHighlightSpans(node annotationNode, text *strings.Builder, spans *[]annotationSpan) {
	if node.Type == contentblocks.NodeText {
		start := text.Len()
		text.WriteString(node.Text)
		end := text.Len()
		if end > start && annotationNodeHighlighted(node) {
			if len(*spans) > 0 && (*spans)[len(*spans)-1].end == start {
				(*spans)[len(*spans)-1].end = end
			} else {
				*spans = append(*spans, annotationSpan{start: start, end: end})
			}
		}
		return
	}
	for _, child := range node.Content {
		collectHighlightSpans(child, text, spans)
	}
	switch node.Type {
	case contentblocks.NodeParagraph, contentblocks.NodeHeading, contentblocks.NodeTableRow:
		text.WriteByte('\n')
	}
}

func annotationNodeHighlighted(node annotationNode) bool {
	for _, mark := range node.Marks {
		if mark.Type == contentblocks.MarkHighlight {
			return true
		}
	}
	return false
}

func normalizeAnnotationText(value string) string {
	return strings.TrimSpace(strings.Join(strings.Fields(value), " "))
}

func clipAnnotationBefore(value string, limit int) string {
	runes := []rune(normalizeAnnotationText(value))
	if len(runes) > limit {
		runes = runes[len(runes)-limit:]
	}
	return string(runes)
}

func clipAnnotationAfter(value string, limit int) string {
	runes := []rune(normalizeAnnotationText(value))
	if len(runes) > limit {
		runes = runes[:limit]
	}
	return string(runes)
}

func clipAnnotationRunes(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit]) + "…"
}
