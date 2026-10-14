package projects

import (
	"context"
	"path/filepath"
	"testing"

	"gorm.io/gorm"

	"chenmeridian/internal/database"
	"chenmeridian/migrations"
)

// newCountsFixture 建库并写入 1 个项目、2 个测试项、3 条用例（通过 / 未通过 / 未执行）。
func newCountsFixture(t *testing.T) (*Service, *gorm.DB) {
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
		 VALUES ('project-1', 'R99999', '计数测试项目', '鉴定测评', 'CPU/非嵌', '新研', '内部', 'C', '测试单位', 'user-1', '编制大纲中', datetime('now'), datetime('now'))`,
		`INSERT INTO test_items (id, project_id, type_code, identifier, suffix, name, created_at, updated_at)
		 VALUES ('item-1', 'project-1', 'SU', 'XQ_SU_AAAA_001', 'AAAA', '测试项一', datetime('now'), datetime('now'))`,
		`INSERT INTO test_items (id, project_id, type_code, identifier, suffix, name, created_at, updated_at)
		 VALUES ('item-2', 'project-1', 'SU', 'XQ_SU_BBBB_001', 'BBBB', '测试项二', datetime('now'), datetime('now'))`,
		`INSERT INTO test_cases (id, project_id, test_item_id, identifier, seq, name, status, sort_order, created_at, updated_at)
		 VALUES ('case-1', 'project-1', 'item-1', 'YL_SU_AAAA_001', 1, '用例一', 'passed', 0, datetime('now'), datetime('now'))`,
		`INSERT INTO test_cases (id, project_id, test_item_id, identifier, seq, name, status, sort_order, created_at, updated_at)
		 VALUES ('case-2', 'project-1', 'item-1', 'YL_SU_AAAA_002', 2, '用例二', 'failed', 1, datetime('now'), datetime('now'))`,
		`INSERT INTO test_cases (id, project_id, test_item_id, identifier, seq, name, status, sort_order, created_at, updated_at)
		 VALUES ('case-3', 'project-1', 'item-2', 'YL_SU_BBBB_001', 1, '用例三', 'pending', 0, datetime('now'), datetime('now'))`,
	}
	for _, statement := range statements {
		if err := db.Exec(statement).Error; err != nil {
			t.Fatalf("写入夹具失败: %v", err)
		}
	}
	return NewService(db), db
}

func TestListCountsWorkspaceObjectsLive(t *testing.T) {
	service, _ := newCountsFixture(t)

	all, err := service.List(context.Background())
	if err != nil {
		t.Fatalf("查询项目列表失败: %v", err)
	}
	if len(all) != 1 {
		t.Fatalf("项目数量 = %d, 期望 1", len(all))
	}
	got := all[0]
	if got.TestItemsTotal != 2 || got.CasesTotal != 3 || got.CasesExecuted != 2 {
		t.Fatalf("工作区计数 = 测试项 %d / 用例 %d / 已执行 %d, 期望 2 / 3 / 2",
			got.TestItemsTotal, got.CasesTotal, got.CasesExecuted)
	}
}
