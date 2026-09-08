package database

import (
	"path/filepath"
	"testing"
)

func TestOpen(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "meridian.db")

	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("打开数据库失败: %v", err)
	}
	defer func() {
		if sqlDB, closeErr := db.DB(); closeErr == nil {
			_ = sqlDB.Close()
		}
	}()

	var sqliteVersion string
	if err := db.Raw("SELECT sqlite_version()").Scan(&sqliteVersion).Error; err != nil {
		t.Fatalf("查询 SQLite 版本失败: %v", err)
	}
	if sqliteVersion == "" {
		t.Fatal("SQLite 版本为空")
	}

	var foreignKeys int
	if err := db.Raw("PRAGMA foreign_keys").Scan(&foreignKeys).Error; err != nil {
		t.Fatalf("查询 foreign_keys 配置失败: %v", err)
	}
	if foreignKeys != 1 {
		t.Fatalf("foreign_keys 应为 1，实际为 %d", foreignKeys)
	}

	var journalMode string
	if err := db.Raw("PRAGMA journal_mode").Scan(&journalMode).Error; err != nil {
		t.Fatalf("查询 journal_mode 配置失败: %v", err)
	}
	if journalMode != "wal" {
		t.Fatalf("journal_mode 应为 wal，实际为 %s", journalMode)
	}
}
