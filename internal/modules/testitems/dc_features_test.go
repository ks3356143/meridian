package testitems

import (
	"context"
	"errors"
	"testing"
)

func TestReviewChecklistTemplatesSeedAndCRUD(t *testing.T) {
	service, _ := newTestService(t)
	ctx := context.Background()

	templates, err := service.ListReviewChecklistTemplates(ctx)
	if err != nil {
		t.Fatalf("读取审查单模板失败: %v", err)
	}
	if len(templates) != 3 {
		t.Fatalf("应内置 3 张可用模板，实际 %d", len(templates))
	}
	counts := map[string]int{}
	for _, template := range templates {
		counts[template.Code] = len(template.Items)
	}
	if counts["rc-2"] != 12 || counts["rc-3"] != 10 || counts["rc-4"] != 6 {
		t.Fatalf("模板检查项数量不正确: %+v", counts)
	}

	updated, err := service.UpdateReviewChecklistTemplate(ctx, templates[0].ID, ReviewChecklistTemplateInput{
		Name: "软件需求规格说明审查单（改）", Appendix: "附录A.2", DocumentType: "需求规格说明", DocumentVersion: "V1.0",
		Items: []ReviewChecklistItem{
			{Category: "规范性", Title: "文档标识正确", Basis: "GJB 438C §4.1", GoodPractice: "<p>示例</p>"},
			{Category: "完整性", Title: "签署完整", Basis: "GJB 438C §4.3"},
		},
	})
	if err != nil {
		t.Fatalf("保存模板失败: %v", err)
	}
	if updated.Name != "软件需求规格说明审查单（改）" || len(updated.Items) != 2 || updated.Items[1].Seq != 2 {
		t.Fatalf("模板保存结果不正确: %+v", updated)
	}

	created, err := service.CreateReviewChecklistTemplate(ctx, ReviewChecklistTemplateInput{
		Name: "自定义任务书审查单", DocumentType: "任务书",
		Items: []ReviewChecklistItem{{Category: "准确性", Title: "自定义检查项"}},
	})
	if err != nil {
		t.Fatalf("新建模板失败: %v", err)
	}
	if len(created.Items) != 1 || created.Code == "" {
		t.Fatalf("新建模板结果不正确: %+v", created)
	}

	if err := service.DeleteReviewChecklistTemplate(ctx, created.ID); err != nil {
		t.Fatalf("删除模板失败: %v", err)
	}
}

func TestDCWorkbenchDefaultsToPassAndPlatformDocuments(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	item, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "DC", Name: "文档审查"})
	if err != nil {
		t.Fatalf("创建 DC 失败: %v", err)
	}
	workbench, err := service.GetStaticWorkbench(ctx, item.ID)
	if err != nil {
		t.Fatalf("读取 DC 工作台失败: %v", err)
	}
	for _, sheet := range workbench.State.ReviewSheets {
		for _, check := range sheet.Checks {
			if check.Result != "passed" {
				t.Fatalf("检查项默认应为通过: %s = %s", check.Title, check.Result)
			}
		}
	}
	for _, doc := range workbench.State.Documents {
		if doc.Name == "软件用户手册" || doc.Name == "固件保障手册" {
			t.Fatalf("CPU 平台不应默认带 %s", doc.Name)
		}
	}
	if len(workbench.State.Documents) != 12 {
		t.Fatalf("CPU 平台推荐文档应为 12 项，实际 %d", len(workbench.State.Documents))
	}
	if workbench.Catalog.ReviewSheets[0].Checks[0].GoodPractice == "" {
		t.Fatalf("模板应带推荐做法")
	}
}

func TestDCImportPreviousFailedChecksAcrossRounds(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	firstRound, err := service.EnsureRound(ctx, projectID)
	if err != nil {
		t.Fatalf("准备第 1 轮失败: %v", err)
	}
	item, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, RoundID: firstRound.ID, TypeCode: "DC", Name: "文档审查",
	})
	if err != nil {
		t.Fatalf("创建 DC 失败: %v", err)
	}
	workbench, err := service.GetStaticWorkbench(ctx, item.ID)
	if err != nil {
		t.Fatalf("读取 DC 工作台失败: %v", err)
	}
	state := workbench.State
	state.ReviewSheets[0].Checks[0].Result = "failed"
	state.ReviewSheets[0].Checks[0].Notes = "缺少批准人签名"
	if _, err := service.SaveStaticWorkbench(ctx, item.ID, workbench.Version, state); err != nil {
		t.Fatalf("保存第 1 轮不通过项失败: %v", err)
	}

	copied, err := service.CreateRoundCopy(ctx, CreateRoundCopyInput{
		ProjectID: projectID, SourceRoundID: firstRound.ID, TestItemIDs: []string{}, ImportDcHistory: true,
	})
	if err != nil {
		t.Fatalf("创建第 2 轮失败: %v", err)
	}
	if copied.StaticItemCount != 1 {
		t.Fatalf("第 2 轮应自动带入 1 个静态项，实际 %+v", copied)
	}
	roundItems := listRoundItemsForTest(t, service, projectID, copied.Round.ID)
	var secondItem TestItem
	for _, candidate := range roundItems {
		if candidate.TypeCode == "DC" {
			secondItem = candidate
		}
	}
	if secondItem.ID == "" {
		t.Fatalf("第 2 轮缺少 DC 测试项")
	}
	secondWorkbench, err := service.GetStaticWorkbench(ctx, secondItem.ID)
	if err != nil {
		t.Fatalf("读取第 2 轮工作台失败: %v", err)
	}
	carried := secondWorkbench.State.ReviewSheets[0].Checks[0]
	if !carried.CarriedFromPrevious || carried.Result != "passed" || carried.PreviousNote != "缺少批准人签名" {
		t.Fatalf("上轮不通过项应作为历史记录带入且默认通过: %+v", carried)
	}
	if secondWorkbench.State.ReviewSheets[0].Checks[1].Result != "passed" {
		t.Fatalf("未失败项应默认通过: %+v", secondWorkbench.State.ReviewSheets[0].Checks[1])
	}

	imported, err := service.ImportPreviousRoundFailedChecks(ctx, secondItem.ID)
	if err != nil {
		t.Fatalf("导入上轮不通过项失败: %v", err)
	}
	if imported.Version != secondWorkbench.Version {
		t.Fatalf("重复导入不应改动数据: version %d -> %d", secondWorkbench.Version, imported.Version)
	}
	cases, err := service.ListCases(ctx, secondItem.ID)
	if err != nil || len(cases) != 1 {
		t.Fatalf("第 2 轮 DC 应保留壳用例: %v / %v", cases, err)
	}
	if cases[0].Name != "文档审查执行（复审）" {
		t.Fatalf("复审用例名称不正确: %s", cases[0].Name)
	}
	if cases[0].Summary != "前一轮文档问题全部解决" {
		t.Fatalf("复审用例记录不正确: %s", cases[0].Summary)
	}
}

func TestDCCopyWithoutImportKeepsDefaults(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	firstRound, err := service.EnsureRound(ctx, projectID)
	if err != nil {
		t.Fatalf("准备第 1 轮失败: %v", err)
	}
	item, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, RoundID: firstRound.ID, TypeCode: "DC", Name: "文档审查",
	})
	if err != nil {
		t.Fatalf("创建 DC 失败: %v", err)
	}
	workbench, err := service.GetStaticWorkbench(ctx, item.ID)
	if err != nil {
		t.Fatalf("读取 DC 工作台失败: %v", err)
	}
	state := workbench.State
	state.ReviewSheets[0].Checks[0].Result = "failed"
	state.ReviewSheets[0].Checks[0].Notes = "缺少批准人签名"
	if _, err := service.SaveStaticWorkbench(ctx, item.ID, workbench.Version, state); err != nil {
		t.Fatalf("保存第 1 轮不通过项失败: %v", err)
	}

	copied, err := service.CreateRoundCopy(ctx, CreateRoundCopyInput{
		ProjectID: projectID, SourceRoundID: firstRound.ID, TestItemIDs: []string{},
	})
	if err != nil {
		t.Fatalf("创建第 2 轮失败: %v", err)
	}
	var secondItem TestItem
	for _, candidate := range listRoundItemsForTest(t, service, projectID, copied.Round.ID) {
		if candidate.TypeCode == "DC" {
			secondItem = candidate
		}
	}
	secondWorkbench, err := service.GetStaticWorkbench(ctx, secondItem.ID)
	if err != nil {
		t.Fatalf("读取第 2 轮工作台失败: %v", err)
	}
	for _, sheet := range secondWorkbench.State.ReviewSheets {
		for _, check := range sheet.Checks {
			if check.Result != "passed" || check.CarriedFromPrevious || check.PreviousNote != "" {
				t.Fatalf("未勾选导入时不应带入历史: %+v", check)
			}
		}
	}
	cases, _ := service.ListCases(ctx, secondItem.ID)
	if len(cases) != 1 || cases[0].Summary != "" {
		t.Fatalf("未勾选导入时不应写复审记录: %+v", cases)
	}
}

func TestIssueCreateCloseAndReopen(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	item, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "DC", Name: "文档审查"})
	if err != nil {
		t.Fatalf("创建 DC 失败: %v", err)
	}
	issue, err := service.CreateIssue(ctx, CreateIssueInput{
		ProjectID: projectID, TestItemID: item.ID, SheetID: "sheet-1", SheetName: "文档齐套性",
		CheckID: "check-1", CheckTitle: "文档标识正确", Title: "文档标识缺失",
		Description: "缺少密级标识", CreatedBy: "user-1",
	})
	if err != nil {
		t.Fatalf("立单失败: %v", err)
	}
	if issue.Status != "open" || issue.DefectType != "文档问题" || issue.Level != "一般" || issue.RoundNumber != 1 {
		t.Fatalf("立单默认值不正确: %+v", issue)
	}
	if _, err := service.CreateIssue(ctx, CreateIssueInput{
		ProjectID: projectID, TestItemID: item.ID, CheckID: "check-1", Title: "重复立单", CreatedBy: "user-1",
	}); !errors.Is(err, ErrIssueAlreadyOpen) {
		t.Fatalf("同一检查项重复立单应被拒绝，实际 %v", err)
	}

	closedNote := "已修订文档"
	closed, err := service.UpdateIssue(ctx, issue.ID, UpdateIssueInput{
		Status: ptrString("closed"), ClosureNote: &closedNote, UpdatedBy: "user-1",
	})
	if err != nil {
		t.Fatalf("关闭问题单失败: %v", err)
	}
	if closed.Status != "closed" || closed.ClosedAt == nil || closed.ClosureNote != closedNote {
		t.Fatalf("关闭结果不正确: %+v", closed)
	}

	reopened, err := service.UpdateIssue(ctx, issue.ID, UpdateIssueInput{Status: ptrString("open")})
	if err != nil {
		t.Fatalf("重新打开失败: %v", err)
	}
	if reopened.Status != "open" || reopened.ClosedAt != nil || reopened.ClosureNote != "" {
		t.Fatalf("重新打开结果不正确: %+v", reopened)
	}

	issues, err := service.ListIssues(ctx, projectID, "")
	if err != nil || len(issues) != 1 {
		t.Fatalf("问题单列表不正确: %+v / %v", issues, err)
	}
}

func ptrString(value string) *string { return &value }
