package testitems

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"chenmeridian/internal/modules/contentblocks"
)

func TestPreviewRoundCopyDefaultsToDynamicFailedItems(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	round, err := service.EnsureRound(ctx, projectID)
	if err != nil {
		t.Fatalf("准备第 1 轮失败: %v", err)
	}

	failedItem, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "失败测试项"})
	if err != nil {
		t.Fatalf("创建失败测试项失败: %v", err)
	}
	passedItem, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "通过测试项"})
	if err != nil {
		t.Fatalf("创建通过测试项失败: %v", err)
	}
	staticItem, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "DC", Name: "文档审查"})
	if err != nil {
		t.Fatalf("创建静态测试项失败: %v", err)
	}
	failedCase, err := service.CreateCase(ctx, failedItem.ID, "失败用例")
	if err != nil {
		t.Fatalf("创建失败用例失败: %v", err)
	}
	passedCase, err := service.CreateCase(ctx, passedItem.ID, "通过用例")
	if err != nil {
		t.Fatalf("创建通过用例失败: %v", err)
	}
	if _, err := service.BatchAssignCases(ctx, failedItem.ID, BatchAssignCasesInput{
		CaseIDs: []string{failedCase.ID}, Status: ptr("failed"),
	}); err != nil {
		t.Fatalf("设置失败用例失败: %v", err)
	}
	if _, err := service.BatchAssignCases(ctx, passedItem.ID, BatchAssignCasesInput{
		CaseIDs: []string{passedCase.ID}, Status: ptr("passed"),
	}); err != nil {
		t.Fatalf("设置通过用例失败: %v", err)
	}

	preview, err := service.PreviewRoundCopy(ctx, projectID, round.ID)
	if err != nil {
		t.Fatalf("读取轮次复制预览失败: %v", err)
	}
	if preview.SourceRound.ID != round.ID || len(preview.TestItems) != 2 {
		t.Fatalf("预览来源或动态项数量不正确: %+v", preview)
	}
	byID := make(map[string]RoundCopyCandidate, len(preview.TestItems))
	for _, candidate := range preview.TestItems {
		byID[candidate.TestItemID] = candidate
	}
	failed := byID[failedItem.ID]
	if !failed.DefaultSelected || failed.PassedCount != 0 || failed.FailedCount != 1 || failed.TypeCode != "SU" {
		t.Fatalf("失败测试项统计不正确: %+v", failed)
	}
	passed := byID[passedItem.ID]
	if passed.DefaultSelected || passed.PassedCount != 1 || passed.FailedCount != 0 {
		t.Fatalf("通过测试项统计不正确: %+v", passed)
	}
	if _, exists := byID[staticItem.ID]; exists {
		t.Fatalf("静态测试项不应出现在可带入预览: %+v", staticItem)
	}
}

func TestCreateRoundCopyWithPartialTreeResetsExecutionAndKeepsSource(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	sourceRound, err := service.EnsureRound(ctx, projectID)
	if err != nil {
		t.Fatalf("准备第 1 轮失败: %v", err)
	}

	rootFolder, err := service.CreateFolder(ctx, CreateFolderInput{ProjectID: projectID, TypeCode: "SU", Name: "功能组"})
	if err != nil {
		t.Fatalf("创建根文件夹失败: %v", err)
	}
	childFolder, err := service.CreateFolder(ctx, CreateFolderInput{
		ProjectID: projectID, TypeCode: "SU", ParentID: &rootFolder.ID, Name: "参数组",
	})
	if err != nil {
		t.Fatalf("创建子文件夹失败: %v", err)
	}
	sourceItem, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "SU", Name: "参数管理", FolderID: &childFolder.ID,
	})
	if err != nil {
		t.Fatalf("创建来源测试项失败: %v", err)
	}
	otherItem, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "SU", Name: "不选测试项",
	})
	if err != nil {
		t.Fatalf("创建未选测试项失败: %v", err)
	}
	if _, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "DC", Name: "文档审查",
	}); err != nil {
		t.Fatalf("创建静态测试项失败: %v", err)
	}

	subItem, err := service.CreateSubItem(ctx, sourceItem.ID, "参数读取")
	if err != nil {
		t.Fatalf("创建子项失败: %v", err)
	}
	if _, err := service.UpdateSubItem(ctx, subItem.ID, UpdateSubItemInput{
		Description: ptr("验证读取"), Ops: ptr("打开界面"), Expected: ptr("显示参数"),
	}); err != nil {
		t.Fatalf("更新子项失败: %v", err)
	}
	if _, err := service.blocks.SaveBlock(ctx, projectID, contentblocks.OwnerTypeTestItem, sourceItem.ID,
		contentblocks.SubItemBlockPrefix(subItem.ID)+"ops", paraDoc("子项操作正文"), contentblocks.SaveBlockOptions{}, "user-1"); err != nil {
		t.Fatalf("保存子项内容块失败: %v", err)
	}

	failedCase, err := service.CreateCase(ctx, sourceItem.ID, "读取参数")
	if err != nil {
		t.Fatalf("创建失败用例失败: %v", err)
	}
	passedCase, err := service.CreateCase(ctx, sourceItem.ID, "读取默认值")
	if err != nil {
		t.Fatalf("创建通过用例失败: %v", err)
	}
	step, err := service.CreateStep(ctx, failedCase.ID, "显示参数列表")
	if err != nil {
		t.Fatalf("创建步骤失败: %v", err)
	}
	if _, err := service.SaveStepBlock(ctx, step.ID, contentblocks.StepKindOp, paraDoc("打开参数页面"), "user-1"); err != nil {
		t.Fatalf("保存操作块失败: %v", err)
	}
	if _, err := service.SaveStepBlock(ctx, step.ID, contentblocks.StepKindAct, paraDoc("参数显示异常"), "user-1"); err != nil {
		t.Fatalf("保存实测块失败: %v", err)
	}
	if _, err := service.UpdateStep(ctx, step.ID, UpdateStepInput{Passed: ptr("fail")}); err != nil {
		t.Fatalf("设置步骤失败状态失败: %v", err)
	}
	if _, err := service.BatchAssignCases(ctx, sourceItem.ID, BatchAssignCasesInput{
		CaseIDs: []string{failedCase.ID}, TesterID: ptr("user-1"), Status: ptr("failed"), ExecDate: ptr("2026-10-28"),
	}); err != nil {
		t.Fatalf("设置失败用例执行字段失败: %v", err)
	}
	if _, err := service.UpdateCase(ctx, failedCase.ID, UpdateCaseInput{
		MonitorID: ptr("user-1"), Notes: ptr("需要修复"), NotExecutedReason: ptr("已执行"),
	}); err != nil {
		t.Fatalf("更新失败用例字段失败: %v", err)
	}
	if _, err := service.BatchAssignCases(ctx, sourceItem.ID, BatchAssignCasesInput{
		CaseIDs: []string{passedCase.ID}, TesterID: ptr("user-1"), Status: ptr("passed"), ExecDate: ptr("2026-10-28"),
	}); err != nil {
		t.Fatalf("设置通过用例执行字段失败: %v", err)
	}
	seedRequirementForCreate(t, service, projectID, "req-round-copy", "轮次复制需求", "functional", "official", "pending", "轮次复制需求描述")
	if err := service.LinkRequirement(ctx, projectID, sourceItem.ID, "req-round-copy"); err != nil {
		t.Fatalf("关联需求失败: %v", err)
	}

	beforeFolders := listRoundFoldersForTest(t, service, projectID, sourceRound.ID)
	beforeItems := listRoundItemsForTest(t, service, projectID, sourceRound.ID)
	beforeSubItems := listSubItemsForTest(t, service, sourceItem.ID)
	beforeCases := listCasesForTest(t, service, sourceItem.ID)
	beforeSteps := listStepsForTest(t, service, failedCase.ID)
	beforeBlocks := listBlocksForTest(t, service, sourceItem.ID, subItem.ID, failedCase.ID)
	beforeLinks := listRequirementLinksForTest(t, service, sourceItem.ID)

	result, err := service.CreateRoundCopy(ctx, CreateRoundCopyInput{
		ProjectID: projectID, SourceRoundID: sourceRound.ID, TestItemIDs: []string{sourceItem.ID},
		DutVersion: "V2.0", ChangeReason: "验证复制", ReasonSummary: "未通过用例",
	})
	if err != nil {
		t.Fatalf("复制轮次失败: %v", err)
	}
	if result.Round.RoundNumber != 2 || result.Round.RoundType != "regression" || result.Round.SourceRoundID == nil || *result.Round.SourceRoundID != sourceRound.ID {
		t.Fatalf("新轮次元数据不正确: %+v", result.Round)
	}
	if result.FolderCount != 2 || result.TestItemCount != 1 || result.SubItemCount != 1 || result.CaseCount != 2 || result.StepCount != 1 || result.RequirementLinkCount != 1 || result.OpBlockCount != 1 {
		t.Fatalf("复制结果计数不正确: %+v", result)
	}

	targetItems := listRoundItemsForTest(t, service, projectID, result.Round.ID)
	if len(targetItems) != 1 {
		t.Fatalf("目标轮应只有 1 个测试项，实际 %+v", targetItems)
	}
	targetItem := targetItems[0]
	if targetItem.ID == sourceItem.ID || targetItem.ID == otherItem.ID || targetItem.LineageKey != sourceItem.LineageKey || targetItem.RoundID != result.Round.ID {
		t.Fatalf("目标测试项身份不正确: source=%+v target=%+v", sourceItem, targetItem)
	}
	targetFolders := listRoundFoldersForTest(t, service, projectID, result.Round.ID)
	if len(targetFolders) != 2 || targetItem.FolderID == nil {
		t.Fatalf("目标文件夹链不完整: folders=%+v item=%+v", targetFolders, targetItem)
	}
	targetFolderByID := make(map[string]Folder, len(targetFolders))
	for _, folder := range targetFolders {
		if folder.ID == rootFolder.ID || folder.ID == childFolder.ID {
			t.Fatalf("文件夹 id 未重新生成: %+v", folder)
		}
		targetFolderByID[folder.ID] = folder
	}
	childCopy := targetFolderByID[*targetItem.FolderID]
	if childCopy.Name != childFolder.Name || childCopy.ParentID == nil {
		t.Fatalf("子文件夹复制不正确: %+v", childCopy)
	}
	rootCopy := targetFolderByID[*childCopy.ParentID]
	if rootCopy.Name != rootFolder.Name || rootCopy.ParentID != nil {
		t.Fatalf("根文件夹复制不正确: %+v", rootCopy)
	}

	targetSubItems := listSubItemsForTest(t, service, targetItem.ID)
	if len(targetSubItems) != 1 || targetSubItems[0].ID == subItem.ID || targetSubItems[0].Name != subItem.Name {
		t.Fatalf("子项复制不正确: %+v", targetSubItems)
	}
	targetSubBlocks := listBlocksForTest(t, service, targetItem.ID, targetSubItems[0].ID)
	if len(targetSubBlocks) != 1 || targetSubBlocks[0].BlockKey != contentblocks.SubItemBlockPrefix(targetSubItems[0].ID)+"ops" {
		t.Fatalf("子项内容块未重写: %+v", targetSubBlocks)
	}

	targetCases := listCasesForTest(t, service, targetItem.ID)
	if len(targetCases) != 2 {
		t.Fatalf("用例数量不正确: %+v", targetCases)
	}
	targetCaseByLineage := make(map[string]Case, len(targetCases))
	for _, targetCase := range targetCases {
		if targetCase.ID == failedCase.ID || targetCase.ID == passedCase.ID {
			t.Fatalf("用例 id 未重新生成: %+v", targetCase)
		}
		if targetCase.Status != "pending" || targetCase.TesterID != nil || targetCase.MonitorID != nil || targetCase.ExecDate != nil || targetCase.Notes != "" || targetCase.NotExecutedReason != "" {
			t.Fatalf("目标用例执行字段未清空: %+v", targetCase)
		}
		targetCaseByLineage[targetCase.LineageKey] = targetCase
	}
	targetFailedCase, ok := targetCaseByLineage[failedCase.LineageKey]
	if !ok || targetFailedCase.Name != failedCase.Name {
		t.Fatalf("失败用例 lineage 或设计字段未保留: %+v", targetCases)
	}
	targetSteps := listStepsForTest(t, service, targetFailedCase.ID)
	if len(targetSteps) != 1 || targetSteps[0].ID == step.ID || targetSteps[0].LineageKey != step.LineageKey || targetSteps[0].Passed != "none" {
		t.Fatalf("步骤复制或执行字段重置不正确: %+v", targetSteps)
	}
	targetCaseBlocks := listBlocksForTest(t, service, targetItem.ID, targetSubItems[0].ID, targetFailedCase.ID)
	opFound, actFound := false, false
	for _, block := range targetCaseBlocks {
		if block.BlockKey == contentblocks.StepBlockKey(targetSteps[0].ID, contentblocks.StepKindOp) {
			opFound = true
		}
		if block.BlockKey == contentblocks.StepBlockKey(targetSteps[0].ID, contentblocks.StepKindAct) {
			actFound = true
		}
	}
	if !opFound || actFound {
		t.Fatalf("目标步骤应只有 op 块: %+v", targetCaseBlocks)
	}
	if len(listRequirementLinksForTest(t, service, targetItem.ID)) != 1 {
		t.Fatal("目标测试项未复制需求关联")
	}

	if !jsonEqualForRoundCopy(t, beforeFolders, listRoundFoldersForTest(t, service, projectID, sourceRound.ID)) ||
		!jsonEqualForRoundCopy(t, beforeItems, listRoundItemsForTest(t, service, projectID, sourceRound.ID)) ||
		!jsonEqualForRoundCopy(t, beforeSubItems, listSubItemsForTest(t, service, sourceItem.ID)) ||
		!jsonEqualForRoundCopy(t, beforeCases, listCasesForTest(t, service, sourceItem.ID)) ||
		!jsonEqualForRoundCopy(t, beforeSteps, listStepsForTest(t, service, failedCase.ID)) ||
		!jsonEqualForRoundCopy(t, beforeBlocks, listBlocksForTest(t, service, sourceItem.ID, subItem.ID, failedCase.ID)) ||
		!jsonEqualForRoundCopy(t, beforeLinks, listRequirementLinksForTest(t, service, sourceItem.ID)) {
		t.Fatal("复制后来源轮数据发生变化")
	}
}

func TestCreateRoundCopyRejectsStaticAndAllowsEmptyRound(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	sourceRound, err := service.EnsureRound(ctx, projectID)
	if err != nil {
		t.Fatalf("准备第 1 轮失败: %v", err)
	}
	staticItem, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "DC", Name: "文档审查"})
	if err != nil {
		t.Fatalf("创建静态测试项失败: %v", err)
	}
	if _, err := service.CreateRoundCopy(ctx, CreateRoundCopyInput{
		ProjectID: projectID, SourceRoundID: sourceRound.ID, TestItemIDs: []string{staticItem.ID},
	}); !errors.Is(err, ErrRoundCopyStaticForbidden) {
		t.Fatalf("静态项应被明确拒绝，实际 %v", err)
	}
	var roundCount int64
	if err := service.db.Model(&Round{}).Where("project_id = ?", projectID).Count(&roundCount).Error; err != nil {
		t.Fatalf("统计轮次失败: %v", err)
	}
	if roundCount != 1 {
		t.Fatalf("拒绝后不应留下新轮次，实际 %d", roundCount)
	}

	result, err := service.CreateRoundCopy(ctx, CreateRoundCopyInput{
		ProjectID: projectID, SourceRoundID: sourceRound.ID, TestItemIDs: []string{},
	})
	if err != nil {
		t.Fatalf("创建空轮次失败: %v", err)
	}
	if result.Round.RoundNumber != 2 || result.TestItemCount != 0 || result.CaseCount != 0 || result.FolderCount != 0 {
		t.Fatalf("空轮次结果不正确: %+v", result)
	}
	items := listRoundItemsForTest(t, service, projectID, result.Round.ID)
	folders := listRoundFoldersForTest(t, service, projectID, result.Round.ID)
	if len(items) != 0 || len(folders) != 0 {
		t.Fatalf("空轮次不应有树数据: items=%+v folders=%+v", items, folders)
	}
}

func listRoundFoldersForTest(t *testing.T, service *Service, projectID, roundID string) []Folder {
	t.Helper()
	var folders []Folder
	if err := service.db.Where("project_id = ? AND round_id = ?", projectID, roundID).
		Order("id asc").Find(&folders).Error; err != nil {
		t.Fatalf("查询文件夹失败: %v", err)
	}
	return folders
}

func listRoundItemsForTest(t *testing.T, service *Service, projectID, roundID string) []TestItem {
	t.Helper()
	var items []TestItem
	if err := service.db.Where("project_id = ? AND round_id = ?", projectID, roundID).
		Order("id asc").Find(&items).Error; err != nil {
		t.Fatalf("查询测试项失败: %v", err)
	}
	return items
}

func listSubItemsForTest(t *testing.T, service *Service, testItemID string) []SubItem {
	t.Helper()
	var items []SubItem
	if err := service.db.Where("test_item_id = ?", testItemID).Order("id asc").Find(&items).Error; err != nil {
		t.Fatalf("查询子项失败: %v", err)
	}
	return items
}

func listCasesForTest(t *testing.T, service *Service, testItemID string) []Case {
	t.Helper()
	var cases []Case
	if err := service.db.Where("test_item_id = ?", testItemID).Order("id asc").Find(&cases).Error; err != nil {
		t.Fatalf("查询用例失败: %v", err)
	}
	return cases
}

func listStepsForTest(t *testing.T, service *Service, caseID string) []CaseStep {
	t.Helper()
	var steps []CaseStep
	if err := service.db.Where("test_case_id = ?", caseID).Order("id asc").Find(&steps).Error; err != nil {
		t.Fatalf("查询步骤失败: %v", err)
	}
	return steps
}

func listBlocksForTest(t *testing.T, service *Service, testItemID, subItemID string, caseIDs ...string) []contentblocks.ContentBlock {
	t.Helper()
	ownerIDs := []string{testItemID, subItemID}
	ownerIDs = append(ownerIDs, caseIDs...)
	var blocks []contentblocks.ContentBlock
	if err := service.db.Where("owner_id IN ?", ownerIDs).Order("id asc").Find(&blocks).Error; err != nil {
		t.Fatalf("查询内容块失败: %v", err)
	}
	return blocks
}

func listRequirementLinksForTest(t *testing.T, service *Service, testItemID string) []RequirementLink {
	t.Helper()
	var links []RequirementLink
	if err := service.db.Where("test_item_id = ?", testItemID).Order("id asc").Find(&links).Error; err != nil {
		t.Fatalf("查询需求关联失败: %v", err)
	}
	return links
}

func jsonEqualForRoundCopy(t *testing.T, left, right any) bool {
	t.Helper()
	leftJSON, err := json.Marshal(left)
	if err != nil {
		t.Fatalf("序列化左侧数据失败: %v", err)
	}
	rightJSON, err := json.Marshal(right)
	if err != nil {
		t.Fatalf("序列化右侧数据失败: %v", err)
	}
	if string(leftJSON) != string(rightJSON) {
		t.Logf("左侧: %s", leftJSON)
		t.Logf("右侧: %s", rightJSON)
		return false
	}
	return true
}
