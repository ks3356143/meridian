package testitems

import (
	"context"
	"testing"
)

func TestTraceabilityMatrixGroupsRequirementsAndCountsGaps(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	round1, err := service.EnsureRound(ctx, projectID)
	if err != nil {
		t.Fatalf("准备第 1 轮失败: %v", err)
	}
	seedRequirementForCreate(t, service, projectID, "req-linked", "参数查询需求", "functional", "official", "completed", "应支持参数查询。")
	if err := service.db.Exec(`INSERT INTO software_requirements
		(id, project_id, source_version_id, chapter_number, external_identifier, name, description,
		 primary_kind, secondary_kinds, tags, origin, source_anchor, status, test_item_task_status,
		 created_at, updated_at)
		VALUES ('req-unlinked', ?, 'wov-1', '4.2', '', '未关联需求', '尚无测试项', 'functional', '[]', '[]',
		 'manual', '', 'official', 'pending', datetime('now'), datetime('now'))`, projectID).Error; err != nil {
		t.Fatalf("写入未关联需求失败: %v", err)
	}

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, RoundID: round1.ID, TypeCode: "SU", Name: "参数管理",
	})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	if err := service.LinkRequirement(ctx, projectID, item.ID, "req-linked"); err != nil {
		t.Fatalf("关联需求失败: %v", err)
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
	implicitItem, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, RoundID: round1.ID, TypeCode: "SU", Name: "隐含需求项", ImplicitRequirement: true,
	})
	if err != nil {
		t.Fatalf("创建隐含需求项失败: %v", err)
	}
	if _, err := service.CreateCase(ctx, implicitItem.ID, "隐含需求用例"); err != nil {
		t.Fatalf("创建隐含需求用例失败: %v", err)
	}

	result, err := service.Traceability(ctx, projectID, round1.ID)
	if err != nil {
		t.Fatalf("读取追溯矩阵失败: %v", err)
	}
	if result.Summary.Requirements != 2 || result.Summary.LinkedRequirements != 1 ||
		result.Summary.UnlinkedRequirements != 1 || result.Summary.TestItems != 2 ||
		result.Summary.ImplicitItems != 1 || result.Summary.UnlinkedItems != 0 ||
		result.Summary.Cases != 3 || result.Summary.Passed != 1 || result.Summary.Failed != 1 ||
		result.Summary.Pending != 1 {
		t.Fatalf("追溯摘要不正确: %+v", result.Summary)
	}
	if result.Summary.PassRate == nil || *result.Summary.PassRate != 50 {
		t.Fatalf("总通过率应为 50%%: %+v", result.Summary.PassRate)
	}
	if len(result.Rows) != 3 {
		t.Fatalf("当前轮应按 2 条用例 + 1 条缺口返回 3 行，实际 %d", len(result.Rows))
	}
	linkedRows := 0
	gapRows := 0
	for _, row := range result.Rows {
		switch row.RequirementID {
		case "req-linked":
			linkedRows++
			if row.TestItemID != item.ID || row.TestItemPassRate == nil || *row.TestItemPassRate != 50 {
				t.Fatalf("关联需求行的测试项或通过率不正确: %+v", row)
			}
		case "req-unlinked":
			gapRows++
			if row.TestItemID != "" || row.Case != nil {
				t.Fatalf("未关联需求应保留缺口行: %+v", row)
			}
		}
	}
	if linkedRows != 2 || gapRows != 1 {
		t.Fatalf("需求分组行数不正确: linked=%d gap=%d", linkedRows, gapRows)
	}

	second, err := service.CreateRoundCopy(ctx, CreateRoundCopyInput{
		ProjectID: projectID, SourceRoundID: round1.ID, TestItemIDs: []string{}, Name: "第二轮",
	})
	if err != nil {
		t.Fatalf("创建空第二轮失败: %v", err)
	}
	all, err := service.Traceability(ctx, projectID, "all")
	if err != nil {
		t.Fatalf("读取全轮追溯矩阵失败: %v", err)
	}
	if !all.AllRounds || len(all.Rounds) != 2 || all.Summary.Requirements != 2 ||
		all.Summary.TestItems != 2 || all.Summary.Cases != 3 {
		t.Fatalf("全轮追溯矩阵不正确: %+v rounds=%d", all.Summary, len(all.Rounds))
	}
	secondRows := 0
	for _, row := range all.Rows {
		if row.RoundID == second.Round.ID {
			secondRows++
			if row.TestItemID != "" {
				t.Fatalf("空第二轮不应出现测试项行: %+v", row)
			}
		}
	}
	if secondRows != 2 {
		t.Fatalf("全轮矩阵应包含第二轮两条需求缺口行，实际 %d", secondRows)
	}
}
