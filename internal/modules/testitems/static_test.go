package testitems

import (
	"context"
	"errors"
	"testing"
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
	removed, err := service.DeleteAllStaticItems(ctx, projectID)
	if err != nil || removed != 3 {
		t.Fatalf("删除静态项失败: removed=%d err=%v", removed, err)
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
	if workbench.Kind != "DC" || len(workbench.State.ReviewSheets) != 3 || len(workbench.State.Documents) == 0 {
		t.Fatalf("DC 默认工作台不正确: %+v", workbench)
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
