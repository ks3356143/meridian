package testitems

import (
	"context"
	"errors"
	"testing"
)

func TestTestItemAndFolderUseRequestedRound(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	firstRound, err := service.EnsureRound(ctx, projectID)
	if err != nil {
		t.Fatalf("准备第 1 轮失败: %v", err)
	}
	second, err := service.CreateRoundCopy(ctx, CreateRoundCopyInput{
		ProjectID: projectID, SourceRoundID: firstRound.ID, TestItemIDs: []string{},
	})
	if err != nil {
		t.Fatalf("创建第 2 轮失败: %v", err)
	}

	if _, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, RoundID: second.Round.ID, TypeCode: "DC", Name: "第二轮静态项",
	}); !errors.Is(err, ErrStaticAfterFirstRound) {
		t.Fatalf("第二轮创建静态项应被拒绝，实际 %v", err)
	}

	firstFolder, err := service.CreateFolder(ctx, CreateFolderInput{
		ProjectID: projectID, RoundID: firstRound.ID, TypeCode: "SU", Name: "第一轮功能组",
	})
	if err != nil {
		t.Fatalf("在第 1 轮创建文件夹失败: %v", err)
	}
	if _, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, RoundID: second.Round.ID, TypeCode: "SU", Name: "错误轮次文件夹项", FolderID: &firstFolder.ID,
	}); !errors.Is(err, ErrFolderMismatch) {
		t.Fatalf("跨轮文件夹应被拒绝，实际 %v", err)
	}
	folder, err := service.CreateFolder(ctx, CreateFolderInput{
		ProjectID: projectID, RoundID: second.Round.ID, TypeCode: "SU", Name: "第二轮功能组",
	})
	if err != nil {
		t.Fatalf("在第 2 轮创建文件夹失败: %v", err)
	}
	item, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, RoundID: second.Round.ID, TypeCode: "SU", Name: "第二轮测试项", FolderID: &folder.ID,
	})
	if err != nil {
		t.Fatalf("在第 2 轮创建测试项失败: %v", err)
	}
	if item.RoundID != second.Round.ID || folder.RoundID != second.Round.ID {
		t.Fatalf("树对象没有落在指定轮次: item=%+v folder=%+v", item, folder)
	}
	firstItems, err := service.ListTestItemsByRound(ctx, projectID, firstRound.ID)
	if err != nil || len(firstItems) != 0 {
		t.Fatalf("第 2 轮创建污染第 1 轮测试项: items=%+v err=%v", firstItems, err)
	}
	secondItems, err := service.ListTestItemsByRound(ctx, projectID, second.Round.ID)
	if err != nil || len(secondItems) != 1 || secondItems[0].ID != item.ID {
		t.Fatalf("第 2 轮测试项查询不正确: items=%+v err=%v", secondItems, err)
	}

	subItem, err := service.CreateSubItem(ctx, item.ID, "第二轮子项")
	if err != nil {
		t.Fatalf("创建第 2 轮子项失败: %v", err)
	}
	itemCase, err := service.CreateCase(ctx, item.ID, "第二轮用例")
	if err != nil {
		t.Fatalf("创建第 2 轮用例失败: %v", err)
	}
	step, err := service.CreateStep(ctx, itemCase.ID, "第二轮步骤")
	if err != nil {
		t.Fatalf("创建第 2 轮步骤失败: %v", err)
	}
	if subItem.TestItemID != item.ID || itemCase.TestItemID != item.ID || step.TestCaseID != itemCase.ID {
		t.Fatalf("子对象没有继承目标轮次父链: sub=%+v case=%+v step=%+v", subItem, itemCase, step)
	}

	defaultItem, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "IO", Name: "默认当前轮测试项",
	})
	if err != nil {
		t.Fatalf("按当前轮创建测试项失败: %v", err)
	}
	if defaultItem.RoundID != second.Round.ID {
		t.Fatalf("省略 roundId 时应落到当前最新轮，实际 %s，期望 %s", defaultItem.RoundID, second.Round.ID)
	}
	defaultFolder, err := service.CreateFolder(ctx, CreateFolderInput{ProjectID: projectID, TypeCode: "IO", Name: "默认当前轮文件夹"})
	if err != nil {
		t.Fatalf("按当前轮创建文件夹失败: %v", err)
	}
	if defaultFolder.RoundID != second.Round.ID {
		t.Fatalf("文件夹省略 roundId 时应落到当前最新轮，实际 %s，期望 %s", defaultFolder.RoundID, second.Round.ID)
	}
}

func TestRequirementTestItemsFilterByRoundAndDefaultToCurrent(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	firstRound, err := service.EnsureRound(ctx, projectID)
	if err != nil {
		t.Fatalf("准备第 1 轮失败: %v", err)
	}
	seedRequirementForCreate(t, service, projectID, "req-round-filter", "轮次过滤需求", "functional", "official", "pending", "需求描述")
	firstItem, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, RoundID: firstRound.ID, RequirementID: "req-round-filter",
	})
	if err != nil {
		t.Fatalf("创建第 1 轮关联测试项失败: %v", err)
	}
	second, err := service.CreateRoundCopy(ctx, CreateRoundCopyInput{
		ProjectID: projectID, SourceRoundID: firstRound.ID, TestItemIDs: []string{},
	})
	if err != nil {
		t.Fatalf("创建第 2 轮失败: %v", err)
	}
	secondItem, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, RoundID: second.Round.ID, RequirementID: "req-round-filter",
	})
	if err != nil {
		t.Fatalf("创建第 2 轮关联测试项失败: %v", err)
	}

	firstItems, err := service.ListTestItemsByRequirement(ctx, "req-round-filter", firstRound.ID)
	if err != nil || len(firstItems) != 1 || firstItems[0].ID != firstItem.ID {
		t.Fatalf("第 1 轮需求测试项过滤不正确: %+v err=%v", firstItems, err)
	}
	secondItems, err := service.ListTestItemsByRequirement(ctx, "req-round-filter", second.Round.ID)
	if err != nil || len(secondItems) != 1 || secondItems[0].ID != secondItem.ID {
		t.Fatalf("第 2 轮需求测试项过滤不正确: %+v err=%v", secondItems, err)
	}
	currentItems, err := service.ListTestItemsByRequirement(ctx, "req-round-filter", "")
	if err != nil || len(currentItems) != 1 || currentItems[0].ID != secondItem.ID {
		t.Fatalf("省略 roundId 时应返回当前最新轮: %+v err=%v", currentItems, err)
	}
	firstPreview, err := service.PreviewRequirementTestItems(ctx, projectID, firstRound.ID)
	if err != nil || firstPreview.Linked != 1 || firstPreview.Creatable != 0 {
		t.Fatalf("第 1 轮需求预览关联计数不正确: %+v err=%v", firstPreview, err)
	}
	secondPreview, err := service.PreviewRequirementTestItems(ctx, projectID, second.Round.ID)
	if err != nil || secondPreview.Linked != 1 || secondPreview.Creatable != 0 {
		t.Fatalf("第 2 轮需求预览关联计数不正确: %+v err=%v", secondPreview, err)
	}
}

func TestCrossRoundCaseAndStepMutationsAreRejected(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	firstRound, err := service.EnsureRound(ctx, projectID)
	if err != nil {
		t.Fatalf("准备第 1 轮失败: %v", err)
	}
	firstItem, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, RoundID: firstRound.ID, TypeCode: "SU", Name: "第 1 轮测试项",
	})
	if err != nil {
		t.Fatalf("创建第 1 轮测试项失败: %v", err)
	}
	firstCase, err := service.CreateCase(ctx, firstItem.ID, "第 1 轮用例")
	if err != nil {
		t.Fatalf("创建第 1 轮用例失败: %v", err)
	}
	firstStep, err := service.CreateStep(ctx, firstCase.ID, "第 1 轮步骤")
	if err != nil {
		t.Fatalf("创建第 1 轮步骤失败: %v", err)
	}
	second, err := service.CreateRoundCopy(ctx, CreateRoundCopyInput{
		ProjectID: projectID, SourceRoundID: firstRound.ID, TestItemIDs: []string{},
	})
	if err != nil {
		t.Fatalf("创建第 2 轮失败: %v", err)
	}
	secondItem, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, RoundID: second.Round.ID, TypeCode: "SU", Name: "第 2 轮测试项",
	})
	if err != nil {
		t.Fatalf("创建第 2 轮测试项失败: %v", err)
	}
	secondCase, err := service.CreateCase(ctx, secondItem.ID, "第 2 轮用例")
	if err != nil {
		t.Fatalf("创建第 2 轮用例失败: %v", err)
	}
	_, err = service.CreateStep(ctx, secondCase.ID, "第 2 轮步骤")
	if err != nil {
		t.Fatalf("创建第 2 轮步骤失败: %v", err)
	}
	if err := service.MoveCase(ctx, firstCase.ID, secondItem.ID, 0); !errors.Is(err, ErrRoundMismatch) {
		t.Fatalf("跨轮移动用例应拒绝，实际 %v", err)
	}
	if _, err := service.CopyCaseTo(ctx, firstCase.ID, secondItem.ID, 0); !errors.Is(err, ErrRoundMismatch) {
		t.Fatalf("跨轮复制用例应拒绝，实际 %v", err)
	}
	if _, err := service.ImportStep(ctx, secondCase.ID, firstStep.ID); !errors.Is(err, ErrRoundMismatch) {
		t.Fatalf("跨轮粘贴步骤应拒绝，实际 %v", err)
	}
}
