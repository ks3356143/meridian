package database

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Open(path string) (*gorm.DB, error) {
	if strings.TrimSpace(path) == "" {
		return nil, fmt.Errorf("数据库路径不能为空")
	}

	dir := filepath.Dir(path)
	if dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, fmt.Errorf("创建数据库目录失败: %w", err)
		}
	}

	db, err := gorm.Open(sqlite.Open(buildDSN(path)), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("打开 SQLite 失败: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("获取数据库连接失败: %w", err)
	}
	sqlDB.SetMaxOpenConns(1)

	return db, nil
}

func buildDSN(path string) string {
	normalized := filepath.ToSlash(filepath.Clean(path))
	if strings.HasPrefix(normalized, "file:") {
		return withPragmas(normalized)
	}
	return withPragmas("file:" + normalized)
}

func withPragmas(dsn string) string {
	values := url.Values{}
	values.Add("_pragma", "busy_timeout(5000)")
	values.Add("_pragma", "journal_mode(WAL)")
	values.Add("_pragma", "foreign_keys(1)")

	separator := "?"
	if strings.Contains(dsn, "?") {
		separator = "&"
	}
	return dsn + separator + values.Encode()
}
