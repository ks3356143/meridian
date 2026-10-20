package testitems

import (
	"context"
	"testing"
	"time"

	"chenmeridian/internal/modules/contentblocks"
)

func TestBatchAssignCasesUpdatesSelectedOnly(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	item, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "参数管理"})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	first, err := service.CreateCase(ctx, item.ID, "参数查询")
	if err != nil {
		t.Fatalf("创建用例失败: %v", err)
	}
	second, err := service.CreateCase(ctx, item.ID, "参数新增")
	if err != nil {
		t.Fatalf("创建用例失败: %v", err)
	}

	updated, err := service.BatchAssignCases(ctx, item.ID, BatchAssignCasesInput{
		CaseIDs:  []string{first.ID},
		TesterID: ptr("user-1"),
		Status:   ptr("passed"),
		ExecDate: ptr("2026-10-20"),
	})
	if err != nil {
		t.Fatalf("批量指派失败: %v", err)
	}
	if len(updated) != 1 || updated[0].TesterID == nil || *updated[0].TesterID != "user-1" {
		t.Fatalf("测试人员未写入: %+v", updated)
	}
	if updated[0].Status != "passed" || updated[0].ExecDate == nil ||
		updated[0].ExecDate.Format("2006-01-02") != "2026-10-20" {
		t.Fatalf("状态或日期未写入: %+v", updated[0])
	}
	untouched, err := service.GetCase(ctx, second.ID)
	if err != nil {
		t.Fatalf("读取未选用例失败: %v", err)
	}
	if untouched.Status != "pending" || untouched.TesterID != nil || untouched.ExecDate != nil {
		t.Fatalf("未选用例不应被修改: %+v", untouched)
	}
}

func TestBatchAssignCasesRejectsForeignCase(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	firstItem, _ := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "参数管理"})
	secondItem, _ := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "日志管理"})
	foreign, _ := service.CreateCase(ctx, secondItem.ID, "日志查询")
	if _, err := service.BatchAssignCases(ctx, firstItem.ID, BatchAssignCasesInput{
		CaseIDs: []string{foreign.ID}, Status: ptr("passed"),
	}); err != ErrNotFound {
		t.Fatalf("跨测试项批量指派应拒绝，实际 %v", err)
	}
}

func TestSearchCasesFindsCaseFieldsAndStepBlocks(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	item, _ := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "参数管理"})
	itemCase, _ := service.CreateCase(ctx, item.ID, "参数查询")
	if _, err := service.UpdateCase(ctx, itemCase.ID, UpdateCaseInput{Summary: ptr("验证参数检索准确性")}); err != nil {
		t.Fatalf("更新综述失败: %v", err)
	}
	step, _ := service.CreateStep(ctx, itemCase.ID, "列表显示匹配参数")
	if _, err := service.SaveStepBlock(ctx, step.ID, contentblocks.StepKindOp, paraDoc("打开界面并输入关键字"), ""); err != nil {
		t.Fatalf("保存步骤正文失败: %v", err)
	}
	hits, err := service.SearchCases(ctx, item.ID, "参数")
	if err != nil {
		t.Fatalf("测试项内查找失败: %v", err)
	}
	if len(hits) < 2 {
		t.Fatalf("应命中用例字段和步骤，实际 %+v", hits)
	}
	foundStep := false
	for _, hit := range hits {
		if hit.Kind == "step" && hit.StepID == step.ID && hit.Field == "期望结果" {
			foundStep = true
		}
	}
	if !foundStep {
		t.Fatalf("未返回步骤命中: %+v", hits)
	}
	blockHits, err := service.SearchCases(ctx, item.ID, "关键字")
	if err != nil || len(blockHits) == 0 || blockHits[0].Field != "输入及操作" {
		t.Fatalf("应命中步骤富文本正文，实际 %+v / %v", blockHits, err)
	}
}

func TestCopyCaseToTargetAtIndexCopiesDesignOnly(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	sourceItem, _ := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "参数管理"})
	targetItem, _ := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "日志管理"})
	source, _ := service.CreateCase(ctx, sourceItem.ID, "参数查询")
	first, _ := service.CreateCase(ctx, targetItem.ID, "日志写入")
	last, _ := service.CreateCase(ctx, targetItem.ID, "日志检索")
	step, _ := service.CreateStep(ctx, source.ID, "显示结果")
	if _, err := service.SaveStepBlock(ctx, step.ID, contentblocks.StepKindOp, paraDoc("打开查询界面"), ""); err != nil {
		t.Fatalf("保存设计内容失败: %v", err)
	}
	if _, err := service.SaveStepBlock(ctx, step.ID, contentblocks.StepKindAct, paraDoc("截图证据"), ""); err != nil {
		t.Fatalf("保存实测内容失败: %v", err)
	}

	copied, err := service.CopyCaseTo(ctx, source.ID, targetItem.ID, 1)
	if err != nil {
		t.Fatalf("复制用例失败: %v", err)
	}
	if copied.Name != "参数查询-副本" || copied.Status != "pending" || copied.ExecDate != nil {
		t.Fatalf("副本执行状态未重置: %+v", copied)
	}
	cases, err := service.ListCases(ctx, targetItem.ID)
	if err != nil {
		t.Fatalf("读取目标用例失败: %v", err)
	}
	if len(cases) != 3 || cases[0].ID != first.ID || cases[1].ID != copied.ID || cases[2].ID != last.ID {
		t.Fatalf("复制落点不正确: %+v", cases)
	}
	views, err := service.ListStepsWithBlocks(ctx, copied.ID)
	if err != nil {
		t.Fatalf("读取副本步骤失败: %v", err)
	}
	if len(views) != 1 || !views[0].Op.HasContent || views[0].Op.PlainText != "打开查询界面" || views[0].Act.HasContent {
		t.Fatalf("副本应只带设计内容: %+v", views)
	}
	if !copied.UpdatedAt.Before(time.Now().Add(time.Minute)) {
		t.Fatalf("更新时间为异常未来值: %v", copied.UpdatedAt)
	}
}
