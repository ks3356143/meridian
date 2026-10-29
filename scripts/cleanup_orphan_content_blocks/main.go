package main

import (
	"flag"
	"fmt"
	"os"
	"sort"

	"gorm.io/gorm"

	"chenmeridian/internal/database"
)

type orphanGroup struct {
	OwnerType string `gorm:"column:owner_type"`
	BlockKey  string `gorm:"column:block_key"`
	Total     int64  `gorm:"column:total"`
}

type orphanRule struct {
	OwnerType string
	CountSQL  string
	DeleteSQL string
}

// content_blocks 使用 owner_type + owner_id 多态归属；这里只处理有明确父表的拥有者类型。
var orphanRules = []orphanRule{
	{
		OwnerType: "test_case",
		CountSQL: `SELECT COUNT(*) FROM content_blocks cb
			WHERE cb.owner_type = 'test_case'
			  AND NOT EXISTS (SELECT 1 FROM test_cases tc WHERE tc.id = cb.owner_id)`,
		DeleteSQL: `DELETE FROM content_blocks
			WHERE owner_type = 'test_case'
			  AND NOT EXISTS (SELECT 1 FROM test_cases tc WHERE tc.id = content_blocks.owner_id)`,
	},
	{
		OwnerType: "test_item",
		CountSQL: `SELECT COUNT(*) FROM content_blocks cb
			WHERE cb.owner_type = 'test_item'
			  AND NOT EXISTS (SELECT 1 FROM test_items ti WHERE ti.id = cb.owner_id)`,
		DeleteSQL: `DELETE FROM content_blocks
			WHERE owner_type = 'test_item'
			  AND NOT EXISTS (SELECT 1 FROM test_items ti WHERE ti.id = content_blocks.owner_id)`,
	},
	{
		OwnerType: "requirement",
		CountSQL: `SELECT COUNT(*) FROM content_blocks cb
			WHERE cb.owner_type = 'requirement'
			  AND NOT EXISTS (SELECT 1 FROM software_requirements sr WHERE sr.id = cb.owner_id)`,
		DeleteSQL: `DELETE FROM content_blocks
			WHERE owner_type = 'requirement'
			  AND NOT EXISTS (SELECT 1 FROM software_requirements sr WHERE sr.id = content_blocks.owner_id)`,
	},
	{
		OwnerType: "round",
		CountSQL: `SELECT COUNT(*) FROM content_blocks cb
			WHERE cb.owner_type = 'round'
			  AND NOT EXISTS (SELECT 1 FROM test_rounds tr WHERE tr.id = cb.owner_id)`,
		DeleteSQL: `DELETE FROM content_blocks
			WHERE owner_type = 'round'
			  AND NOT EXISTS (SELECT 1 FROM test_rounds tr WHERE tr.id = content_blocks.owner_id)`,
	},
	{
		OwnerType: "project",
		CountSQL: `SELECT COUNT(*) FROM content_blocks cb
			WHERE cb.owner_type = 'project'
			  AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = cb.owner_id)`,
		DeleteSQL: `DELETE FROM content_blocks
			WHERE owner_type = 'project'
			  AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = content_blocks.owner_id)`,
	},
}

func main() {
	dbPath := flag.String("db", "data/meridian.db", "SQLite 数据库路径")
	apply := flag.Bool("apply", false, "实际删除；默认只读统计")
	flag.Parse()

	db, err := database.Open(*dbPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer func() {
		if sqlDB, dbErr := db.DB(); dbErr == nil {
			_ = sqlDB.Close()
		}
	}()

	groups, err := listOrphans(db)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	printGroups(groups)

	if !*apply {
		fmt.Println("mode=dry-run；未删除任何内容块。确认后使用 --apply。")
		return
	}
	if err := cleanup(db); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println("cleanup=ok")
	groups, err = listOrphans(db)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	printGroups(groups)
}

func listOrphans(db *gorm.DB) ([]orphanGroup, error) {
	groups := make([]orphanGroup, 0)
	for _, rule := range orphanRules {
		var rows []orphanGroup
		query := `SELECT cb.owner_type, cb.block_key, COUNT(*) AS total
			FROM content_blocks cb
			WHERE cb.owner_type = ?
			  AND NOT EXISTS (` + parentExistsSQL(rule.OwnerType) + `)
			GROUP BY cb.owner_type, cb.block_key
			ORDER BY cb.owner_type, cb.block_key`
		if err := db.Raw(query, rule.OwnerType).Scan(&rows).Error; err != nil {
			return nil, fmt.Errorf("统计 %s 孤立块失败: %w", rule.OwnerType, err)
		}
		groups = append(groups, rows...)
	}
	sort.Slice(groups, func(i, j int) bool {
		if groups[i].OwnerType == groups[j].OwnerType {
			return groups[i].BlockKey < groups[j].BlockKey
		}
		return groups[i].OwnerType < groups[j].OwnerType
	})
	return groups, nil
}

func parentExistsSQL(ownerType string) string {
	switch ownerType {
	case "test_case":
		return `SELECT 1 FROM test_cases tc WHERE tc.id = cb.owner_id`
	case "test_item":
		return `SELECT 1 FROM test_items ti WHERE ti.id = cb.owner_id`
	case "requirement":
		return `SELECT 1 FROM software_requirements sr WHERE sr.id = cb.owner_id`
	case "round":
		return `SELECT 1 FROM test_rounds tr WHERE tr.id = cb.owner_id`
	case "project":
		return `SELECT 1 FROM projects p WHERE p.id = cb.owner_id`
	default:
		return `SELECT 1`
	}
}

func printGroups(groups []orphanGroup) {
	var total int64
	for _, group := range groups {
		fmt.Printf("orphan owner_type=%s block_key=%s count=%d\n", group.OwnerType, group.BlockKey, group.Total)
		total += group.Total
	}
	fmt.Printf("orphan total=%d\n", total)
}

func cleanup(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		for _, rule := range orphanRules {
			var count int64
			if err := tx.Raw(rule.CountSQL).Scan(&count).Error; err != nil {
				return fmt.Errorf("统计 %s 孤立块失败: %w", rule.OwnerType, err)
			}
			if count == 0 {
				continue
			}
			result := tx.Exec(rule.DeleteSQL)
			if result.Error != nil {
				return fmt.Errorf("清理 %s 孤立块失败: %w", rule.OwnerType, result.Error)
			}
			fmt.Printf("deleted owner_type=%s count=%d\n", rule.OwnerType, result.RowsAffected)
		}
		return nil
	})
}
