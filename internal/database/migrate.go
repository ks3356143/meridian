package database

import (
	"embed"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"gorm.io/gorm"
)

type migrationFile struct {
	version string
	name    string
	content string
}

// Migrate 执行未应用的 up 迁移。迁移按版本号排序，每个迁移在独立事务中执行。
func Migrate(db *gorm.DB, source embed.FS) error {
	entries, err := fs.ReadDir(source, ".")
	if err != nil {
		return fmt.Errorf("读取迁移目录失败: %w", err)
	}

	files := make([]migrationFile, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".up.sql") {
			continue
		}

		parts := strings.SplitN(entry.Name(), "_", 2)
		if len(parts) != 2 {
			return fmt.Errorf("迁移文件命名不合法: %s", entry.Name())
		}

		content, readErr := fs.ReadFile(source, entry.Name())
		if readErr != nil {
			return fmt.Errorf("读取迁移文件失败: %w", readErr)
		}

		files = append(files, migrationFile{
			version: parts[0],
			name:    entry.Name(),
			content: string(content),
		})
	}
	sort.Slice(files, func(i, j int) bool { return files[i].version < files[j].version })

	if err := db.Exec(`
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at DATETIME NOT NULL
)`).Error; err != nil {
		return fmt.Errorf("创建迁移记录表失败: %w", err)
	}

	for _, migration := range files {
		var count int64
		if err := db.Raw(
			"SELECT COUNT(*) FROM schema_migrations WHERE version = ?",
			migration.version,
		).Scan(&count).Error; err != nil {
			return fmt.Errorf("查询迁移状态失败: %w", err)
		}
		if count > 0 {
			continue
		}

		err := db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Exec(migration.content).Error; err != nil {
				return fmt.Errorf("执行迁移 %s 失败: %w", migration.name, err)
			}
			return tx.Exec(
				"INSERT INTO schema_migrations (version, applied_at) VALUES (?, datetime('now'))",
				migration.version,
			).Error
		})
		if err != nil {
			return err
		}
	}

	return nil
}
