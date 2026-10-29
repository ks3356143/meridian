package testitems

import (
	"context"
	"fmt"
	"strings"
	"time"
)

type TraceabilityCase struct {
	CaseID     string     `json:"caseId"`
	Identifier string     `json:"identifier"`
	Name       string     `json:"name"`
	Status     string     `json:"status"`
	ExecDate   *time.Time `json:"execDate"`
	TesterName string     `json:"testerName"`
}

type TraceabilityRow struct {
	RoundID            string            `json:"roundId"`
	RoundNumber        int               `json:"roundNumber"`
	RoundName          string            `json:"roundName"`
	RequirementID      string            `json:"requirementId"`
	SourceName         string            `json:"sourceName"`
	SourceVersion      string            `json:"sourceVersion"`
	ChapterNumber      string            `json:"chapterNumber"`
	ExternalIdentifier string            `json:"externalIdentifier"`
	RequirementName    string            `json:"requirementName"`
	TestItemID         string            `json:"testItemId"`
	TestItemIdentifier string            `json:"testItemIdentifier"`
	TestItemName       string            `json:"testItemName"`
	TestItemTypeCode   string            `json:"testItemTypeCode"`
	TestItemTypeName   string            `json:"testItemTypeName"`
	TestItemPassRate   *float64          `json:"testItemPassRate"`
	Case               *TraceabilityCase `json:"case"`
}

type TraceabilitySummary struct {
	Requirements         int      `json:"requirements"`
	LinkedRequirements   int      `json:"linkedRequirements"`
	UnlinkedRequirements int      `json:"unlinkedRequirements"`
	TestItems            int      `json:"testItems"`
	ImplicitItems        int      `json:"implicitItems"`
	UnlinkedItems        int      `json:"unlinkedItems"`
	Cases                int      `json:"cases"`
	Passed               int      `json:"passed"`
	Failed               int      `json:"failed"`
	Pending              int      `json:"pending"`
	PassRate             *float64 `json:"passRate"`
}

type TraceabilityResult struct {
	AllRounds bool                `json:"allRounds"`
	Round     *Round              `json:"round"`
	Rounds    []Round             `json:"rounds"`
	Summary   TraceabilitySummary `json:"summary"`
	Rows      []TraceabilityRow   `json:"rows"`
}

type traceRequirementRow struct {
	RequirementID      string `gorm:"column:requirement_id"`
	SourceName         string `gorm:"column:source_name"`
	SourceVersion      string `gorm:"column:source_version"`
	ChapterNumber      string `gorm:"column:chapter_number"`
	ExternalIdentifier string `gorm:"column:external_identifier"`
	RequirementName    string `gorm:"column:requirement_name"`
}

type traceItemRow struct {
	RoundID    string `gorm:"column:round_id"`
	TestItemID string `gorm:"column:test_item_id"`
	Identifier string `gorm:"column:identifier"`
	Name       string `gorm:"column:name"`
	TypeCode   string `gorm:"column:type_code"`
	TypeName   string `gorm:"column:type_name"`
	Implicit   bool   `gorm:"column:implicit_requirement"`
	IsStatic   bool   `gorm:"column:is_static"`
	SortOrder  int    `gorm:"column:sort_order"`
}

type traceLinkRow struct {
	RoundID       string `gorm:"column:round_id"`
	RequirementID string `gorm:"column:requirement_id"`
	TestItemID    string `gorm:"column:test_item_id"`
}

type traceCaseRow struct {
	TestItemID string     `gorm:"column:test_item_id"`
	CaseID     string     `gorm:"column:case_id"`
	Identifier string     `gorm:"column:identifier"`
	Name       string     `gorm:"column:name"`
	Status     string     `gorm:"column:status"`
	ExecDate   *time.Time `gorm:"column:exec_date"`
	TesterName string     `gorm:"column:tester_name"`
	SortOrder  int        `gorm:"column:sort_order"`
}

// Traceability 返回需求 → 测试项 → 用例的交付级追溯矩阵。
// 每个具体轮次按"正式需求 × 测试项 × 用例"展开；无关联或无用例时保留缺口行。
func (s *Service) Traceability(ctx context.Context, projectID, roundID string) (TraceabilityResult, error) {
	allRounds := strings.EqualFold(strings.TrimSpace(roundID), "all")
	var rounds []Round
	var current *Round
	var err error
	if allRounds {
		rounds, err = s.ListRounds(ctx, projectID)
	} else {
		round, resolveErr := s.ResolveRound(ctx, projectID, roundID)
		if resolveErr != nil {
			return TraceabilityResult{}, resolveErr
		}
		current = &round
		rounds = []Round{round}
	}
	if err != nil {
		return TraceabilityResult{}, err
	}
	if rounds == nil {
		rounds = []Round{}
	}
	roundIDs := make([]string, 0, len(rounds))
	for _, round := range rounds {
		roundIDs = append(roundIDs, round.ID)
	}

	var requirements []traceRequirementRow
	if err := s.db.WithContext(ctx).Table("software_requirements AS req").
		Select(`req.id AS requirement_id, COALESCE(wo.name, '') AS source_name,
			COALESCE(wov.version, '') AS source_version, req.chapter_number,
			req.external_identifier, req.name AS requirement_name`).
		Joins("JOIN work_object_versions AS wov ON wov.id = req.source_version_id").
		Joins("JOIN work_objects AS wo ON wo.id = wov.work_object_id").
		Where("req.project_id = ? AND req.status = ?", projectID, "official").
		Order("wov.version ASC, req.chapter_number ASC, req.id ASC").
		Scan(&requirements).Error; err != nil {
		return TraceabilityResult{}, fmt.Errorf("查询追溯需求失败: %w", err)
	}

	var items []traceItemRow
	if err := s.db.WithContext(ctx).Table("test_items AS item").
		Select(`item.round_id, item.id AS test_item_id, item.identifier, item.name,
			item.type_code, typ.name AS type_name, item.implicit_requirement, typ.is_static,
			item.sort_order`).
		Joins("JOIN test_item_types AS typ ON typ.code = item.type_code").
		Where("item.project_id = ? AND item.round_id IN ?", projectID, roundIDs).
		Order("item.round_id ASC, item.type_code ASC, item.sort_order ASC, item.id ASC").
		Scan(&items).Error; err != nil {
		return TraceabilityResult{}, fmt.Errorf("查询追溯测试项失败: %w", err)
	}

	var links []traceLinkRow
	if err := s.db.WithContext(ctx).Table("requirement_test_items AS link").
		Select("item.round_id, link.requirement_id, link.test_item_id").
		Joins("JOIN test_items AS item ON item.id = link.test_item_id").
		Where("item.project_id = ? AND item.round_id IN ?", projectID, roundIDs).
		Scan(&links).Error; err != nil {
		return TraceabilityResult{}, fmt.Errorf("查询追溯关系失败: %w", err)
	}

	var cases []traceCaseRow
	if err := s.db.WithContext(ctx).Table("test_cases AS item_case").
		Select(`item_case.test_item_id, item_case.id AS case_id, item_case.identifier, item_case.name,
			item_case.status, item_case.exec_date, COALESCE(tester.display_name, '') AS tester_name,
			item_case.sort_order`).
		Joins("JOIN test_items AS item ON item.id = item_case.test_item_id").
		Joins("LEFT JOIN users AS tester ON tester.id = item_case.tester_id").
		Where("item.project_id = ? AND item.round_id IN ?", projectID, roundIDs).
		Order("item_case.test_item_id ASC, item_case.sort_order ASC, item_case.id ASC").
		Scan(&cases).Error; err != nil {
		return TraceabilityResult{}, fmt.Errorf("查询追溯用例失败: %w", err)
	}

	itemsByRound := make(map[string][]traceItemRow)
	for _, item := range items {
		itemsByRound[item.RoundID] = append(itemsByRound[item.RoundID], item)
	}
	linkedItemsByRoundRequirement := make(map[string][]string)
	linkedRequirementSet := make(map[string]bool)
	linkedItemSet := make(map[string]bool)
	for _, link := range links {
		key := traceRoundRequirementKey(link.RoundID, link.RequirementID)
		linkedItemsByRoundRequirement[key] = append(linkedItemsByRoundRequirement[key], link.TestItemID)
		linkedRequirementSet[link.RequirementID] = true
		linkedItemSet[link.TestItemID] = true
	}
	casesByItem := make(map[string][]traceCaseRow)
	itemPassRates := make(map[string]*float64)
	for _, itemCase := range cases {
		casesByItem[itemCase.TestItemID] = append(casesByItem[itemCase.TestItemID], itemCase)
	}
	for itemID, itemCases := range casesByItem {
		passed, failed := 0, 0
		for _, itemCase := range itemCases {
			switch itemCase.Status {
			case "passed":
				passed++
			case "failed":
				failed++
			}
		}
		itemPassRates[itemID] = passRate(passed, failed)
	}
	itemById := make(map[string]traceItemRow, len(items))
	for _, item := range items {
		itemById[item.TestItemID] = item
	}

	result := TraceabilityResult{AllRounds: allRounds, Round: current, Rounds: rounds}
	result.Summary.Requirements = len(requirements)
	result.Summary.LinkedRequirements = len(linkedRequirementSet)
	result.Summary.UnlinkedRequirements = len(requirements) - len(linkedRequirementSet)
	result.Summary.TestItems = len(items)
	for _, item := range items {
		if item.Implicit {
			result.Summary.ImplicitItems++
		} else if !item.IsStatic && !linkedItemSet[item.TestItemID] {
			result.Summary.UnlinkedItems++
		}
	}
	for _, itemCase := range cases {
		result.Summary.Cases++
		switch itemCase.Status {
		case "passed":
			result.Summary.Passed++
		case "failed":
			result.Summary.Failed++
		default:
			result.Summary.Pending++
		}
	}
	result.Summary.PassRate = passRate(result.Summary.Passed, result.Summary.Failed)

	for _, round := range rounds {
		for _, requirement := range requirements {
			key := traceRoundRequirementKey(round.ID, requirement.RequirementID)
			itemIDs := linkedItemsByRoundRequirement[key]
			if len(itemIDs) == 0 {
				result.Rows = append(result.Rows, traceRowForRequirement(round, requirement))
				continue
			}
			for _, itemID := range itemIDs {
				item, ok := itemById[itemID]
				if !ok {
					continue
				}
				itemCases := casesByItem[itemID]
				if len(itemCases) == 0 {
					row := traceRowForItem(round, requirement, item, nil)
					row.TestItemPassRate = itemPassRates[itemID]
					result.Rows = append(result.Rows, row)
					continue
				}
				for index := range itemCases {
					row := traceRowForItem(round, requirement, item, &itemCases[index])
					row.TestItemPassRate = itemPassRates[itemID]
					result.Rows = append(result.Rows, row)
				}
			}
		}
	}
	if result.Rows == nil {
		result.Rows = []TraceabilityRow{}
	}
	return result, nil
}

func traceRoundRequirementKey(roundID, requirementID string) string {
	return roundID + "\x00" + requirementID
}

func traceRowForRequirement(round Round, requirement traceRequirementRow) TraceabilityRow {
	return TraceabilityRow{
		RoundID: round.ID, RoundNumber: round.RoundNumber, RoundName: round.Name,
		RequirementID: requirement.RequirementID, SourceName: requirement.SourceName,
		SourceVersion: requirement.SourceVersion, ChapterNumber: requirement.ChapterNumber,
		ExternalIdentifier: requirement.ExternalIdentifier, RequirementName: requirement.RequirementName,
	}
}

func traceRowForItem(round Round, requirement traceRequirementRow, item traceItemRow, itemCase *traceCaseRow) TraceabilityRow {
	row := traceRowForRequirement(round, requirement)
	row.TestItemID = item.TestItemID
	row.TestItemIdentifier = item.Identifier
	row.TestItemName = item.Name
	row.TestItemTypeCode = item.TypeCode
	row.TestItemTypeName = item.TypeName
	row.TestItemPassRate = passRate(0, 0)
	if itemCase != nil {
		row.TestItemPassRate = nil
		row.Case = &TraceabilityCase{
			CaseID: itemCase.CaseID, Identifier: itemCase.Identifier, Name: itemCase.Name,
			Status: itemCase.Status, ExecDate: itemCase.ExecDate, TesterName: itemCase.TesterName,
		}
	}
	return row
}
