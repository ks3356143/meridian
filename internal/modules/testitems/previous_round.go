package testitems

import (
	"context"
	"errors"
	"fmt"

	"gorm.io/gorm"
)

// ErrNoPreviousRoundResult 当前轮之前没有可对齐的实测记录。
var ErrNoPreviousRoundResult = errors.New("没有可用的上轮实测记录")

// PreviousRoundStep 按步骤 lineage 对齐后的上轮步骤。
type PreviousRoundStep struct {
	CurrentStepID *string  `json:"currentStepId"`
	PreviousStep  StepView `json:"previousStep"`
	// Change unchanged / added / removed。
	Change string `json:"change"`
}

// PreviousRoundResult 用例的上轮实测详情。
type PreviousRoundResult struct {
	CurrentCaseID string              `json:"currentCaseId"`
	LineageKey    string              `json:"lineageKey"`
	CurrentRound  Round               `json:"currentRound"`
	PreviousRound Round               `json:"previousRound"`
	PreviousCase  Case                `json:"previousCase"`
	TesterID      *string             `json:"testerId"`
	TesterName    string              `json:"testerName"`
	Steps         []PreviousRoundStep `json:"steps"`
}

// AnnotatePreviousRoundAvailability 给工作台用例摘要补“是否存在上轮对齐记录”，避免折叠区在未展开时发详情请求。
func (s *Service) AnnotatePreviousRoundAvailability(ctx context.Context, cases []Case) ([]Case, error) {
	if len(cases) == 0 {
		return cases, nil
	}
	caseIDs := make([]string, 0, len(cases))
	for _, itemCase := range cases {
		caseIDs = append(caseIDs, itemCase.ID)
	}
	var rows []struct {
		CaseID    string `gorm:"column:case_id"`
		Available int    `gorm:"column:available"`
	}
	err := s.db.WithContext(ctx).Raw(`
SELECT current_case.id AS case_id,
       CASE WHEN previous_case.id IS NULL THEN 0 ELSE 1 END AS available
FROM test_cases current_case
JOIN test_items current_item ON current_item.id = current_case.test_item_id
JOIN test_rounds current_round ON current_round.id = current_item.round_id
LEFT JOIN test_rounds previous_round
       ON previous_round.project_id = current_round.project_id
      AND previous_round.round_number = current_round.round_number - 1
LEFT JOIN test_items previous_item
       ON previous_item.round_id = previous_round.id
      AND previous_item.project_id = current_item.project_id
      AND previous_item.lineage_key = current_item.lineage_key
LEFT JOIN test_cases previous_case
       ON previous_case.test_item_id = previous_item.id
      AND previous_case.lineage_key = current_case.lineage_key
WHERE current_case.id IN ?`, caseIDs).Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("查询上轮实测可用状态失败: %w", err)
	}
	available := make(map[string]bool, len(rows))
	for _, row := range rows {
		available[row.CaseID] = row.Available == 1
	}
	for index := range cases {
		cases[index].PreviousRoundAvailable = available[cases[index].ID]
	}
	return cases, nil
}

// PreviousRoundResult 按 lineage_key 找到上一轮对应用例，并返回只读实测内容。
func (s *Service) PreviousRoundResult(ctx context.Context, caseID string) (PreviousRoundResult, error) {
	currentCase, err := s.GetCase(ctx, caseID)
	if err != nil {
		return PreviousRoundResult{}, err
	}
	currentItem, err := findTestItem(s.db.WithContext(ctx), currentCase.TestItemID)
	if err != nil {
		return PreviousRoundResult{}, err
	}
	var currentRound Round
	if err := s.db.WithContext(ctx).Where("id = ?", currentItem.RoundID).First(&currentRound).Error; err != nil {
		return PreviousRoundResult{}, ErrRoundNotFound
	}
	if currentRound.RoundNumber <= 1 {
		return PreviousRoundResult{}, ErrNoPreviousRoundResult
	}
	var previousRound Round
	err = s.db.WithContext(ctx).
		Where("project_id = ? AND round_number = ?", currentRound.ProjectID, currentRound.RoundNumber-1).
		First(&previousRound).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return PreviousRoundResult{}, ErrNoPreviousRoundResult
	}
	if err != nil {
		return PreviousRoundResult{}, fmt.Errorf("查询上一轮失败: %w", err)
	}
	var previousCase Case
	err = s.db.WithContext(ctx).Table("test_cases AS previous_case").
		Select("previous_case.*").
		Joins("JOIN test_items AS previous_item ON previous_item.id = previous_case.test_item_id").
		Where("previous_item.round_id = ? AND previous_item.project_id = ? AND previous_item.lineage_key = ?",
			previousRound.ID, currentRound.ProjectID, currentItem.LineageKey).
		Where("previous_case.lineage_key = ?", currentCase.LineageKey).
		First(&previousCase).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return PreviousRoundResult{}, ErrNoPreviousRoundResult
	}
	if err != nil {
		return PreviousRoundResult{}, fmt.Errorf("查询上一轮用例失败: %w", err)
	}

	result := PreviousRoundResult{
		CurrentCaseID: currentCase.ID,
		LineageKey:    currentCase.LineageKey,
		CurrentRound:  currentRound,
		PreviousRound: previousRound,
		PreviousCase:  previousCase,
		TesterID:      previousCase.TesterID,
		Steps:         []PreviousRoundStep{},
	}
	if previousCase.TesterID != nil && *previousCase.TesterID != "" {
		var user struct {
			DisplayName string `gorm:"column:display_name"`
		}
		if err := s.db.WithContext(ctx).Table("users").Select("display_name").
			Where("id = ?", *previousCase.TesterID).Scan(&user).Error; err != nil {
			return PreviousRoundResult{}, fmt.Errorf("查询上轮测试人员失败: %w", err)
		}
		result.TesterName = user.DisplayName
	}

	currentSteps, err := s.ListStepsWithBlocks(ctx, currentCase.ID)
	if err != nil {
		return PreviousRoundResult{}, err
	}
	previousSteps, err := s.ListStepsWithBlocks(ctx, previousCase.ID)
	if err != nil {
		return PreviousRoundResult{}, err
	}
	currentByLineage := make(map[string]StepView, len(currentSteps))
	for _, step := range currentSteps {
		currentByLineage[step.LineageKey] = step
	}
	previousByLineage := make(map[string]StepView, len(previousSteps))
	for _, step := range previousSteps {
		previousByLineage[step.LineageKey] = step
	}
	for _, currentStep := range currentSteps {
		previousStep, exists := previousByLineage[currentStep.LineageKey]
		if exists {
			currentID := currentStep.ID
			result.Steps = append(result.Steps, PreviousRoundStep{
				CurrentStepID: &currentID,
				PreviousStep:  previousStep,
				Change:        "unchanged",
			})
			continue
		}
		result.Steps = append(result.Steps, PreviousRoundStep{
			PreviousStep: currentStep,
			Change:       "added",
		})
	}
	for _, previousStep := range previousSteps {
		if _, exists := currentByLineage[previousStep.LineageKey]; exists {
			continue
		}
		result.Steps = append(result.Steps, PreviousRoundStep{
			PreviousStep: previousStep,
			Change:       "removed",
		})
	}
	return result, nil
}
