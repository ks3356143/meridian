package database

import (
	"path/filepath"
	"testing"

	"gorm.io/gorm"

	"chenmeridian/migrations"
)

func TestRoundTreeMigrationPreservesDataAndChangesUniqueness(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "meridian.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if sqlDB, closeErr := db.DB(); closeErr == nil {
			_ = sqlDB.Close()
		}
	})
	if err := migrateTo(db, migrations.FS, "0026"); err != nil {
		t.Fatal(err)
	}
	seedRoundTreeMigrationData(t, db)
	if err := Migrate(db, migrations.FS); err != nil {
		t.Fatalf("0027: %v", err)
	}
	var fk int
	if err := db.Raw("PRAGMA foreign_keys").Scan(&fk).Error; err != nil {
		t.Fatal(err)
	}
	if fk != 1 {
		t.Fatalf("foreign_keys=%d", fk)
	}
	var roundID, lineage string
	if err := db.Raw("SELECT round_id FROM test_items WHERE id='item-1'").Scan(&roundID).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Raw("SELECT lineage_key FROM test_items WHERE id='item-1'").Scan(&lineage).Error; err != nil {
		t.Fatal(err)
	}
	if roundID != "round-1" || lineage != "item-1" {
		t.Fatalf("item round=%s lineage=%s", roundID, lineage)
	}
	var body string
	if err := db.Raw("SELECT body_json FROM content_blocks WHERE block_key='step.step-1.act'").Scan(&body).Error; err != nil {
		t.Fatal(err)
	}
	if body != "{\"type\":\"doc\",\"content\":[]}" {
		t.Fatalf("body=%s", body)
	}
	assertRoundTreeCounts(t, db)
	mustExec(t, db, `INSERT INTO test_rounds (id, project_id, round_number, name, round_type, status, created_at, updated_at) VALUES ('round-2','project-1',2,'第 2 轮','regression','draft',datetime('now'),datetime('now'))`)
	mustExec(t, db, `INSERT INTO test_items (id,project_id,round_id,type_code,identifier,suffix,name,folder_id,sort_order,description,adequacy,pass_criteria,implicit_requirement,lineage_key,created_at,updated_at) VALUES ('item-2','project-1','round-2','SU','XQ_SU_TEST','TEST','第二轮项目',NULL,0,'','','',0,'item-1',datetime('now'),datetime('now'))`)
	if err := db.Exec(`INSERT INTO test_items (id,project_id,round_id,type_code,identifier,suffix,name,folder_id,sort_order,description,adequacy,pass_criteria,implicit_requirement,lineage_key,created_at,updated_at) VALUES ('item-dup','project-1','round-1','SU','XQ_SU_TEST','TEST','重复',NULL,0,'','','',0,'item-dup',datetime('now'),datetime('now'))`).Error; err == nil {
		t.Fatal("同轮重复未拒绝")
	}
	mustExec(t, db, `INSERT INTO test_cases (id,project_id,test_item_id,identifier,seq,name,sort_order,status,lineage_key,created_at,updated_at) VALUES ('case-2','project-1','item-2','CASE-1',1,'第二轮用例',0,'pending','case-1',datetime('now'),datetime('now'))`)
	if err := db.Exec(`INSERT INTO test_cases (id,project_id,test_item_id,identifier,seq,name,sort_order,status,lineage_key,created_at,updated_at) VALUES ('case-dup','project-1','item-2','CASE-1',2,'重复用例',1,'pending','case-dup',datetime('now'),datetime('now'))`).Error; err == nil {
		t.Fatal("同测试项重复用例未拒绝")
	}
	if err := db.Exec(`INSERT INTO test_item_folders (id,project_id,round_id,type_code,parent_id,name,sort_order,created_at,updated_at) VALUES ('folder-cross','project-1','round-2','SU','folder-1','跨轮父目录',0,datetime('now'),datetime('now'))`).Error; err == nil {
		t.Fatal("跨轮父目录未拒绝")
	}
	violations, err := foreignKeyViolationCount(db)
	if err != nil {
		t.Fatal(err)
	}
	if violations != 0 {
		t.Fatalf("外键违规=%d", violations)
	}
	var integrity string
	if err := db.Raw("PRAGMA integrity_check").Scan(&integrity).Error; err != nil {
		t.Fatal(err)
	}
	if integrity != "ok" {
		t.Fatalf("integrity=%s", integrity)
	}
}

func seedRoundTreeMigrationData(t *testing.T, db *gorm.DB) {
	t.Helper()
	mustExec(t, db, `INSERT INTO users (id,username,display_name,password_hash,created_at,updated_at) VALUES ('user-1','tester','测试员','hash',datetime('now'),datetime('now'))`)
	mustExec(t, db, `INSERT INTO projects (id,code,name,nature,platform,software_type,classification,security_level,organization,owner_id,status,created_at,updated_at) VALUES ('project-1','R99999','迁移测试项目','鉴定测评','CPU/非嵌','新研','内部','C','测试单位','user-1','编制大纲中',datetime('now'),datetime('now'))`)
	mustExec(t, db, `INSERT INTO test_rounds (id,project_id,round_number,name,round_type,status,created_at,updated_at) VALUES ('round-1','project-1',1,'第 1 轮','initial','draft',datetime('now'),datetime('now'))`)
	mustExec(t, db, `INSERT INTO test_item_folders (id,project_id,type_code,parent_id,name,sort_order,created_at,updated_at) VALUES ('folder-1','project-1','SU',NULL,'功能组',0,datetime('now'),datetime('now'))`)
	mustExec(t, db, `INSERT INTO test_items (id,project_id,type_code,identifier,suffix,name,folder_id,sort_order,description,adequacy,pass_criteria,created_at,updated_at) VALUES ('item-1','project-1','SU','XQ_SU_TEST','TEST','测试项','folder-1',0,'','','',datetime('now'),datetime('now'))`)
	mustExec(t, db, `INSERT INTO test_cases (id,project_id,test_item_id,identifier,seq,name,sort_order,status,created_at,updated_at) VALUES ('case-1','project-1','item-1','CASE-1',1,'用例',0,'pending',datetime('now'),datetime('now'))`)
	mustExec(t, db, `INSERT INTO test_case_steps (id,test_case_id,seq,expect_text,passed,sort_order,created_at,updated_at) VALUES ('step-1','case-1',1,'预期结果','none',0,datetime('now'),datetime('now'))`)
	mustExec(t, db, `INSERT INTO content_blocks (id,project_id,owner_type,owner_id,block_key,body_json,plain_text,origin,authoring_mode,created_at,updated_at) VALUES ('block-act','project-1','test_case','case-1','step.step-1.act','{"type":"doc","content":[]}','实测结果','manual','manual',datetime('now'),datetime('now'))`)
}

func assertRoundTreeCounts(t *testing.T, db *gorm.DB) {
	t.Helper()
	for table, want := range map[string]int64{"test_items": 1, "test_cases": 1, "test_case_steps": 1, "content_blocks": 1, "test_rounds": 1, "test_item_folders": 1} {
		var got int64
		if err := db.Raw("SELECT COUNT(*) FROM " + table).Scan(&got).Error; err != nil {
			t.Fatal(err)
		}
		if got != want {
			t.Fatalf("%s=%d want=%d", table, got, want)
		}
	}
	var bridges int64
	if err := db.Raw("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('round_test_items','round_test_cases')").Scan(&bridges).Error; err != nil {
		t.Fatal(err)
	}
	if bridges != 0 {
		t.Fatalf("桥表未删除: %d", bridges)
	}
}

func mustExec(t *testing.T, db *gorm.DB, query string, args ...any) {
	t.Helper()
	if err := db.Exec(query, args...).Error; err != nil {
		t.Fatalf("SQL: %v", err)
	}
}
