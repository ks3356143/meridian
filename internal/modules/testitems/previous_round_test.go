package testitems

import (
	"context"
	"errors"
	"strings"
	"testing"

	"chenmeridian/internal/modules/contentblocks"
)

func TestPreviousRoundResultAlignsByLineageAndKeepsActReadOnly(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	firstRound, err := service.EnsureRound(ctx, projectID)
	if err != nil {
		t.Fatalf("准备第 1 轮失败: %v", err)
	}
	firstItem, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, RoundID: firstRound.ID, TypeCode: "SU", Name: "上轮实测测试项",
	})
	if err != nil {
		t.Fatalf("创建首轮测试项失败: %v", err)
	}
	firstCase, err := service.CreateCase(ctx, firstItem.ID, "上轮实测用例")
	if err != nil {
		t.Fatalf("创建首轮用例失败: %v", err)
	}
	firstStep, err := service.CreateStep(ctx, firstCase.ID, "第一步预期")
	if err != nil {
		t.Fatalf("创建第一步失败: %v", err)
	}
	removedStep, err := service.CreateStep(ctx, firstCase.ID, "第二步预期")
	if err != nil {
		t.Fatalf("创建第二步失败: %v", err)
	}
	actDoc := contentblocks.Node{
		Type: contentblocks.NodeDoc,
		Content: []contentblocks.Node{{
			Type: contentblocks.NodeParagraph,
			Content: []contentblocks.Node{{
				Type: contentblocks.NodeText,
				Text: "上轮实测：参数读取正常",
			}},
		}},
	}
	if _, err := service.SaveStepBlock(ctx, firstStep.ID, contentblocks.StepKindAct, actDoc, "user-1"); err != nil {
		t.Fatalf("写入上轮实测失败: %v", err)
	}
	status := "failed"
	testerID := "user-1"
	execDate := "2026-10-28"
	if _, err := service.BatchAssignCases(ctx, firstItem.ID, BatchAssignCasesInput{
		CaseIDs: []string{firstCase.ID}, TesterID: &testerID, Status: &status, ExecDate: &execDate,
	}); err != nil {
		t.Fatalf("写入上轮执行信息失败: %v", err)
	}

	copied, err := service.CreateRoundCopy(ctx, CreateRoundCopyInput{
		ProjectID: projectID, SourceRoundID: firstRound.ID, TestItemIDs: []string{firstItem.ID},
	})
	if err != nil {
		t.Fatalf("复制第二轮失败: %v", err)
	}
	var secondItem TestItem
	if err := service.db.Where("round_id = ? AND lineage_key = ?", copied.Round.ID, firstItem.LineageKey).
		First(&secondItem).Error; err != nil {
		t.Fatalf("查询第二轮测试项失败: %v", err)
	}
	var secondCase Case
	if err := service.db.Where("test_item_id = ? AND lineage_key = ?", secondItem.ID, firstCase.LineageKey).
		First(&secondCase).Error; err != nil {
		t.Fatalf("查询第二轮用例失败: %v", err)
	}
	steps, err := service.ListSteps(ctx, secondCase.ID)
	if err != nil {
		t.Fatalf("读取第二轮步骤失败: %v", err)
	}
	var copiedRemovedStepID string
	for _, step := range steps {
		if step.LineageKey == removedStep.LineageKey {
			copiedRemovedStepID = step.ID
		}
	}
	addedStep, err := service.CreateStep(ctx, secondCase.ID, "本轮新增第三步预期")
	if err != nil {
		t.Fatalf("新增第二轮步骤失败: %v", err)
	}
	if copiedRemovedStepID == "" {
		t.Fatal("未找到复制出的第二步")
	}
	if err := service.DeleteStep(ctx, copiedRemovedStepID); err != nil {
		t.Fatalf("删除第二轮第二步失败: %v", err)
	}

	result, err := service.PreviousRoundResult(ctx, secondCase.ID)
	if err != nil {
		t.Fatalf("读取上轮实测失败: %v", err)
	}
	if result.PreviousRound.RoundNumber != 1 || result.CurrentRound.RoundNumber != 2 {
		t.Fatalf("轮次信息不正确: %+v", result)
	}
	if result.TesterName != "测试员" || result.PreviousCase.Status != "failed" || result.PreviousCase.ExecDate == nil {
		t.Fatalf("上轮执行信息不正确: %+v", result.PreviousCase)
	}
	if len(result.Steps) != 3 {
		t.Fatalf("按 lineage 对齐后应有 3 行，实际 %d: %+v", len(result.Steps), result.Steps)
	}
	changes := map[string]int{}
	var unchanged PreviousRoundStep
	for _, step := range result.Steps {
		changes[step.Change]++
		if step.Change == "unchanged" {
			unchanged = step
		}
		if step.Change == "added" && step.PreviousStep.ID != addedStep.ID {
			t.Fatalf("新增行应为当前第三行: %+v", step)
		}
	}
	if changes["unchanged"] != 1 || changes["removed"] != 1 || changes["added"] != 1 {
		t.Fatalf("步骤变更分类不正确: %+v", changes)
	}
	if unchanged.CurrentStepID == nil || unchanged.PreviousStep.ID != firstStep.ID ||
		!unchanged.PreviousStep.Act.HasContent || !strings.Contains(unchanged.PreviousStep.Act.PlainText, "参数读取正常") {
		t.Fatalf("上轮实测内容没有按 lineage 对齐: %+v", unchanged)
	}

	secondCases, err := service.ListCasesByProjectRound(ctx, projectID, copied.Round.ID)
	if err != nil {
		t.Fatalf("读取第二轮用例摘要失败: %v", err)
	}
	secondCases, err = service.AnnotatePreviousRoundAvailability(ctx, secondCases)
	if err != nil || len(secondCases) != 1 || !secondCases[0].PreviousRoundAvailable {
		t.Fatalf("第二轮上轮记录可用标记不正确: %+v err=%v", secondCases, err)
	}
	firstCases, err := service.ListCasesByProjectRound(ctx, projectID, firstRound.ID)
	if err != nil {
		t.Fatalf("读取首轮用例摘要失败: %v", err)
	}
	firstCases, err = service.AnnotatePreviousRoundAvailability(ctx, firstCases)
	if err != nil || len(firstCases) != 1 || firstCases[0].PreviousRoundAvailable {
		t.Fatalf("首轮不应标记上轮记录: %+v err=%v", firstCases, err)
	}
	if _, err := service.PreviousRoundResult(ctx, firstCase.ID); !errors.Is(err, ErrNoPreviousRoundResult) {
		t.Fatalf("首轮读取上轮实测应返回无记录，实际 %v", err)
	}
}
