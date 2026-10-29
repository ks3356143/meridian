package contentblocks

import (
	"fmt"

	"gorm.io/gorm"

	"chenmeridian/internal/id"
)

// 用例步骤块：输入及操作（op）与实测结果（act），块键 step.{步骤ID}.{kind}。
const (
	StepKindOp  = "op"
	StepKindAct = "act"
)

// StepBlockKey 拼用例步骤块键。
func StepBlockKey(stepID, kind string) string {
	return "step." + stepID + "." + kind
}

// StepBlockPrefix 返回某步骤全部块的键前缀。
func StepBlockPrefix(stepID string) string {
	return "step." + stepID + "."
}

// SubItemBlockPrefix 返回某测试子项全部历史富文本块的键前缀。
func SubItemBlockPrefix(subItemID string) string {
	return "sub_item." + subItemID + "."
}

// CopyStepBlockTx 在同一事务内把源步骤的块复制给目标步骤的新属主（步骤行 / 用例副本均用；随写事务传入 tx 避免另开连接死锁）。
func CopyStepBlockTx(tx *gorm.DB, sourceStepID, targetOwnerID, targetStepID, kind string) error {
	newID, err := id.New()
	if err != nil {
		return err
	}
	result := tx.Exec(`INSERT INTO content_blocks
		(id, project_id, owner_type, owner_id, block_key, body_json, payload_json, plain_text,
		 schema_version, origin, authoring_mode, sort_order, created_by, created_at, updated_at)
		SELECT ?, project_id, owner_type, ?, ?, body_json, payload_json, plain_text,
		 schema_version, origin, authoring_mode, sort_order, created_by, created_at, updated_at
		FROM content_blocks
		WHERE owner_type = ? AND block_key = ?`,
		newID, targetOwnerID, StepBlockKey(targetStepID, kind), OwnerTypeTestCase, StepBlockKey(sourceStepID, kind))
	if result.Error != nil {
		return fmt.Errorf("复制步骤内容块失败: %w", result.Error)
	}
	return nil
}

// DeleteOwnerBlocksTx 在同一事务内删除某个拥有者的全部内容块。
func DeleteOwnerBlocksTx(tx *gorm.DB, ownerType, ownerID string) error {
	if err := tx.Exec(
		"DELETE FROM content_blocks WHERE owner_type = ? AND owner_id = ?",
		ownerType, ownerID,
	).Error; err != nil {
		return fmt.Errorf("删除拥有者内容块失败: %w", err)
	}
	return nil
}

// DeleteBlocksTx 在同一事务内删除拥有者指定键前缀下的块（步骤删除清理用）。
func DeleteBlocksTx(tx *gorm.DB, ownerType, ownerID, keyPrefix string) error {
	if keyPrefix == "" {
		return DeleteOwnerBlocksTx(tx, ownerType, ownerID)
	}
	if err := tx.Exec(
		"DELETE FROM content_blocks WHERE owner_type = ? AND owner_id = ? AND block_key LIKE ?",
		ownerType, ownerID, keyPrefix+"%",
	).Error; err != nil {
		return fmt.Errorf("删除内容块失败: %w", err)
	}
	return nil
}
