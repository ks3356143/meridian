package requirements

import (
	"context"
	"path/filepath"
	"testing"

	"gorm.io/gorm"

	"chenmeridian/internal/database"
	"chenmeridian/internal/modules/contentblocks"
	"chenmeridian/migrations"
)

func TestPurgeRequirementCleansContentBlocks(t *testing.T) {
	service, db := newRequirementCleanupFixture(t)
	ctx := context.Background()
	blocks := contentblocks.NewService(db, filepath.Join(t.TempDir(), "assets"))

	seedPurgeableRequirement(t, db, "req-1", "req-event-1")
	seedPurgeableRequirement(t, db, "req-2", "req-event-2")
	for _, requirementID := range []string{"req-1", "req-2"} {
		if _, err := blocks.SaveBlock(
			ctx,
			"project-1",
			contentblocks.OwnerTypeRequirement,
			requirementID,
			contentblocks.BlockKeyRequirementBody,
			contentblocks.Node{Type: "doc", Content: []contentblocks.Node{
				{Type: "paragraph", Content: []contentblocks.Node{{Type: "text", Text: requirementID}}},
			}},
			contentblocks.SaveBlockOptions{},
			"user-1",
		); err != nil {
			t.Fatalf("保存需求正文块失败: %v", err)
		}
	}

	result, err := service.PurgeRequirement(ctx, PurgeRequirementInput{
		ProjectCode: "R99999",
		ID:          "req-1",
		Reason:      "测试清理",
	})
	if err != nil || result.DeletedCount != 1 {
		t.Fatalf("彻底删除单条需求失败: result=%+v err=%v", result, err)
	}
	result, err = service.PurgeRequirements(ctx, PurgeRequirementsInput{
		ProjectCode: "R99999",
		IDs:         []string{"req-2"},
		Reason:      "测试清理",
	})
	if err != nil || result.DeletedCount != 1 {
		t.Fatalf("彻底删除批量需求失败: result=%+v err=%v", result, err)
	}

	var blockCount int64
	if err := db.Model(&contentblocks.ContentBlock{}).
		Where("owner_type = ? AND owner_id IN ?", contentblocks.OwnerTypeRequirement, []string{"req-1", "req-2"}).
		Count(&blockCount).Error; err != nil {
		t.Fatalf("统计需求内容块失败: %v", err)
	}
	if blockCount != 0 {
		t.Fatalf("彻底删除需求后内容块残留 %d 条", blockCount)
	}
	var requirementCount int64
	if err := db.Table("software_requirements").Where("id IN ?", []string{"req-1", "req-2"}).Count(&requirementCount).Error; err != nil {
		t.Fatalf("统计需求失败: %v", err)
	}
	if requirementCount != 0 {
		t.Fatalf("需求记录未删除，残留 %d 条", requirementCount)
	}
}

func newRequirementCleanupFixture(t *testing.T) (*Service, *gorm.DB) {
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
	statements := []string{
		`INSERT INTO users (id, username, display_name, password_hash, created_at, updated_at)
		 VALUES ('user-1', 'tester', '测试员', 'hash', datetime('now'), datetime('now'))`,
		`INSERT INTO projects (id, code, name, nature, platform, software_type, classification, security_level, organization, owner_id, status, created_at, updated_at)
		 VALUES ('project-1', 'R99999', '需求清理测试项目', '鉴定测评', 'CPU/非嵌', '新研', '内部', 'C', '测试单位', 'user-1', '编制大纲中', datetime('now'), datetime('now'))`,
		`INSERT INTO work_objects (id, project_id, object_kind, name, created_at, updated_at)
		 VALUES ('wo-1', 'project-1', 'srs', '需求规格说明', datetime('now'), datetime('now'))`,
		`INSERT INTO work_object_versions (id, project_id, work_object_id, version, platform, status, source, received_at, receive_mode, created_by, created_at, updated_at)
		 VALUES ('wov-1', 'project-1', 'wo-1', 'V1.0', 'common', 'confirmed', '研制方', '2026-10-19', 'email', 'user-1', datetime('now'), datetime('now'))`,
	}
	for _, statement := range statements {
		if err := db.Exec(statement).Error; err != nil {
			t.Fatalf("写入需求清理夹具失败: %v", err)
		}
	}
	return NewService(db, t.TempDir()), db
}

func seedPurgeableRequirement(t *testing.T, db *gorm.DB, requirementID, eventID string) {
	t.Helper()
	if err := db.Exec(`INSERT INTO software_requirements
		(id, project_id, source_version_id, chapter_number, name, description, primary_kind, tags,
		 origin, status, test_item_task_status, created_by, created_at, updated_at)
		VALUES (?, 'project-1', 'wov-1', ?, ?, '测试描述', 'functional', '[]',
		        'manual', 'excluded', 'none', 'user-1', datetime('now'), datetime('now'))`,
		requirementID, requirementID, requirementID).Error; err != nil {
		t.Fatalf("写入需求失败: %v", err)
	}
	if err := db.Exec(`INSERT INTO requirement_events
		(id, project_id, requirement_id, action, from_status, to_status, detail, operated_by, operated_at, created_at, updated_at)
		VALUES (?, 'project-1', ?, 'exclude', 'official', 'excluded', '', 'user-1', datetime('now'), datetime('now'), datetime('now'))`,
		eventID, requirementID).Error; err != nil {
		t.Fatalf("写入需求删除事件失败: %v", err)
	}
}
