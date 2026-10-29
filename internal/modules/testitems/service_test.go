package testitems

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"

	"chenmeridian/internal/database"
	"chenmeridian/internal/modules/contentblocks"
	"chenmeridian/migrations"
)

func newTestService(t *testing.T) (*Service, string) {
	t.Helper()

	db, err := database.Open(filepath.Join(t.TempDir(), "meridian.db"))
	if err != nil {
		t.Fatalf("打开测试数据库失败: %v", err)
	}
	t.Cleanup(func() {
		if sqlDB, closeErr := db.DB(); closeErr == nil {
			_ = sqlDB.Close()
		}
	})
	if err := database.Migrate(db, migrations.FS); err != nil {
		t.Fatalf("执行迁移失败: %v", err)
	}

	projectID := "test-project-001"
	if err := db.Exec(`
INSERT INTO users (id, username, display_name, password_hash, created_at, updated_at)
VALUES ('user-1', 'tester', '测试员', 'hash', datetime('now'), datetime('now'))`).Error; err != nil {
		t.Fatalf("写入测试用户失败: %v", err)
	}
	if err := db.Exec(`
INSERT INTO projects (id, code, name, nature, platform, software_type, classification, security_level, organization, owner_id, status, created_at, updated_at)
VALUES (?, 'R99999', '单元测试项目', '鉴定测评', 'CPU/非嵌', '新研', '内部', 'C', '测试单位', 'user-1', '编制大纲中', datetime('now'), datetime('now'))`,
		projectID).Error; err != nil {
		t.Fatalf("写入测试项目失败: %v", err)
	}
	return NewService(db).WithBlocks(contentblocks.NewService(db, filepath.Join(t.TempDir(), "assets"))), projectID
}

func seedRequirementForCreate(
	t *testing.T,
	service *Service,
	projectID string,
	requirementID string,
	name string,
	primaryKind string,
	status string,
	taskStatus string,
	description string,
) {
	t.Helper()
	if err := service.db.Exec(`
INSERT INTO work_objects (id, project_id, object_kind, name, created_at, updated_at)
VALUES ('wo-1', ?, 'srs', '需求规格说明', datetime('now'), datetime('now'))`, projectID).Error; err != nil {
		t.Fatalf("写入工作对象失败: %v", err)
	}
	if err := service.db.Exec(`
INSERT INTO work_object_versions (id, project_id, work_object_id, version, platform, status, source, received_at, receive_mode, created_at, updated_at)
VALUES ('wov-1', ?, 'wo-1', 'V1.0', 'common', 'confirmed', '研制方', '2026-10-19', 'email', datetime('now'), datetime('now'))`,
		projectID).Error; err != nil {
		t.Fatalf("写入工作对象版本失败: %v", err)
	}
	if err := service.db.Exec(`
INSERT INTO software_requirements
    (id, project_id, source_version_id, chapter_number, external_identifier, name, description,
     primary_kind, secondary_kinds, tags, origin, source_anchor, status, test_item_task_status,
     created_at, updated_at)
VALUES (?, ?, 'wov-1', '4.1', '', ?, ?, ?, '[]', '[]', 'manual', '', ?, ?, datetime('now'), datetime('now'))`,
		requirementID, projectID, name, description, primaryKind, status, taskStatus).Error; err != nil {
		t.Fatalf("写入需求失败: %v", err)
	}
}

func seedBatchRequirement(
	t *testing.T,
	service *Service,
	projectID string,
	requirementID string,
	chapterNumber string,
	name string,
	primaryKind string,
	status string,
	taskStatus string,
	description string,
) {
	t.Helper()
	if err := service.db.Exec(`
INSERT INTO software_requirements
    (id, project_id, source_version_id, chapter_number, external_identifier, name, description,
     primary_kind, secondary_kinds, tags, origin, source_anchor, status, test_item_task_status,
     created_at, updated_at)
VALUES (?, ?, 'wov-1', ?, '', ?, ?, ?, '[]', '[]', 'manual', '', ?, ?, datetime('now'), datetime('now'))`,
		requirementID, projectID, chapterNumber, name, description, primaryKind, status, taskStatus).Error; err != nil {
		t.Fatalf("写入批量测试需求失败: %v", err)
	}
}

func TestCreateTestItemsFromRequirementsAllSkipsExistingAndIncomplete(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	seedRequirementForCreate(t, service, projectID, "req-batch-new", "批量新建", "functional", "official", "pending", "需要创建测试项")
	seedBatchRequirement(t, service, projectID, "req-batch-linked", "4.2", "已有关联", "functional", "official", "pending", "已有测试项")
	seedBatchRequirement(t, service, projectID, "req-batch-incomplete", "4.3", "待补描述", "functional", "official", "completed", "")

	if _, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, RequirementID: "req-batch-linked",
	}); err != nil {
		t.Fatalf("准备已关联需求失败: %v", err)
	}

	result, err := service.CreateTestItemsFromRequirements(ctx, projectID, nil, true)
	if err != nil {
		t.Fatalf("批量创建全部测试项失败: %v", err)
	}
	if result.Total != 3 || result.Created != 1 || result.Skipped != 2 || result.Failed != 0 {
		t.Fatalf("批量汇总不正确: %+v", result)
	}
	outcomes := make(map[string]string, len(result.Items))
	for _, item := range result.Items {
		outcomes[item.RequirementID] = item.Outcome
	}
	if outcomes["req-batch-new"] != BatchOutcomeCreated ||
		outcomes["req-batch-linked"] != BatchOutcomeSkippedExisting ||
		outcomes["req-batch-incomplete"] != BatchOutcomeSkippedIncomplete {
		t.Fatalf("批量结果分类不正确: %+v", outcomes)
	}
	createdItems, err := service.ListTestItemsByRequirement(ctx, "req-batch-new")
	if err != nil || len(createdItems) != 1 {
		t.Fatalf("新需求应创建并关联 1 个测试项: %+v, err=%v", createdItems, err)
	}
	var itemCount int64
	if err := service.db.Model(&TestItem{}).Where("project_id = ?", projectID).Count(&itemCount).Error; err != nil {
		t.Fatalf("统计测试项失败: %v", err)
	}
	if itemCount != 2 {
		t.Fatalf("应仅新增 1 个测试项，实际总数 %d", itemCount)
	}
}

func TestCreateTestItemsFromRequirementsSelectedIDs(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	seedRequirementForCreate(t, service, projectID, "req-selected-1", "选中一", "functional", "official", "pending", "描述一")
	seedBatchRequirement(t, service, projectID, "req-selected-2", "4.2", "未选中", "interface", "official", "pending", "描述二")
	seedBatchRequirement(t, service, projectID, "req-selected-3", "4.3", "选中三", "performance", "official", "pending", "描述三")

	result, err := service.CreateTestItemsFromRequirements(
		ctx,
		projectID,
		[]string{"req-selected-1", "req-selected-3", "req-selected-1"},
		false,
	)
	if err != nil {
		t.Fatalf("按选中需求批量创建失败: %v", err)
	}
	if result.Total != 2 || result.Created != 2 || result.Skipped != 0 || result.Failed != 0 {
		t.Fatalf("选中需求批量汇总不正确: %+v", result)
	}
	if len(result.Items) != 2 {
		t.Fatalf("重复需求 id 应去重，实际 %+v", result.Items)
	}
	notSelected, err := service.ListTestItemsByRequirement(ctx, "req-selected-2")
	if err != nil {
		t.Fatalf("查询未选中需求关联失败: %v", err)
	}
	if len(notSelected) != 0 {
		t.Fatalf("未选中需求不应创建测试项: %+v", notSelected)
	}
}

func TestEnsureRoundIsIdempotent(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	first, err := service.EnsureRound(ctx, projectID)
	if err != nil {
		t.Fatalf("创建第 1 轮失败: %v", err)
	}
	if first.RoundNumber != 1 || first.Name != "第 1 轮" || first.RoundType != "initial" {
		t.Fatalf("第 1 轮默认值不正确: %+v", first)
	}

	second, err := service.EnsureRound(ctx, projectID)
	if err != nil {
		t.Fatalf("重复创建第 1 轮失败: %v", err)
	}
	if second.ID != first.ID {
		t.Fatalf("重复调用不应创建新轮次: %s != %s", second.ID, first.ID)
	}
}

func TestTypeDictionarySeeded(t *testing.T) {
	service, _ := newTestService(t)
	types, err := service.ListTypes(context.Background())
	if err != nil {
		t.Fatalf("读取类型字典失败: %v", err)
	}
	if len(types) != 24 {
		t.Fatalf("类型字典应为 24 类，实际 %d", len(types))
	}
	if types[0].Code != "DC" || types[0].OutputOrder != 1 {
		t.Fatalf("类型排序不正确: %+v", types[0])
	}
	for _, item := range types {
		if item.Code == "SA" {
			if item.PlatformScope != "cpu" {
				t.Fatalf("SA 应仅适用于 CPU：%+v", item)
			}
			if item.DefaultAdequacy == "" || item.DefaultPassCriteria == "" {
				t.Fatalf("SA 套话未预置：%+v", item)
			}
		}
	}
}

func TestCreateTestItemGeneratesIdentifierAndDefaults(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	created, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID,
		TypeCode:  "SU",
		Name:      "BCD星指令参数管理",
	})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	if created.Suffix != "BCDX" {
		t.Fatalf("后缀应为名称拼音首字母前 4 位，实际 %q", created.Suffix)
	}
	if created.Identifier != "XQ_SU_BCDX" {
		t.Fatalf("标识不正确: %q", created.Identifier)
	}
	if created.Adequacy == "" || created.PassCriteria == "" {
		t.Fatalf("套话应按类型预填: %+v", created)
	}
	if created.Priority != "中" {
		t.Fatalf("默认优先级应为中: %+v", created)
	}
}

func TestCreateTestItemSuffixConflictAdjusts(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	first, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "SU", Name: "参数查询",
	})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	second, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "SU", Name: "参数查询",
	})
	if err != nil {
		t.Fatalf("创建同后缀测试项失败: %v", err)
	}
	if second.Suffix == first.Suffix {
		t.Fatalf("同后缀应自动调整为唯一值: %q", second.Suffix)
	}
}

func TestCreateTestItemForRequirementDefaultsAndLinks(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	seedRequirementForCreate(t, service, projectID, "req-create-item", "参数性能", "performance", "official", "pending", "应满足参数性能要求")

	created, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID:     projectID,
		RequirementID: "req-create-item",
	})
	if err != nil {
		t.Fatalf("按需求创建测试项失败: %v", err)
	}
	if created.TypeCode != "AC" || created.Name != "参数性能" || created.Priority != "中" {
		t.Fatalf("需求默认值不正确: %+v", created)
	}
	refs, err := service.ListRequirements(ctx, created.ID)
	if err != nil {
		t.Fatalf("查询关联需求失败: %v", err)
	}
	if len(refs) != 1 || refs[0].ID != "req-create-item" {
		t.Fatalf("测试项应关联需求: %+v", refs)
	}
	var taskStatus string
	if err := service.db.Table("software_requirements").
		Select("test_item_task_status").
		Where("id = ?", "req-create-item").
		Scan(&taskStatus).Error; err != nil {
		t.Fatalf("查询需求任务状态失败: %v", err)
	}
	if taskStatus != "completed" {
		t.Fatalf("需求任务状态应变为 completed，实际 %q", taskStatus)
	}

	reused, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID:     projectID,
		RequirementID: "req-create-item",
	})
	if err != nil {
		t.Fatalf("重复按需求创建失败: %v", err)
	}
	if reused.ID != created.ID {
		t.Fatalf("同需求同类型同名称应幂等返回，首次 %s，再次 %s", created.ID, reused.ID)
	}
	another, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID:     projectID,
		RequirementID: "req-create-item",
		CreateAnother: true,
	})
	if err != nil {
		t.Fatalf("确认再建一个时创建失败: %v", err)
	}
	if another.ID == created.ID || another.Suffix == created.Suffix {
		t.Fatalf("确认再建一个应生成新测试项，首次 %+v，再次 %+v", created, another)
	}
	var linkCount int64
	if err := service.db.Model(&RequirementLink{}).
		Where("requirement_id = ?", "req-create-item").
		Count(&linkCount).Error; err != nil {
		t.Fatalf("统计关联失败: %v", err)
	}
	if linkCount != 2 {
		t.Fatalf("确认再建一个后应有两条关联，实际 %d", linkCount)
	}
}

func TestCreateTestItemForIncompleteRequirementRejected(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	// 旧 test_item_task_status 可能残留 completed；创建资格必须以正文是否为空为准。
	seedRequirementForCreate(t, service, projectID, "req-incomplete", "待补描述", "functional", "official", "completed", "")

	_, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID:     projectID,
		RequirementID: "req-incomplete",
	})
	if !errors.Is(err, ErrRequirementIncomplete) {
		t.Fatalf("待补描述需求应拒绝创建，实际 %v", err)
	}
	var count int64
	if err := service.db.Model(&TestItem{}).Where("project_id = ?", projectID).Count(&count).Error; err != nil {
		t.Fatalf("统计测试项失败: %v", err)
	}
	if count != 0 {
		t.Fatalf("失败时不应留下测试项，实际 %d", count)
	}
}

func TestCreateTestItemForCandidateRequirementRejected(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	seedRequirementForCreate(t, service, projectID, "req-candidate", "候选需求", "functional", "candidate", "none", "候选需求正文")

	_, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID:     projectID,
		RequirementID: "req-candidate",
	})
	if !errors.Is(err, ErrRequirementNotOfficial) {
		t.Fatalf("候选需求应拒绝创建，实际 %v", err)
	}
}

func TestStaticTypeRejectsRequirementLink(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	created, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "DC", Name: "文档审查",
	})
	if err != nil {
		t.Fatalf("创建静态测试项失败: %v", err)
	}
	cases, err := service.ListCases(ctx, created.ID)
	if err != nil {
		t.Fatalf("查询壳用例失败: %v", err)
	}
	if len(cases) != 1 {
		t.Fatalf("静态测试项应自动带 1 条壳用例，实际 %d", len(cases))
	}

	err = service.LinkRequirement(ctx, projectID, created.ID, "requirement-1")
	if err != ErrStaticNoRequirementLink {
		t.Fatalf("静态测试项关联需求应被拒绝，实际 %v", err)
	}
}

func TestCreateCaseFillsDefaults(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "SU", Name: "参数管理",
	})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	sub, err := service.CreateSubItem(ctx, item.ID, "参数查询")
	if err != nil {
		t.Fatalf("创建子项失败: %v", err)
	}
	desc := "子项描述：查询参数列表"
	if _, err := service.UpdateSubItem(ctx, sub.ID, UpdateSubItemInput{Description: &desc}); err != nil {
		t.Fatalf("更新子项描述失败: %v", err)
	}

	created, err := service.CreateCase(ctx, item.ID, "参数查询")
	if err != nil {
		t.Fatalf("创建用例失败: %v", err)
	}
	if created.Summary != desc {
		t.Fatalf("用例综述应取子项描述，实际 %q", created.Summary)
	}
	if created.InitText == "" || created.Prerequisites == "" {
		t.Fatalf("初始化与前提和约束应有默认话术: %+v", created)
	}

	// 无子项时回退到测试项描述。
	itemDesc := "测试项描述：参数管理能力"
	bare, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "SU", Name: "参数管理二",
	})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	if _, err := service.UpdateTestItem(ctx, bare.ID, UpdateTestItemInput{Description: &itemDesc}); err != nil {
		t.Fatalf("更新测试项描述失败: %v", err)
	}
	fresh, err := service.CreateCase(ctx, bare.ID, "参数管理")
	if err != nil {
		t.Fatalf("创建用例失败: %v", err)
	}
	if fresh.Summary != itemDesc {
		t.Fatalf("无子项时综述应回退测试项描述，实际 %q", fresh.Summary)
	}
}

func TestCaseRenumberAfterDelete(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "SU", Name: "参数管理",
	})
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
	if second.Identifier != "YL_SU_CSGL_002" {
		t.Fatalf("用例标识不正确: %q", second.Identifier)
	}

	if err := service.DeleteCase(ctx, first.ID); err != nil {
		t.Fatalf("删除用例失败: %v", err)
	}
	cases, err := service.ListCases(ctx, item.ID)
	if err != nil {
		t.Fatalf("查询用例失败: %v", err)
	}
	if len(cases) != 1 || cases[0].Seq != 1 || cases[0].Identifier != "YL_SU_CSGL_001" {
		t.Fatalf("删除后应重排序号与标识: %+v", cases)
	}
}

func TestCaseStatusFollowsSteps(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "SU", Name: "参数管理",
	})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	itemCase, err := service.CreateCase(ctx, item.ID, "参数查询")
	if err != nil {
		t.Fatalf("创建用例失败: %v", err)
	}
	step1, err := service.CreateStep(ctx, itemCase.ID, "列表显示匹配参数")
	if err != nil {
		t.Fatalf("创建步骤失败: %v", err)
	}
	step2, err := service.CreateStep(ctx, itemCase.ID, "提示无匹配数据")
	if err != nil {
		t.Fatalf("创建步骤失败: %v", err)
	}

	passValue := "pass"
	if _, err := service.UpdateStep(ctx, step1.ID, UpdateStepInput{Passed: &passValue}); err != nil {
		t.Fatalf("更新步骤失败: %v", err)
	}
	updated, err := service.GetCase(ctx, itemCase.ID)
	if err != nil {
		t.Fatalf("查询用例失败: %v", err)
	}
	if updated.Status != "pending" {
		t.Fatalf("存在未执行步骤时应为 pending，实际 %q", updated.Status)
	}

	if _, err := service.UpdateStep(ctx, step2.ID, UpdateStepInput{Passed: &passValue}); err != nil {
		t.Fatalf("更新步骤失败: %v", err)
	}
	updated, _ = service.GetCase(ctx, itemCase.ID)
	if updated.Status != "passed" {
		t.Fatalf("全部通过应为 passed，实际 %q", updated.Status)
	}

	failValue := "fail"
	if _, err := service.UpdateStep(ctx, step2.ID, UpdateStepInput{Passed: &failValue}); err != nil {
		t.Fatalf("更新步骤失败: %v", err)
	}
	updated, _ = service.GetCase(ctx, itemCase.ID)
	if updated.Status != "failed" {
		t.Fatalf("存在未通过应为 failed，实际 %q", updated.Status)
	}
}

func TestSubItemNumberingAndMove(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "SU", Name: "参数管理",
	})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	first, _ := service.CreateSubItem(ctx, item.ID, "参数查询正常功能")
	second, _ := service.CreateSubItem(ctx, item.ID, "参数新增正常功能")
	if first.Seq != 1 || second.Seq != 2 {
		t.Fatalf("子项序号不正确: %d %d", first.Seq, second.Seq)
	}

	if err := service.MoveSubItem(ctx, second.ID, 0); err != nil {
		t.Fatalf("移动子项失败: %v", err)
	}
	items, err := service.ListSubItems(ctx, item.ID)
	if err != nil {
		t.Fatalf("查询子项失败: %v", err)
	}
	if items[0].ID != second.ID || items[0].Seq != 1 || items[1].Seq != 2 {
		t.Fatalf("移动后应重排序号: %+v", items)
	}

	if err := service.DeleteSubItem(ctx, second.ID); err != nil {
		t.Fatalf("删除子项失败: %v", err)
	}
	items, _ = service.ListSubItems(ctx, item.ID)
	if len(items) != 1 || items[0].Seq != 1 {
		t.Fatalf("删除后应重排: %+v", items)
	}
}

func TestSuffixChangeRenumbersCaseIdentifiers(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "SU", Name: "参数管理",
	})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	if _, err := service.CreateCase(ctx, item.ID, "参数查询"); err != nil {
		t.Fatalf("创建用例失败: %v", err)
	}

	newSuffix := "CSGL"
	updated, err := service.UpdateTestItem(ctx, item.ID, UpdateTestItemInput{Suffix: &newSuffix})
	if err != nil {
		t.Fatalf("更新后缀失败: %v", err)
	}
	if updated.Identifier != "XQ_SU_CSGL" {
		t.Fatalf("标识应随后缀更新: %q", updated.Identifier)
	}
	cases, _ := service.ListCases(ctx, item.ID)
	if len(cases) != 1 || cases[0].Identifier != "YL_SU_CSGL_001" {
		t.Fatalf("用例标识应同步重排: %+v", cases)
	}
}

func TestCountItemChildren(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "SU", Name: "参数管理",
	})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	if _, err := service.CreateSubItem(ctx, item.ID, "参数查询正常功能"); err != nil {
		t.Fatalf("创建子项失败: %v", err)
	}
	if _, err := service.CreateSubItem(ctx, item.ID, "参数新增正常功能"); err != nil {
		t.Fatalf("创建子项失败: %v", err)
	}

	counts, err := service.CountItemChildren(ctx, projectID)
	if err != nil {
		t.Fatalf("统计子级计数失败: %v", err)
	}
	if counts[item.ID].SubItemCount != 2 || counts[item.ID].RequirementCount != 0 {
		t.Fatalf("计数不正确: %+v", counts[item.ID])
	}
	if counts[item.ID].IncompleteSubItemCount != 2 {
		t.Fatalf("空操作步骤/通过准则的子项应计入不完善: %+v", counts[item.ID])
	}
}

func TestStaticTypeUniquenessAndImplicitFlag(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	if _, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "DC", Name: "文档审查",
	}); err != nil {
		t.Fatalf("创建第一个 DC 失败: %v", err)
	}
	if _, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "DC", Name: "文档审查二",
	}); !errors.Is(err, ErrStaticTypeExists) {
		t.Fatalf("同类型静态测试项应被拒绝，实际 %v", err)
	}

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "SU", Name: "隐含需求项", ImplicitRequirement: true,
	})
	if err != nil {
		t.Fatalf("创建隐含需求测试项失败: %v", err)
	}
	if !item.ImplicitRequirement {
		t.Fatalf("隐含需求标记未落库: %+v", item)
	}

	implicit := false
	updated, err := service.UpdateTestItem(ctx, item.ID, UpdateTestItemInput{ImplicitRequirement: &implicit})
	if err != nil {
		t.Fatalf("更新隐含需求标记失败: %v", err)
	}
	if updated.ImplicitRequirement {
		t.Fatalf("隐含需求标记应可取消: %+v", updated)
	}
}

func TestImplicitRequirementMutualExclusion(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "SU", Name: "互斥校验项",
	})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}

	// 先建一条需求与关联
	requirementID := "req-implicit-1"
	if err := service.db.Exec(`
INSERT INTO work_objects (id, project_id, object_kind, name, created_at, updated_at)
VALUES ('wo-1', ?, 'srs', '需求规格说明', datetime('now'), datetime('now'))`, projectID).Error; err != nil {
		t.Fatalf("写入工作对象失败: %v", err)
	}
	if err := service.db.Exec(`
INSERT INTO work_object_versions (id, project_id, work_object_id, version, platform, status, source, received_at, receive_mode, created_at, updated_at)
VALUES ('wov-1', ?, 'wo-1', 'V1.0', 'common', 'confirmed', '研制方', '2026-10-10', 'email', datetime('now'), datetime('now'))`,
		projectID).Error; err != nil {
		t.Fatalf("写入工作对象版本失败: %v", err)
	}
	if err := service.db.Exec(`
INSERT INTO software_requirements (id, project_id, source_version_id, chapter_number, external_identifier, name, description, primary_kind, tags, origin, source_anchor, status, created_at, updated_at)
VALUES (?, ?, 'wov-1', '4.1', '', '参数管理', '应有参数管理功能', 'functional', '[]', 'manual', '', 'official', datetime('now'), datetime('now'))`,
		requirementID, projectID).Error; err != nil {
		t.Fatalf("写入需求失败: %v", err)
	}
	if err := service.LinkRequirement(ctx, projectID, item.ID, requirementID); err != nil {
		t.Fatalf("关联需求失败: %v", err)
	}

	implicit := true
	if _, err := service.UpdateTestItem(ctx, item.ID, UpdateTestItemInput{ImplicitRequirement: &implicit}); !errors.Is(err, ErrImplicitWithRequirement) {
		t.Fatalf("已关联需求时应拒绝隐含需求，实际 %v", err)
	}

	if err := service.UnlinkRequirement(ctx, item.ID, requirementID); err != nil {
		t.Fatalf("解除关联失败: %v", err)
	}
	if _, err := service.UpdateTestItem(ctx, item.ID, UpdateTestItemInput{ImplicitRequirement: &implicit}); err != nil {
		t.Fatalf("解除关联后应允许隐含需求: %v", err)
	}
	if err := service.LinkRequirement(ctx, projectID, item.ID, requirementID); !errors.Is(err, ErrImplicitWithRequirement) {
		t.Fatalf("隐含需求开启时应拒绝再关联，实际 %v", err)
	}
}

func TestStaticItemDefaultTestMethod(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	dc, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "DC", Name: "文档审查",
	})
	if err != nil {
		t.Fatalf("创建 DC 测试项失败: %v", err)
	}
	subs, err := service.ListSubItems(ctx, dc.ID)
	if err != nil {
		t.Fatalf("查询子项失败: %v", err)
	}
	if len(subs) != 1 || subs[0].Name != "文档审查" {
		t.Fatalf("静态项应带 1 条默认子项（名称取类型默认）: %+v", subs)
	}
	if !strings.Contains(subs[0].Ops, "文档齐套性审查单") {
		t.Fatalf("默认子项操作步骤应写入类型默认测试方法: %q", subs[0].Ops)
	}
	if !strings.Contains(subs[0].Expected, "文文一致、文实相符") {
		t.Fatalf("默认子项通过准则不对: %q", subs[0].Expected)
	}
	if dc.Description != "依据测评大纲附录A中规定的文档审查要求，对被测软件交付的文档进行审查，验证文档的齐套性、规范性、准确性和一致性。" {
		t.Fatalf("测试项描述应取类型默认描述: %q", dc.Description)
	}

	// 懒补齐：删掉默认子项后再进工作台应补回，且幂等
	if err := service.DeleteSubItem(ctx, subs[0].ID); err != nil {
		t.Fatalf("删除子项失败: %v", err)
	}
	if err := service.EnsureStaticItemDefaults(ctx, projectID); err != nil {
		t.Fatalf("懒补齐失败: %v", err)
	}
	if err := service.EnsureStaticItemDefaults(ctx, projectID); err != nil {
		t.Fatalf("懒补齐二次调用失败: %v", err)
	}
	subs, _ = service.ListSubItems(ctx, dc.ID)
	if len(subs) != 1 {
		t.Fatalf("懒补齐应恰好补 1 条，实际 %d", len(subs))
	}

	// 用户改过内容的静态项不再补
	customName := "自定义方法"
	if _, err := service.UpdateSubItem(ctx, subs[0].ID, UpdateSubItemInput{Name: &customName}); err != nil {
		t.Fatalf("更新子项失败: %v", err)
	}
	if err := service.EnsureStaticItemDefaults(ctx, projectID); err != nil {
		t.Fatalf("懒补齐第三次调用失败: %v", err)
	}
	subs, _ = service.ListSubItems(ctx, dc.ID)
	if len(subs) != 1 || subs[0].Name != "自定义方法" {
		t.Fatalf("已有子项的静态项不应被覆盖: %+v", subs)
	}
}

func TestChangeTestItemType(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "SU", Name: "参数管理",
	})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	if _, err := service.CreateCase(ctx, item.ID, "参数查询"); err != nil {
		t.Fatalf("创建用例失败: %v", err)
	}

	// 文件夹按类型归属：跨类型后自动移出，避免在树上消失
	folder, err := service.CreateFolder(ctx, CreateFolderInput{ProjectID: projectID, TypeCode: "SU", Name: "功能组"})
	if err != nil {
		t.Fatalf("创建文件夹失败: %v", err)
	}
	if _, err := service.UpdateTestItem(ctx, item.ID, UpdateTestItemInput{FolderID: &folder.ID}); err != nil {
		t.Fatalf("移入文件夹失败: %v", err)
	}

	// 动态 -> 动态：标识与用例编号一起换类型
	ioType := "IO"
	updated, err := service.UpdateTestItem(ctx, item.ID, UpdateTestItemInput{TypeCode: &ioType})
	if err != nil {
		t.Fatalf("改类型失败: %v", err)
	}
	if updated.Identifier != "XQ_IO_CSGL" || updated.TypeCode != "IO" {
		t.Fatalf("标识未随类型更新: %+v", updated)
	}
	if updated.FolderID != nil {
		t.Fatalf("跨类型后应自动移出旧类型文件夹: %+v", *updated.FolderID)
	}
	cases, _ := service.ListCases(ctx, item.ID)
	if len(cases) != 1 || cases[0].Identifier != "YL_IO_CSGL_001" {
		t.Fatalf("用例编号未随类型重排: %+v", cases)
	}

	// 动态 -> 静态：套话未被改过时跟随新类型，隐含需求清零
	dcType := "DC"
	converted, err := service.UpdateTestItem(ctx, item.ID, UpdateTestItemInput{TypeCode: &dcType})
	if err != nil {
		t.Fatalf("改为静态类型失败: %v", err)
	}
	if converted.Identifier != "XQ_DC_CSGL" {
		t.Fatalf("静态标识不正确: %s", converted.Identifier)
	}
	if converted.Adequacy != "对所有被测软件文档按照文档检查单逐项进行审查。" {
		t.Fatalf("套话未跟随新类型: %q", converted.Adequacy)
	}
	if converted.ImplicitRequirement {
		t.Fatalf("静态测试项不应保留隐含需求标记")
	}

	// 静态四类（DC/SA/CR/CW）类型锁定：静态项不允许再改类型
	suType := "SU"
	if _, err := service.UpdateTestItem(ctx, item.ID, UpdateTestItemInput{TypeCode: &suType}); !errors.Is(err, ErrStaticTypeLocked) {
		t.Fatalf("静态测试项改类型应被拒绝，实际 %v", err)
	}

	// 同类静态第二个应被拒绝
	other, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, TypeCode: "SU", Name: "另一个功能项",
	})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	if _, err := service.UpdateTestItem(ctx, other.ID, UpdateTestItemInput{TypeCode: &dcType}); !errors.Is(err, ErrStaticTypeExists) {
		t.Fatalf("同类型静态第二个应被拒绝，实际 %v", err)
	}
}

func TestMoveItemAcrossFolderAndRoot(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	first, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "第一项"})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	second, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "第二项"})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	folder, err := service.CreateFolder(ctx, CreateFolderInput{ProjectID: projectID, TypeCode: "SU", Name: "功能组"})
	if err != nil {
		t.Fatalf("创建文件夹失败: %v", err)
	}
	otherFolder, err := service.CreateFolder(ctx, CreateFolderInput{ProjectID: projectID, TypeCode: "IO", Name: "接口组"})
	if err != nil {
		t.Fatalf("创建文件夹失败: %v", err)
	}

	// 根目录重排：第二项插到第一位
	if err := service.MoveItem(ctx, second.ID, nil, 0); err != nil {
		t.Fatalf("根目录重排失败: %v", err)
	}
	rootItems, err := service.ListTestItems(ctx, projectID)
	if err != nil {
		t.Fatalf("读取测试项失败: %v", err)
	}
	if len(rootItems) != 2 || rootItems[0].ID != second.ID || rootItems[1].ID != first.ID {
		t.Fatalf("根目录顺序不正确: %+v", rootItems)
	}

	// 跨类型文件夹被拒绝
	if err := service.MoveItem(ctx, second.ID, &otherFolder.ID, 0); !errors.Is(err, ErrFolderMismatch) {
		t.Fatalf("跨类型文件夹应被拒绝，实际 %v", err)
	}

	// 移入同类型文件夹后继续在文件夹内排序
	if err := service.MoveItem(ctx, second.ID, &folder.ID, 0); err != nil {
		t.Fatalf("移入文件夹失败: %v", err)
	}
	if err := service.MoveItem(ctx, first.ID, &folder.ID, 0); err != nil {
		t.Fatalf("文件夹内重排失败: %v", err)
	}
	folderItems, err := service.ListTestItems(ctx, projectID)
	if err != nil {
		t.Fatalf("读取测试项失败: %v", err)
	}
	if folderItems[0].ID != first.ID || folderItems[1].ID != second.ID {
		t.Fatalf("文件夹内顺序不正确: %+v", folderItems)
	}
	if folderItems[0].FolderID == nil || *folderItems[0].FolderID != folder.ID {
		t.Fatalf("测试项应归属目标文件夹: %+v", folderItems[0])
	}
}

func TestDuplicateItemCopiesFieldsAndRejectsStatic(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "参数管理"})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	sub, err := service.CreateSubItem(ctx, item.ID, "子项一")
	if err != nil {
		t.Fatalf("创建子项失败: %v", err)
	}
	if _, err := service.UpdateSubItem(ctx, sub.ID, UpdateSubItemInput{Ops: ptr("步骤"), Expected: ptr("准则")}); err != nil {
		t.Fatalf("更新子项失败: %v", err)
	}

	copied, err := service.DuplicateItem(ctx, item.ID)
	if err != nil {
		t.Fatalf("复制新增失败: %v", err)
	}
	if copied.Name != "参数管理-副本" || copied.Identifier == item.Identifier {
		t.Fatalf("副本名称或标识不正确: %+v", copied)
	}
	sourceItems, err := service.ListTestItems(ctx, projectID)
	if err != nil {
		t.Fatalf("读取测试项失败: %v", err)
	}
	if len(sourceItems) != 2 || sourceItems[0].ID != item.ID || sourceItems[1].ID != copied.ID {
		t.Fatalf("副本应紧跟在原件之后: %+v", sourceItems)
	}
	copies, err := service.ListSubItems(ctx, copied.ID)
	if err != nil {
		t.Fatalf("读取子项失败: %v", err)
	}
	if len(copies) != 1 || copies[0].Name != "子项一" || copies[0].Ops != "步骤" {
		t.Fatalf("子项未复制: %+v", copies)
	}

	staticItem, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "DC", Name: "文档审查"})
	if err != nil {
		t.Fatalf("创建静态测试项失败: %v", err)
	}
	if _, err := service.DuplicateItem(ctx, staticItem.ID); !errors.Is(err, ErrStaticTypeDuplicate) {
		t.Fatalf("静态测试项复制应被拒绝，实际 %v", err)
	}
}

func ptr[T any](value T) *T {
	return &value
}

func TestDuplicateStepInsertsAfterSource(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "参数管理"})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	itemCase, err := service.CreateCase(ctx, item.ID, "参数查询")
	if err != nil {
		t.Fatalf("创建用例失败: %v", err)
	}
	first, err := service.CreateStep(ctx, itemCase.ID, "预期一")
	if err != nil {
		t.Fatalf("创建步骤失败: %v", err)
	}
	if _, err := service.CreateStep(ctx, itemCase.ID, "预期二"); err != nil {
		t.Fatalf("创建步骤失败: %v", err)
	}

	// seq 上有 UNIQUE(test_case_id, seq)：复制中间行时必须先占位再重排，否则插入即冲突
	if _, err := service.DuplicateStep(ctx, first.ID); err != nil {
		t.Fatalf("复制步骤失败: %v", err)
	}
	steps, err := service.ListSteps(ctx, itemCase.ID)
	if err != nil {
		t.Fatalf("读取步骤失败: %v", err)
	}
	if len(steps) != 3 {
		t.Fatalf("复制后应有 3 步，实际 %d", len(steps))
	}
	if steps[0].ExpectText != "预期一" || steps[1].ExpectText != "预期一" || steps[2].ExpectText != "预期二" {
		t.Fatalf("副本应紧跟源步骤且内容一致: %+v", steps)
	}
	for index, step := range steps {
		if step.Seq != index+1 {
			t.Fatalf("序号未重排: %+v", steps)
		}
	}
	if steps[1].Passed != "none" {
		t.Fatalf("副本通过状态应重置为未执行: %+v", steps[1])
	}
}

// ---- 切片 5b：步骤富文本块与用例「终止条件 / 通过准则」----

func paraDoc(text string) contentblocks.Node {
	return contentblocks.Node{Type: "doc", Content: []contentblocks.Node{
		{Type: "paragraph", Content: []contentblocks.Node{{Type: "text", Text: text}}},
	}}
}

func tableDoc() contentblocks.Node {
	return contentblocks.Node{Type: "doc", Content: []contentblocks.Node{
		{Type: "table", Content: []contentblocks.Node{
			{Type: "tableRow", Content: []contentblocks.Node{
				{Type: "tableHeader", Content: []contentblocks.Node{
					{Type: "paragraph", Content: []contentblocks.Node{{Type: "text", Text: "列"}}},
				}},
			}},
		}},
	}}
}

func TestStepBlocksSaveAndList(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "参数管理"})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	itemCase, err := service.CreateCase(ctx, item.ID, "参数查询")
	if err != nil {
		t.Fatalf("创建用例失败: %v", err)
	}
	step, err := service.CreateStep(ctx, itemCase.ID, "预期一")
	if err != nil {
		t.Fatalf("创建步骤失败: %v", err)
	}

	view, err := service.SaveStepBlock(ctx, step.ID, contentblocks.StepKindOp, paraDoc("开机并进入主界面"), "user-1")
	if err != nil {
		t.Fatalf("保存输入及操作失败: %v", err)
	}
	if !view.Op.HasContent || view.Op.PlainText != "开机并进入主界面" {
		t.Fatalf("输入及操作视图不正确: %+v", view.Op)
	}
	if view.Act.HasContent {
		t.Fatalf("未保存的实测结果应为空: %+v", view.Act)
	}

	view, err = service.SaveStepBlock(ctx, step.ID, contentblocks.StepKindAct, tableDoc(), "user-1")
	if err != nil {
		t.Fatalf("保存实测结果失败: %v", err)
	}
	if !view.Act.HasContent {
		t.Fatalf("实测结果应保留表格内容: %+v", view.Act)
	}
	if !view.Op.HasContent {
		t.Fatalf("保存 act 不应清空 op: %+v", view.Op)
	}

	view, err = service.SaveStepBlock(ctx, step.ID, contentblocks.StepKindOp, tableDoc(), "user-1")
	if err != nil {
		t.Fatalf("输入及操作应允许表格: %v", err)
	}
	if !view.Op.HasContent || view.Op.PlainText != "列" {
		t.Fatalf("输入及操作的表格内容未保存: %+v", view.Op)
	}

	views, err := service.ListStepsWithBlocks(ctx, itemCase.ID)
	if err != nil {
		t.Fatalf("读取步骤失败: %v", err)
	}
	if len(views) != 1 || !views[0].Op.HasContent || !views[0].Act.HasContent {
		t.Fatalf("列表应带两块富文本: %+v", views)
	}
}

func TestDuplicateStepCopiesOpOnly(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "参数管理"})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	itemCase, err := service.CreateCase(ctx, item.ID, "参数查询")
	if err != nil {
		t.Fatalf("创建用例失败: %v", err)
	}
	step, err := service.CreateStep(ctx, itemCase.ID, "预期一")
	if err != nil {
		t.Fatalf("创建步骤失败: %v", err)
	}
	if _, err := service.SaveStepBlock(ctx, step.ID, contentblocks.StepKindOp, paraDoc("第一步操作"), ""); err != nil {
		t.Fatalf("保存 op 失败: %v", err)
	}
	if _, err := service.SaveStepBlock(ctx, step.ID, contentblocks.StepKindAct, paraDoc("第一步结果"), ""); err != nil {
		t.Fatalf("保存 act 失败: %v", err)
	}

	if _, err := service.DuplicateStep(ctx, step.ID); err != nil {
		t.Fatalf("复制步骤失败: %v", err)
	}
	views, err := service.ListStepsWithBlocks(ctx, itemCase.ID)
	if err != nil {
		t.Fatalf("读取步骤失败: %v", err)
	}
	if len(views) != 2 {
		t.Fatalf("复制后应有 2 步，实际 %d", len(views))
	}
	copied := views[1]
	if !copied.Op.HasContent || copied.Op.PlainText != "第一步操作" {
		t.Fatalf("副本应带 op 设计内容: %+v", copied.Op)
	}
	if copied.Act.HasContent {
		t.Fatalf("副本不应带实测结果: %+v", copied.Act)
	}
	if copied.Passed != "none" {
		t.Fatalf("副本通过状态应重置: %+v", copied)
	}
}

func TestDeleteStepRemovesBlocks(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "参数管理"})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	itemCase, err := service.CreateCase(ctx, item.ID, "参数查询")
	if err != nil {
		t.Fatalf("创建用例失败: %v", err)
	}
	first, err := service.CreateStep(ctx, itemCase.ID, "预期一")
	if err != nil {
		t.Fatalf("创建步骤失败: %v", err)
	}
	if _, err := service.CreateStep(ctx, itemCase.ID, "预期二"); err != nil {
		t.Fatalf("创建步骤失败: %v", err)
	}
	if _, err := service.SaveStepBlock(ctx, first.ID, contentblocks.StepKindOp, paraDoc("将被清理"), ""); err != nil {
		t.Fatalf("保存 op 失败: %v", err)
	}

	if err := service.DeleteStep(ctx, first.ID); err != nil {
		t.Fatalf("删除步骤失败: %v", err)
	}
	var count int64
	if err := service.db.Model(&contentblocks.ContentBlock{}).
		Where("owner_type = ? AND block_key LIKE ?", contentblocks.OwnerTypeTestCase, contentblocks.StepBlockPrefix(first.ID)+"%").
		Count(&count).Error; err != nil {
		t.Fatalf("统计残留块失败: %v", err)
	}
	if count != 0 {
		t.Fatalf("删除步骤后应清理内容块，残留 %d", count)
	}
}

func TestCaseTextFieldsUpdateAndDuplicate(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "参数管理"})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	itemCase, err := service.CreateCase(ctx, item.ID, "参数查询")
	if err != nil {
		t.Fatalf("创建用例失败: %v", err)
	}

	updated, err := service.UpdateCase(ctx, itemCase.ID, UpdateCaseInput{
		TerminationText: ptr("达到终止条件"),
		PassCriteria:    ptr("全部步骤通过"),
	})
	if err != nil {
		t.Fatalf("更新用例文本两栏失败: %v", err)
	}
	if updated.TerminationText != "达到终止条件" || updated.PassCriteria != "全部步骤通过" {
		t.Fatalf("终止条件/通过准则未写入: %+v", updated)
	}

	dup, err := service.DuplicateCase(ctx, itemCase.ID)
	if err != nil {
		t.Fatalf("复制用例失败: %v", err)
	}
	if dup.TerminationText != "达到终止条件" || dup.PassCriteria != "全部步骤通过" {
		t.Fatalf("复制用例应带上文本两栏: %+v", dup)
	}
}

func TestDuplicateCaseCopiesStepOp(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "参数管理"})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	itemCase, err := service.CreateCase(ctx, item.ID, "参数查询")
	if err != nil {
		t.Fatalf("创建用例失败: %v", err)
	}
	step, err := service.CreateStep(ctx, itemCase.ID, "预期一")
	if err != nil {
		t.Fatalf("创建步骤失败: %v", err)
	}
	if _, err := service.SaveStepBlock(ctx, step.ID, contentblocks.StepKindOp, paraDoc("设计操作"), ""); err != nil {
		t.Fatalf("保存 op 失败: %v", err)
	}
	if _, err := service.SaveStepBlock(ctx, step.ID, contentblocks.StepKindAct, paraDoc("执行结果"), ""); err != nil {
		t.Fatalf("保存 act 失败: %v", err)
	}

	dup, err := service.DuplicateCase(ctx, itemCase.ID)
	if err != nil {
		t.Fatalf("复制用例失败: %v", err)
	}
	views, err := service.ListStepsWithBlocks(ctx, dup.ID)
	if err != nil {
		t.Fatalf("读取副本步骤失败: %v", err)
	}
	if len(views) != 1 {
		t.Fatalf("副本应有 1 步，实际 %d", len(views))
	}
	if !views[0].Op.HasContent || views[0].Op.PlainText != "设计操作" {
		t.Fatalf("副本步骤应带 op 设计内容: %+v", views[0].Op)
	}
	if views[0].Act.HasContent {
		t.Fatalf("副本步骤不应带实测结果: %+v", views[0].Act)
	}
}

func TestInsertStepBeforeKeepsOrder(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "参数管理"})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	itemCase, err := service.CreateCase(ctx, item.ID, "参数查询")
	if err != nil {
		t.Fatalf("创建用例失败: %v", err)
	}
	first, err := service.CreateStep(ctx, itemCase.ID, "预期一")
	if err != nil {
		t.Fatalf("创建步骤失败: %v", err)
	}
	if _, err := service.CreateStep(ctx, itemCase.ID, "预期二"); err != nil {
		t.Fatalf("创建步骤失败: %v", err)
	}

	inserted, err := service.InsertStepBefore(ctx, first.ID)
	if err != nil {
		t.Fatalf("上方插入步骤失败: %v", err)
	}
	if inserted.ExpectText != "" || inserted.Passed != "none" {
		t.Fatalf("插入的应是空步骤: %+v", inserted)
	}
	steps, err := service.ListSteps(ctx, itemCase.ID)
	if err != nil {
		t.Fatalf("读取步骤失败: %v", err)
	}
	if len(steps) != 3 || steps[0].ID != inserted.ID || steps[1].ExpectText != "预期一" {
		t.Fatalf("插入位置不正确: %+v", steps)
	}
	for index, step := range steps {
		if step.Seq != index+1 {
			t.Fatalf("序号未重排: %+v", steps)
		}
	}
}

func TestImportStepCopiesDesignContent(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "参数管理"})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	sourceCase, err := service.CreateCase(ctx, item.ID, "参数查询")
	if err != nil {
		t.Fatalf("创建用例失败: %v", err)
	}
	sourceStep, err := service.CreateStep(ctx, sourceCase.ID, "列表显示匹配参数")
	if err != nil {
		t.Fatalf("创建步骤失败: %v", err)
	}
	if _, err := service.SaveStepBlock(ctx, sourceStep.ID, contentblocks.StepKindOp, paraDoc("打开界面并查询"), ""); err != nil {
		t.Fatalf("保存 op 失败: %v", err)
	}
	if _, err := service.SaveStepBlock(ctx, sourceStep.ID, contentblocks.StepKindAct, paraDoc("执行结果"), ""); err != nil {
		t.Fatalf("保存 act 失败: %v", err)
	}
	targetCase, err := service.CreateCase(ctx, item.ID, "参数新增")
	if err != nil {
		t.Fatalf("创建目标用例失败: %v", err)
	}

	imported, err := service.ImportStep(ctx, targetCase.ID, sourceStep.ID)
	if err != nil {
		t.Fatalf("跨用例复制步骤失败: %v", err)
	}
	if imported.ExpectText != "列表显示匹配参数" || imported.Passed != "none" {
		t.Fatalf("导入步骤字段不正确: %+v", imported)
	}
	views, err := service.ListStepsWithBlocks(ctx, targetCase.ID)
	if err != nil {
		t.Fatalf("读取目标步骤失败: %v", err)
	}
	if len(views) != 1 {
		t.Fatalf("目标用例应有 1 步，实际 %d", len(views))
	}
	if !views[0].Op.HasContent || views[0].Op.PlainText != "打开界面并查询" {
		t.Fatalf("导入应带 op 设计内容: %+v", views[0].Op)
	}
	if views[0].Act.HasContent {
		t.Fatalf("导入不应带实测结果: %+v", views[0].Act)
	}
}

func TestImportStepRejectsCrossProject(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "参数管理"})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	sourceCase, err := service.CreateCase(ctx, item.ID, "参数查询")
	if err != nil {
		t.Fatalf("创建用例失败: %v", err)
	}
	sourceStep, err := service.CreateStep(ctx, sourceCase.ID, "预期一")
	if err != nil {
		t.Fatalf("创建步骤失败: %v", err)
	}

	if err := service.db.Exec(`
INSERT INTO projects (id, code, name, nature, platform, software_type, classification, security_level, organization, owner_id, status, created_at, updated_at)
VALUES ('other-project-002', 'R88888', '另一个项目', '鉴定测评', 'CPU/非嵌', '新研', '内部', 'C', '测试单位', 'user-1', '编制大纲中', datetime('now'), datetime('now'))`).Error; err != nil {
		t.Fatalf("创建第二个项目失败: %v", err)
	}
	otherItem, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: "other-project-002", TypeCode: "SU", Name: "其他测试项"})
	if err != nil {
		t.Fatalf("在第二个项目创建测试项失败: %v", err)
	}
	targetCase, err := service.CreateCase(ctx, otherItem.ID, "目标用例")
	if err != nil {
		t.Fatalf("创建目标用例失败: %v", err)
	}

	if _, err := service.ImportStep(ctx, targetCase.ID, sourceStep.ID); !errors.Is(err, ErrImportAcrossProjects) {
		t.Fatalf("跨项目复制步骤应被拒绝，实际 %v", err)
	}
}

func TestDeleteCaseRemovesBlocks(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "删除用例清理"})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	itemCase, err := service.CreateCase(ctx, item.ID, "待删除用例")
	if err != nil {
		t.Fatalf("创建用例失败: %v", err)
	}
	step, err := service.CreateStep(ctx, itemCase.ID, "预期")
	if err != nil {
		t.Fatalf("创建步骤失败: %v", err)
	}
	if _, err := service.SaveStepBlock(ctx, step.ID, contentblocks.StepKindOp, paraDoc("操作"), ""); err != nil {
		t.Fatalf("保存 op 失败: %v", err)
	}
	if _, err := service.SaveStepBlock(ctx, step.ID, contentblocks.StepKindAct, paraDoc("实测"), ""); err != nil {
		t.Fatalf("保存 act 失败: %v", err)
	}

	if err := service.DeleteCase(ctx, itemCase.ID); err != nil {
		t.Fatalf("删除用例失败: %v", err)
	}
	var count int64
	if err := service.db.Model(&contentblocks.ContentBlock{}).
		Where("owner_type = ? AND owner_id = ?", contentblocks.OwnerTypeTestCase, itemCase.ID).Count(&count).Error; err != nil {
		t.Fatalf("统计用例块失败: %v", err)
	}
	if count != 0 {
		t.Fatalf("删除用例后内容块残留 %d 条", count)
	}
}

func TestDeleteTestItemRemovesBlocks(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "删除测试项清理"})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	itemCase, err := service.CreateCase(ctx, item.ID, "待删除用例")
	if err != nil {
		t.Fatalf("创建用例失败: %v", err)
	}
	step, err := service.CreateStep(ctx, itemCase.ID, "预期")
	if err != nil {
		t.Fatalf("创建步骤失败: %v", err)
	}
	if _, err := service.SaveStepBlock(ctx, step.ID, contentblocks.StepKindOp, paraDoc("操作"), ""); err != nil {
		t.Fatalf("保存 op 失败: %v", err)
	}
	if _, err := service.SaveStepBlock(ctx, step.ID, contentblocks.StepKindAct, paraDoc("实测"), ""); err != nil {
		t.Fatalf("保存 act 失败: %v", err)
	}

	sub, err := service.CreateSubItem(ctx, item.ID, "子项")
	if err != nil {
		t.Fatalf("创建子项失败: %v", err)
	}
	if _, err := service.blocks.SaveBlock(ctx, projectID, contentblocks.OwnerTypeTestItem, item.ID, contentblocks.SubItemBlockPrefix(sub.ID)+"ops", paraDoc("子项操作"), contentblocks.SaveBlockOptions{}, "user-1"); err != nil {
		t.Fatalf("保存子项块失败: %v", err)
	}

	if err := service.DeleteTestItem(ctx, item.ID); err != nil {
		t.Fatalf("删除测试项失败: %v", err)
	}
	for _, owner := range []struct{ typ, id string }{
		{contentblocks.OwnerTypeTestCase, itemCase.ID},
		{contentblocks.OwnerTypeTestItem, item.ID},
	} {
		var count int64
		if err := service.db.Model(&contentblocks.ContentBlock{}).
			Where("owner_type = ? AND owner_id = ?", owner.typ, owner.id).Count(&count).Error; err != nil {
			t.Fatalf("统计内容块失败: %v", err)
		}
		if count != 0 {
			t.Fatalf("删除测试项后 %s/%s 残留 %d 条内容块", owner.typ, owner.id, count)
		}
	}
}

func TestDeleteSubItemRemovesBlocks(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, TypeCode: "SU", Name: "删除子项清理"})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	sub, err := service.CreateSubItem(ctx, item.ID, "待删除子项")
	if err != nil {
		t.Fatalf("创建子项失败: %v", err)
	}
	prefix := contentblocks.SubItemBlockPrefix(sub.ID)
	if _, err := service.blocks.SaveBlock(ctx, projectID, contentblocks.OwnerTypeTestItem, item.ID, prefix+"ops", paraDoc("子项操作"), contentblocks.SaveBlockOptions{}, "user-1"); err != nil {
		t.Fatalf("保存子项块失败: %v", err)
	}

	if err := service.DeleteSubItem(ctx, sub.ID); err != nil {
		t.Fatalf("删除子项失败: %v", err)
	}
	var count int64
	if err := service.db.Model(&contentblocks.ContentBlock{}).
		Where("owner_type = ? AND owner_id = ? AND block_key LIKE ?", contentblocks.OwnerTypeTestItem, item.ID, prefix+"%").Count(&count).Error; err != nil {
		t.Fatalf("统计子项块失败: %v", err)
	}
	if count != 0 {
		t.Fatalf("删除子项后内容块残留 %d 条", count)
	}
}
