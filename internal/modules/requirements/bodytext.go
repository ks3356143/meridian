package requirements

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"
)

// 正文块键名，与 contentblocks 模块的 block_key 一致。
const requirementBodyBlockKey = "requirement.body"

// bodyPlainTexts 批量读取项目的正文纯文本，键为需求 ID。
// 正文块是正文的权威源；description 列只服务还没落块的历史与解析数据。
func (s *Service) bodyPlainTexts(ctx context.Context, projectID string) (map[string]string, error) {
	var rows []struct {
		OwnerID   string `gorm:"column:owner_id"`
		PlainText string `gorm:"column:plain_text"`
	}
	if err := s.db.WithContext(ctx).
		Table("content_blocks").
		Select("owner_id, plain_text").
		Where("project_id = ? AND owner_type = ? AND block_key = ?",
			projectID, "requirement", requirementBodyBlockKey).
		Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("查询需求正文块失败: %w", err)
	}
	texts := make(map[string]string, len(rows))
	for _, row := range rows {
		if text := strings.TrimSpace(row.PlainText); text != "" {
			texts[row.OwnerID] = text
		}
	}
	return texts, nil
}

// bodyPlainText 读取单条需求的正文纯文本，没有正文块时返回空串。
func (s *Service) bodyPlainText(ctx context.Context, requirementID string) string {
	return bodyPlainTextWith(ctx, s.db, requirementID)
}

// bodyPlainTextWith 在指定句柄（含事务）上读取正文纯文本。
// 写事务内必须传 tx：另开连接读取会被 SQLite 的写锁挡住。
func bodyPlainTextWith(ctx context.Context, db *gorm.DB, requirementID string) string {
	var row struct {
		PlainText string `gorm:"column:plain_text"`
	}
	if err := db.WithContext(ctx).
		Table("content_blocks").
		Select("plain_text").
		Where("owner_type = ? AND owner_id = ? AND block_key = ?",
			"requirement", requirementID, requirementBodyBlockKey).
		Limit(1).
		Scan(&row).Error; err != nil {
		return ""
	}
	return strings.TrimSpace(row.PlainText)
}

// effectiveDescription 返回列表摘要、搜索与完整度使用的正文文本：正文块优先，description 兜底。
func effectiveDescription(blockText string, fallback string) string {
	if blockText != "" {
		return blockText
	}
	return fallback
}
