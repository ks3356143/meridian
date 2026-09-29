package contentblocks

import "time"

// 拥有者类型，与内容块模型文档一致。
const (
	OwnerTypeProject         = "project"
	OwnerTypeRound           = "round"
	OwnerTypeRequirement     = "requirement"
	OwnerTypeTestItem        = "test_item"
	OwnerTypeTestCase        = "test_case"
	OwnerTypeIssue           = "issue"
	OwnerTypeDocumentSection = "document_section"
)

// 需求正文块的稳定键。
const BlockKeyRequirementBody = "requirement.body"

// SchemaVersion 是当前内容结构版本。
const SchemaVersion = 1

// ContentBlock 对应 content_blocks 表。
type ContentBlock struct {
	ID            string    `gorm:"column:id;primaryKey"`
	ProjectID     string    `gorm:"column:project_id"`
	OwnerType     string    `gorm:"column:owner_type"`
	OwnerID       string    `gorm:"column:owner_id"`
	BlockKey      string    `gorm:"column:block_key"`
	BodyJSON      string    `gorm:"column:body_json"`
	PayloadJSON   string    `gorm:"column:payload_json"`
	PlainText     string    `gorm:"column:plain_text"`
	SchemaVersion int       `gorm:"column:schema_version"`
	Origin        string    `gorm:"column:origin"`
	AuthoringMode string    `gorm:"column:authoring_mode"`
	SortOrder     int       `gorm:"column:sort_order"`
	CreatedBy     string    `gorm:"column:created_by"`
	CreatedAt     time.Time `gorm:"column:created_at"`
	UpdatedAt     time.Time `gorm:"column:updated_at"`
}

func (ContentBlock) TableName() string { return "content_blocks" }