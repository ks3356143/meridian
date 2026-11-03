package testitems

import (
	"context"
	"errors"
	"testing"

	"chenmeridian/internal/modules/contentblocks"
)

func TestStaticCatalogMatchesSource(t *testing.T) {
	ruleCount := 0
	for _, group := range staticCatalogData.RuleGroups {
		ruleCount += len(group.Rules)
	}
	if ruleCount != 152 {
		t.Fatalf("代码编码规则应为 152 条，实际 %d", ruleCount)
	}
	if len(staticCatalogData.Analysis["C3"]) != 11 || len(staticCatalogData.Analysis["C4"]) != 7 {
		t.Fatalf("控制流/数据流检查项数量不正确: %+v", staticCatalogData.Analysis)
	}
	if len(staticCatalogData.ReviewSheets) != 4 {
		t.Fatalf("文档审查模板应为 4 张，实际 %d", len(staticCatalogData.ReviewSheets))
	}
}

func TestEnsureRecommendedStaticItemsByLevelAndPlatform(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	created, err := service.EnsureRecommendedStaticItems(ctx, projectID, false)
	if err != nil {
		t.Fatalf("生成推荐静态测试项失败: %v", err)
	}
	if len(created) != 3 {
		t.Fatalf("C 级 CPU 项目应补 DC/SA/CR 三项，实际 %+v", created)
	}
	again, err := service.EnsureRecommendedStaticItems(ctx, projectID, false)
	if err != nil || len(again) != 0 {
		t.Fatalf("重复进入不应再生成: %+v / %v", again, err)
	}
	staticCaseIDs := make([]string, 0, len(created))
	for _, item := range created {
		if _, err := service.blocks.SaveBlock(ctx, projectID, contentblocks.OwnerTypeTestItem, item.ID, "sub_item.static.ops", paraDoc("静态子项"), contentblocks.SaveBlockOptions{}, "user-1"); err != nil {
			t.Fatalf("保存静态测试项内容块失败: %v", err)
		}
		cases, caseErr := service.ListCases(ctx, item.ID)
		if caseErr != nil {
			t.Fatalf("查询静态壳用例失败: %v", caseErr)
		}
		for _, itemCase := range cases {
			staticCaseIDs = append(staticCaseIDs, itemCase.ID)
			if _, err := service.blocks.SaveBlock(ctx, projectID, contentblocks.OwnerTypeTestCase, itemCase.ID, "step.static.op", paraDoc("静态步骤"), contentblocks.SaveBlockOptions{}, "user-1"); err != nil {
				t.Fatalf("保存静态用例内容块失败: %v", err)
			}
		}
	}
	removed, err := service.DeleteAllStaticItems(ctx, projectID)
	if err != nil || removed != 3 {
		t.Fatalf("删除静态项失败: removed=%d err=%v", removed, err)
	}
	var remaining int64
	if err := service.db.Model(&contentblocks.ContentBlock{}).
		Where("owner_type = ? AND owner_id IN ?", contentblocks.OwnerTypeTestItem, []string{created[0].ID, created[1].ID, created[2].ID}).
		Count(&remaining).Error; err != nil {
		t.Fatalf("统计删除后静态内容块失败: %v", err)
	}
	if remaining != 0 {
		t.Fatalf("删除静态测试项后测试项内容块残留 %d 条", remaining)
	}
	if err := service.db.Model(&contentblocks.ContentBlock{}).
		Where("owner_type = ? AND owner_id IN ?", contentblocks.OwnerTypeTestCase, staticCaseIDs).
		Count(&remaining).Error; err != nil {
		t.Fatalf("统计删除后静态用例内容块失败: %v", err)
	}
	if remaining != 0 {
		t.Fatalf("删除静态测试项后用例内容块残留 %d 条", remaining)
	}
	afterDelete, err := service.EnsureRecommendedStaticItems(ctx, projectID, false)
	if err != nil || len(afterDelete) != 0 {
		t.Fatalf("用户删除后不应自动回填: %+v / %v", afterDelete, err)
	}
}

func TestStaticWorkbenchDefaultsAndVersionConflict(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	item, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "DC", Name: "文档审查"})
	if err != nil {
		t.Fatalf("创建 DC 失败: %v", err)
	}
	workbench, err := service.GetStaticWorkbench(ctx, item.ID)
	if err != nil {
		t.Fatalf("读取静态工作台失败: %v", err)
	}
	if workbench.Kind != "DC" || len(workbench.State.ReviewSheets) != 1 || len(workbench.State.Documents) == 0 {
		t.Fatalf("DC 默认工作台不正确: %+v", workbench)
	}
	if workbench.State.ReviewSheets[0].DocumentType != "需求规格说明" {
		t.Fatalf("项目初始应只生成需求规格说明审查单: %+v", workbench.State.ReviewSheets)
	}
	state := workbench.State
	state.ReviewSheets[0].Checks[0].Result = "passed"
	saved, err := service.SaveStaticWorkbench(ctx, item.ID, workbench.Version, state)
	if err != nil {
		t.Fatalf("保存静态工作台失败: %v", err)
	}
	if saved.Version != workbench.Version+1 || saved.State.ReviewSheets[0].Checks[0].Result != "passed" {
		t.Fatalf("保存结果不正确: %+v", saved)
	}
	if _, err := service.SaveStaticWorkbench(ctx, item.ID, workbench.Version, state); !errors.Is(err, ErrStaticVersionConflict) {
		t.Fatalf("旧版本保存应冲突，实际 %v", err)
	}
}

func TestValidateStaticStateRejectsDuplicateSheets(t *testing.T) {
	state := StaticState{ReviewSheets: []StaticReviewSheet{
		{TemplateCode: "DC-KIT", Name: "文档齐套性"},
		{TemplateCode: "rc-1", Name: "文档齐套性审查单"},
	}}
	if err := validateStaticState("DC", state); !errors.Is(err, ErrStaticInvalidState) {
		t.Fatalf("旧代码与新模板同义审查单应判为重复，实际 %v", err)
	}
}

func TestCarryFailedChecksMatchesLegacyAndNewSheetNames(t *testing.T) {
	current := StaticState{ReviewSheets: []StaticReviewSheet{{
		TemplateCode: "rc-1", Name: "文档齐套性审查单",
		Checks: []StaticReviewCheck{{Title: "是否有软件任务书", Result: "passed"}},
	}}}
	previous := StaticState{ReviewSheets: []StaticReviewSheet{{
		TemplateCode: "DC-KIT", Name: "文档齐套性",
		Checks: []StaticReviewCheck{{Title: "是否有软件任务书", Result: "failed", Notes: "缺少批准人签名"}},
	}}}
	if got := carryFailedChecks(&current, &previous); got != 1 {
		t.Fatalf("旧短名与新模板名应能匹配，实际带入 %d 项", got)
	}
	check := current.ReviewSheets[0].Checks[0]
	if !check.CarriedFromPrevious || check.Result != "passed" || check.PreviousNote != "缺少批准人签名" {
		t.Fatalf("带入结果不正确: %+v", check)
	}
}

func TestCarryFailedChecksKeepsCurrentManualWork(t *testing.T) {
	current := StaticState{ReviewSheets: []StaticReviewSheet{{
		TemplateCode: "rc-1", Name: "文档齐套性审查单", DocumentType: "需求规格说明",
		Checks: []StaticReviewCheck{{
			Title: "是否有软件任务书", Result: "failed", Notes: "本轮已记录", Images: []string{"asset-1"},
		}},
	}}}
	previous := StaticState{ReviewSheets: []StaticReviewSheet{{
		TemplateCode: "rc-1", Name: "文档齐套性审查单", DocumentType: "需求规格说明",
		Checks: []StaticReviewCheck{{Title: "是否有软件任务书", Result: "failed", Notes: "上轮问题"}},
	}}}
	if got := carryFailedChecks(&current, &previous); got != 0 {
		t.Fatalf("本轮已有失败记录时不应覆盖，实际带入 %d 项", got)
	}
	check := current.ReviewSheets[0].Checks[0]
	if check.Notes != "本轮已记录" || len(check.Images) != 1 || check.CarriedFromPrevious {
		t.Fatalf("本轮人工记录被覆盖: %+v", check)
	}
}

func TestCarryFailedChecksDoesNotCrossDocumentTypes(t *testing.T) {
	current := StaticState{ReviewSheets: []StaticReviewSheet{{
		TemplateCode: "rc-3", Name: "软件设计文档审查单", DocumentType: "概要设计",
		Checks: []StaticReviewCheck{{Title: "设计文档是否完整", Result: "passed"}},
	}}}
	previous := StaticState{ReviewSheets: []StaticReviewSheet{{
		TemplateCode: "rc-3", Name: "软件设计文档审查单", DocumentType: "详细设计",
		Checks: []StaticReviewCheck{{Title: "设计文档是否完整", Result: "failed"}},
	}}}
	if got := carryFailedChecks(&current, &previous); got != 0 {
		t.Fatalf("文档类型不同不应带入，实际带入 %d 项", got)
	}
}

func TestValidateStaticStateAllowsUnreviewed(t *testing.T) {
	state := StaticState{
		ReviewSheets: []StaticReviewSheet{{
			Name: "代码审查", Checks: []StaticReviewCheck{{Title: "检查", Result: "unreviewed"}},
		}},
		ReviewTargets: []StaticReviewTarget{{
			Name: "代码审查", Checks: []StaticReviewCheck{{Title: "检查", Result: "unreviewed"}},
		}},
	}
	if err := validateStaticState("CR", state); err != nil {
		t.Fatalf("CR 未审状态应可保存，实际 %v", err)
	}
}

func TestReviewCaseSummaryClearsStaleGeneratedText(t *testing.T) {
	if got := reviewCaseSummary("前一轮文档问题全部解决", 0, ""); got != "" {
		t.Fatalf("上一轮无失败时不应沿用旧复审文案，实际 %q", got)
	}
	if got := reviewCaseSummary("人工综述", 0, ""); got != "人工综述" {
		t.Fatalf("人工综述应保留，实际 %q", got)
	}
	if got := reviewCaseSummary("人工综述", 2, ""); got != "人工综述" {
		t.Fatalf("有失败时人工综述也应保留，实际 %q", got)
	}
	if got := reviewCaseSummary("测试项默认描述", 2, "测试项默认描述"); got != "前一轮文档问题全部解决" {
		t.Fatalf("默认描述应按自动文案替换，实际 %q", got)
	}
}
