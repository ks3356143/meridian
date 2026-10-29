package testitems

import (
	"context"
	"errors"
	"testing"
)

func TestTypeCoveragePassRateStaticApplicabilityAndNotes(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	round1, err := service.EnsureRound(ctx, projectID)
	if err != nil {
		t.Fatalf("准备第 1 轮失败: %v", err)
	}
	item, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "SU", Name: "参数管理",
	})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	passed, err := service.CreateCase(ctx, item.ID, "通过用例")
	if err != nil {
		t.Fatalf("创建通过用例失败: %v", err)
	}
	failed, err := service.CreateCase(ctx, item.ID, "未通过用例")
	if err != nil {
		t.Fatalf("创建未通过用例失败: %v", err)
	}
	if _, err := service.BatchAssignCases(ctx, item.ID, BatchAssignCasesInput{
		CaseIDs: []string{passed.ID}, Status: ptr("passed"),
	}); err != nil {
		t.Fatalf("设置通过状态失败: %v", err)
	}
	if _, err := service.BatchAssignCases(ctx, item.ID, BatchAssignCasesInput{
		CaseIDs: []string{failed.ID}, Status: ptr("failed"),
	}); err != nil {
		t.Fatalf("设置未通过状态失败: %v", err)
	}
	if _, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "DC", Name: "文档审查",
	}); err != nil {
		t.Fatalf("创建静态测试项失败: %v", err)
	}

	first, err := service.TypeCoverage(ctx, projectID, round1.ID)
	if err != nil {
		t.Fatalf("读取首轮覆盖失败: %v", err)
	}
	su := findCoverageType(t, first.Types, "SU")
	if su.Status != coverageStatusCovered || su.ItemCount != 1 || su.CaseCount != 2 {
		t.Fatalf("SU 覆盖统计不正确: %+v", su)
	}
	if su.PassRate == nil || *su.PassRate != 50 {
		t.Fatalf("SU 通过率应为 50，实际 %+v", su.PassRate)
	}
	if dc := findCoverageType(t, first.Types, "DC"); dc.Status != coverageStatusCovered {
		t.Fatalf("DC 首轮应有测试项: %+v", dc)
	}
	io := findCoverageType(t, first.Types, "IO")
	if io.Status != coverageStatusMissing || !io.Applicable {
		t.Fatalf("未覆盖动态类型应为未说明: %+v", io)
	}
	if _, err := service.SaveTypeCoverageNote(ctx, projectID, round1.ID, "SU", "已有测试项", "user-1"); !errors.Is(err, ErrCoverageTypeCovered) {
		t.Fatalf("已有测试项的类型应拒绝说明，实际 %v", err)
	}
	if _, err := service.SaveTypeCoverageNote(ctx, projectID, round1.ID, "IO", "本期不涉及接口测试。", "user-1"); err != nil {
		t.Fatalf("保存不测评说明失败: %v", err)
	}
	first, err = service.TypeCoverage(ctx, projectID, round1.ID)
	if err != nil {
		t.Fatalf("重读首轮覆盖失败: %v", err)
	}
	io = findCoverageType(t, first.Types, "IO")
	if io.Status != coverageStatusExplained || io.Note == nil || io.Note.UpdatedByName != "测试员" {
		t.Fatalf("不测评说明未正确回显: %+v", io)
	}

	secondCopy, err := service.CreateRoundCopy(ctx, CreateRoundCopyInput{
		ProjectID: projectID, SourceRoundID: round1.ID, TestItemIDs: []string{}, Name: "第二轮",
	})
	if err != nil {
		t.Fatalf("创建空第二轮失败: %v", err)
	}
	second, err := service.TypeCoverage(ctx, projectID, secondCopy.Round.ID)
	if err != nil {
		t.Fatalf("读取第二轮覆盖失败: %v", err)
	}
	dc := findCoverageType(t, second.Types, "DC")
	if dc.Applicable || dc.Status != coverageStatusNotApplicable || dc.Rounds[0].Status != coverageStatusNotApplicable {
		t.Fatalf("第二轮静态类型应标记不适用: %+v", dc)
	}
	if second.Summary.NotApplicable != 4 {
		t.Fatalf("第二轮应有 4 个静态类型不适用，实际 %d", second.Summary.NotApplicable)
	}
	if _, err := service.SaveTypeCoverageNote(ctx, projectID, secondCopy.Round.ID, "DC", "静态已首轮完成", "user-1"); !errors.Is(err, ErrCoverageNotApplicable) {
		t.Fatalf("第二轮静态类型应拒绝说明，实际 %v", err)
	}
	if _, err := service.SaveTypeCoverageNote(ctx, projectID, "all", "IO", "不应保存", "user-1"); !errors.Is(err, ErrCoverageRoundRequired) {
		t.Fatalf("全部模式应拒绝写入，实际 %v", err)
	}

	all, err := service.TypeCoverage(ctx, projectID, "all")
	if err != nil {
		t.Fatalf("读取全部轮次覆盖失败: %v", err)
	}
	if !all.AllRounds || len(all.Rounds) != 2 || all.Summary.TestItemCount != 2 || all.Summary.CaseCount != 3 {
		t.Fatalf("全部轮次汇总不正确: %+v", all.Summary)
	}
}

func findCoverageType(t *testing.T, types []TypeCoverageCard, code string) TypeCoverageCard {
	t.Helper()
	for _, itemType := range types {
		if itemType.Code == code {
			return itemType
		}
	}
	t.Fatalf("类型 %s 不存在", code)
	return TypeCoverageCard{}
}
