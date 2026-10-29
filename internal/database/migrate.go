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
	version        string
	name           string
	content        string
	foreignKeysOff bool
}

// Migrate 执行未应用的 up 迁移。迁移按版本号排序，每个迁移在独立事务中执行。
func Migrate(db *gorm.DB, source embed.FS) error {
	return migrateTo(db, source, "")
}

// migrateTo 允许集成测试先执行到指定版本，再验证最后一个迁移的数据复制行为。
func migrateTo(db *gorm.DB, source embed.FS, maxVersion string) error {
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
			version:        parts[0],
			name:           entry.Name(),
			content:        string(content),
			foreignKeysOff: strings.Contains(string(content), "-- migrate:foreign-keys-off"),
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
		if maxVersion != "" && migration.version > maxVersion {
			continue
		}

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

		if err := applyMigration(db, migration); err != nil {
			return err
		}
	}

	return nil
}

func applyMigration(db *gorm.DB, migration migrationFile) error {
	if migration.foreignKeysOff {
		if err := setForeignKeys(db, false); err != nil {
			return fmt.Errorf("关闭外键失败，迁移 %s 未执行: %w", migration.name, err)
		}
	}

	txErr := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(migration.content).Error; err != nil {
			return fmt.Errorf("执行迁移 %s 失败: %w", migration.name, err)
		}
		if migration.foreignKeysOff {
			violations, err := foreignKeyViolationCount(tx)
			if err != nil {
				return fmt.Errorf("迁移 %s 外键校验失败: %w", migration.name, err)
			}
			if violations > 0 {
				return fmt.Errorf("迁移 %s 提交前发现 %d 条外键违规", migration.name, violations)
			}
		}
		return tx.Exec(
			"INSERT INTO schema_migrations (version, applied_at) VALUES (?, datetime('now'))",
			migration.version,
		).Error
	})

	var restoreErr error
	if migration.foreignKeysOff {
		restoreErr = setForeignKeys(db, true)
	}
	if txErr != nil {
		return txErr
	}
	if restoreErr != nil {
		return fmt.Errorf("迁移 %s 完成后恢复外键失败: %w", migration.name, restoreErr)
	}
	return nil
}

func setForeignKeys(db *gorm.DB, enabled bool) error {
	value := 0
	if enabled {
		value = 1
	}
	if err := db.Exec(fmt.Sprintf("PRAGMA foreign_keys = %d", value)).Error; err != nil {
		return err
	}
	var current int
	if err := db.Raw("PRAGMA foreign_keys").Scan(&current).Error; err != nil {
		return err
	}
	if current != value {
		return fmt.Errorf("PRAGMA foreign_keys 期望 %d，实际 %d", value, current)
	}
	return nil
}

func foreignKeyViolationCount(db *gorm.DB) (int, error) {
	rows, err := db.Raw("PRAGMA foreign_key_check").Rows()
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return 0, err
	}
	count := 0
	for rows.Next() {
		values := make([]any, len(columns))
		pointers := make([]any, len(columns))
		for index := range values {
			pointers[index] = &values[index]
		}
		if err := rows.Scan(pointers...); err != nil {
			return 0, err
		}
		count++
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}
	return count, nil
}
