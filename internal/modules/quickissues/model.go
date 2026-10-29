package quickissues

import "time"

// Note 快捷问题草稿；不是正式问题单，不进入未闭环问题统计。
type Note struct {
	ID                string    `gorm:"column:id;primaryKey" json:"id"`
	ProjectID         string    `gorm:"column:project_id" json:"projectId"`
	RoundID           string    `gorm:"column:round_id" json:"roundId"`
	TestCaseID        string    `gorm:"column:test_case_id" json:"testCaseId"`
	TestCaseStepID    *string   `gorm:"column:test_case_step_id" json:"testCaseStepId"`
	NoteText          string    `gorm:"column:note_text" json:"noteText"`
	ScreenshotAssetID *string   `gorm:"column:screenshot_asset_id" json:"screenshotAssetId"`
	CreatedBy         string    `gorm:"column:created_by" json:"createdBy"`
	CreatedAt         time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt         time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (Note) TableName() string { return "quick_issue_notes" }

// NoteView 列表展示字段：带步骤序号、创建人姓名和前端编辑权限。
type NoteView struct {
	ID                string    `gorm:"column:id" json:"id"`
	ProjectID         string    `gorm:"column:project_id" json:"projectId"`
	RoundID           string    `gorm:"column:round_id" json:"roundId"`
	TestCaseID        string    `gorm:"column:test_case_id" json:"testCaseId"`
	TestCaseStepID    *string   `gorm:"column:test_case_step_id" json:"testCaseStepId"`
	NoteText          string    `gorm:"column:note_text" json:"noteText"`
	ScreenshotAssetID *string   `gorm:"column:screenshot_asset_id" json:"screenshotAssetId"`
	CreatedBy         string    `gorm:"column:created_by" json:"createdBy"`
	CreatedAt         time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt         time.Time `gorm:"column:updated_at" json:"updatedAt"`
	StepSeq           *int      `gorm:"column:step_seq" json:"stepSeq"`
	CreatedByName     string    `gorm:"column:created_by_name" json:"createdByName"`
	CanEdit           bool      `gorm:"-" json:"canEdit"`
}
