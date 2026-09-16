package requirements

import "time"

type Section struct {
	ID              string    `gorm:"column:id;primaryKey" json:"id"`
	ProjectID       string    `gorm:"column:project_id" json:"projectId"`
	SourceVersionID string    `gorm:"column:source_version_id" json:"sourceVersionId"`
	ParentID        *string   `gorm:"column:parent_id" json:"parentId"`
	ChapterNumber   string    `gorm:"column:chapter_number" json:"chapterNumber"`
	Title           string    `gorm:"column:title" json:"title"`
	Origin          string    `gorm:"column:origin" json:"origin"`
	SourceAnchor    string    `gorm:"column:source_anchor" json:"sourceAnchor"`
	CreatedBy       string    `gorm:"column:created_by" json:"createdBy"`
	CreatedAt       time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt       time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (Section) TableName() string { return "requirement_sections" }

type Requirement struct {
	ID                 string    `gorm:"column:id;primaryKey" json:"id"`
	ProjectID          string    `gorm:"column:project_id" json:"projectId"`
	SourceVersionID    string    `gorm:"column:source_version_id" json:"sourceVersionId"`
	SectionID          *string   `gorm:"column:section_id" json:"sectionId"`
	ChapterNumber      string    `gorm:"column:chapter_number" json:"chapterNumber"`
	ExternalIdentifier string    `gorm:"column:external_identifier" json:"externalIdentifier"`
	Name               string    `gorm:"column:name" json:"name"`
	Description        string    `gorm:"column:description" json:"description"`
	PrimaryKind        string    `gorm:"column:primary_kind" json:"primaryKind"`
	SecondaryKinds     string    `gorm:"column:secondary_kinds" json:"secondaryKinds"`
	Tags               string    `gorm:"column:tags" json:"tags"`
	Origin             string    `gorm:"column:origin" json:"origin"`
	SourceAnchor       string    `gorm:"column:source_anchor" json:"sourceAnchor"`
	Status             string    `gorm:"column:status" json:"status"`
	TestItemTaskStatus string    `gorm:"column:test_item_task_status" json:"testItemTaskStatus"`
	TestItemID         *string   `gorm:"column:test_item_id" json:"testItemId"`
	SupersededByID     *string   `gorm:"column:superseded_by_id" json:"supersededById"`
	CreatedBy          string    `gorm:"column:created_by" json:"createdBy"`
	CreatedAt          time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt          time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (Requirement) TableName() string { return "software_requirements" }

type Event struct {
	ID            string    `gorm:"column:id;primaryKey" json:"id"`
	ProjectID     string    `gorm:"column:project_id" json:"projectId"`
	RequirementID string    `gorm:"column:requirement_id" json:"requirementId"`
	Action        string    `gorm:"column:action" json:"action"`
	FromStatus    string    `gorm:"column:from_status" json:"fromStatus"`
	ToStatus      string    `gorm:"column:to_status" json:"toStatus"`
	Detail        string    `gorm:"column:detail" json:"detail"`
	OperatedBy    string    `gorm:"column:operated_by" json:"operatedBy"`
	OperatedAt    time.Time `gorm:"column:operated_at" json:"operatedAt"`
	CreatedAt     time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt     time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (Event) TableName() string { return "requirement_events" }
