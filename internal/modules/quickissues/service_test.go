package quickissues

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"

	"gorm.io/gorm"

	"chenmeridian/internal/database"
	"chenmeridian/migrations"
)

func TestQuickIssueNotesPermissionsValidationAndStepLifecycle(t *testing.T) {
	service, db := newQuickIssueTestService(t)
	ctx := context.Background()
	stepID := "step-1"
	assetID := "asset-1"

	created, err := service.Create(ctx, CreateInput{
		CaseID:            "case-1",
		TestCaseStepID:    &stepID,
		NoteText:          "  参数页面闪烁  ",
		ScreenshotAssetID: &assetID,
		CreatedBy:         "user-1",
	})
	if err != nil {
		t.Fatalf("创建问题草稿失败: %v", err)
	}
	if created.NoteText != "参数页面闪烁" || created.StepSeq == nil || *created.StepSeq != 1 ||
		created.CreatedByName != "用户一" || !created.CanEdit || created.ScreenshotAssetID == nil {
		t.Fatalf("创建结果不正确: %+v", created)
	}

	memberNotes, err := service.List(ctx, "case-1", "user-2")
	if err != nil {
		t.Fatalf("项目成员读取失败: %v", err)
	}
	if len(memberNotes) != 1 || memberNotes[0].CanEdit {
		t.Fatalf("其他成员应只读可见: %+v", memberNotes)
	}
	otherCreated, err := service.Create(ctx, CreateInput{
		CaseID: "case-1", NoteText: "另一位成员记录的问题", CreatedBy: "user-2",
	})
	if err != nil {
		t.Fatalf("项目成员创建问题失败: %v", err)
	}
	ownerNotes, err := service.List(ctx, "case-1", "user-1")
	if err != nil {
		t.Fatalf("创建人读取列表失败: %v", err)
	}
	if len(ownerNotes) != 2 {
		t.Fatalf("列表编辑权限不正确: %+v", ownerNotes)
	}
	for _, note := range ownerNotes {
		if note.CreatedBy == "user-1" && !note.CanEdit {
			t.Fatalf("创建人自己的草稿应可编辑: %+v", note)
		}
		if note.CreatedBy == "user-2" && note.CanEdit {
			t.Fatalf("他人草稿应为只读: %+v", note)
		}
	}

	changedText := strings.Repeat("字", MaxNoteLengthRunes)
	updated, err := service.Update(ctx, created.ID, UpdateInput{
		NoteText: &changedText, ClearScreenshot: true, UpdatedBy: "user-1",
	})
	if err != nil {
		t.Fatalf("更新问题草稿失败: %v", err)
	}
	if updated.NoteText != changedText || updated.ScreenshotAssetID != nil || !updated.CanEdit {
		t.Fatalf("更新结果不正确: %+v", updated)
	}
	tooLong := strings.Repeat("长", MaxNoteLengthRunes+1)
	if _, err := service.Update(ctx, created.ID, UpdateInput{NoteText: &tooLong, UpdatedBy: "user-1"}); !errors.Is(err, ErrNoteTooLong) {
		t.Fatalf("501 字符应拒绝，实际 %v", err)
	}
	if _, err := service.Create(ctx, CreateInput{
		CaseID: "case-1", TestCaseStepID: ptr("step-other"), NoteText: "错误步骤", CreatedBy: "user-1",
	}); !errors.Is(err, ErrStepMismatch) {
		t.Fatalf("跨用例步骤应拒绝，实际 %v", err)
	}
	if _, err := service.Create(ctx, CreateInput{
		CaseID: "case-1", ScreenshotAssetID: ptr("asset-other"), NoteText: "错误截图", CreatedBy: "user-1",
	}); !errors.Is(err, ErrAssetMismatch) {
		t.Fatalf("跨项目截图应拒绝，实际 %v", err)
	}
	if _, err := service.Update(ctx, created.ID, UpdateInput{NoteText: ptr("越权修改"), UpdatedBy: "user-2"}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("非创建人更新应拒绝，实际 %v", err)
	}
	if err := service.Delete(ctx, created.ID, "user-2"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("非创建人删除应拒绝，实际 %v", err)
	}
	if _, err := service.List(ctx, "case-1", "user-3"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("非项目成员读取应拒绝，实际 %v", err)
	}
	if err := service.Delete(ctx, otherCreated.ID, "user-2"); err != nil {
		t.Fatalf("创建人删除自己的草稿失败: %v", err)
	}

	if err := db.Exec("DELETE FROM test_case_steps WHERE id = ?", stepID).Error; err != nil {
		t.Fatalf("删除步骤失败: %v", err)
	}
	var attached *string
	if err := db.Raw("SELECT test_case_step_id FROM quick_issue_notes WHERE id = ?", created.ID).Scan(&attached).Error; err != nil {
		t.Fatalf("读取步骤归属失败: %v", err)
	}
	if attached != nil {
		t.Fatalf("步骤删除后问题应转为用例级，实际 step=%v", *attached)
	}
}

func newQuickIssueTestService(t *testing.T) (*Service, *gorm.DB) {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "quick-issues.db"))
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
	mustExecQuickIssue(t, db, `INSERT INTO users (id, username, display_name, password_hash, created_at, updated_at) VALUES
        ('user-1','owner','用户一','hash',datetime('now'),datetime('now')),
        ('user-2','member','用户二','hash',datetime('now'),datetime('now')),
        ('user-3','outsider','用户三','hash',datetime('now'),datetime('now'))`)
	mustExecQuickIssue(t, db, `INSERT INTO projects (id, code, name, nature, platform, software_type, classification, security_level, organization, owner_id, status, created_at, updated_at) VALUES
        ('project-1','R99001','问题草稿项目','鉴定测评','CPU/非嵌','新研','内部','C','测试单位','user-1','编制大纲中',datetime('now'),datetime('now')),
        ('project-2','R99002','其他项目','鉴定测评','CPU/非嵌','新研','内部','C','测试单位','user-3','编制大纲中',datetime('now'),datetime('now'))`)
	mustExecQuickIssue(t, db, `INSERT INTO project_members (id, project_id, user_id, is_owner, created_at, updated_at) VALUES
        ('member-1','project-1','user-2',0,datetime('now'),datetime('now'))`)
	mustExecQuickIssue(t, db, `INSERT INTO test_rounds (id, project_id, round_number, name, round_type, status, created_at, updated_at) VALUES
        ('round-1','project-1',1,'第 1 轮','initial','draft',datetime('now'),datetime('now'))`)
	mustExecQuickIssue(t, db, `INSERT INTO test_items (id, project_id, round_id, type_code, identifier, suffix, name, sort_order, description, adequacy, pass_criteria, implicit_requirement, lineage_key, created_at, updated_at) VALUES
        ('item-1','project-1','round-1','SU','XQ_SU_ISSUE','ISSUE','问题测试项',0,'','','',0,'item-1',datetime('now'),datetime('now'))`)
	mustExecQuickIssue(t, db, `INSERT INTO test_cases (id, project_id, test_item_id, identifier, seq, name, sort_order, status, lineage_key, created_at, updated_at) VALUES
        ('case-1','project-1','item-1','YL_SU_ISSUE_001',1,'问题用例',0,'pending','case-1',datetime('now'),datetime('now')),
        ('case-2','project-1','item-1','YL_SU_ISSUE_002',2,'其他用例',1,'pending','case-2',datetime('now'),datetime('now'))`)
	mustExecQuickIssue(t, db, `INSERT INTO test_case_steps (id, test_case_id, seq, expect_text, passed, sort_order, lineage_key, created_at, updated_at) VALUES
        ('step-1','case-1',1,'预期一','none',0,'step-1',datetime('now'),datetime('now')),
        ('step-2','case-1',2,'预期二','none',1,'step-2',datetime('now'),datetime('now')),
        ('step-other','case-2',1,'其他预期','none',0,'step-other',datetime('now'),datetime('now'))`)
	mustExecQuickIssue(t, db, `INSERT INTO assets (id, project_id, sha256, storage_key, mime_type, file_ext, file_size, width, height, caption, created_by, created_at, updated_at) VALUES
        ('asset-1','project-1','hash-1','aa/hash-1.png','image/png','.png',10,10,10,'','user-1',datetime('now'),datetime('now')),
        ('asset-other','project-2','hash-2','bb/hash-2.png','image/png','.png',10,10,10,'','user-3',datetime('now'),datetime('now'))`)
	return NewService(db), db
}

func mustExecQuickIssue(t *testing.T, db *gorm.DB, query string) {
	t.Helper()
	if err := db.Exec(query).Error; err != nil {
		t.Fatalf("SQL: %v", err)
	}
}

func ptr(value string) *string { return &value }
