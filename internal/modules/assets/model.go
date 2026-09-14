package assets

import "time"

type WorkObject struct {
	ID         string    `gorm:"column:id;primaryKey" json:"id"`
	ProjectID  string    `gorm:"column:project_id" json:"projectId"`
	ObjectKind string    `gorm:"column:object_kind" json:"objectKind"`
	Name       string    `gorm:"column:name" json:"name"`
	CreatedAt  time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt  time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (WorkObject) TableName() string { return "work_objects" }

type WorkObjectVersion struct {
	ID                    string    `gorm:"column:id;primaryKey" json:"id"`
	ProjectID             string    `gorm:"column:project_id" json:"projectId"`
	WorkObjectID          string    `gorm:"column:work_object_id" json:"workObjectId"`
	Version               string    `gorm:"column:version" json:"version"`
	Platform              string    `gorm:"column:platform" json:"platform"`
	Status                string    `gorm:"column:status" json:"status"`
	SupersededByVersionID *string   `gorm:"column:superseded_by_version_id" json:"supersededByVersionId"`
	Source                string    `gorm:"column:source" json:"source"`
	ReceivedAt            string    `gorm:"column:received_at" json:"receivedAt"`
	ReceiveMode           string    `gorm:"column:receive_mode" json:"receiveMode"`
	CreatedBy             string    `gorm:"column:created_by" json:"createdBy"`
	CreatedAt             time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt             time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (WorkObjectVersion) TableName() string { return "work_object_versions" }

type ReceivedAsset struct {
	ID                  string    `gorm:"column:id;primaryKey" json:"id"`
	ProjectID           string    `gorm:"column:project_id" json:"projectId"`
	WorkObjectVersionID string    `gorm:"column:work_object_version_id" json:"workObjectVersionId"`
	OriginalName        string    `gorm:"column:original_name" json:"originalName"`
	StoragePath         string    `gorm:"column:storage_path" json:"storagePath"`
	FileSize            int64     `gorm:"column:file_size" json:"fileSize"`
	FileType            string    `gorm:"column:file_type" json:"fileType"`
	MimeType            string    `gorm:"column:mime_type" json:"mimeType"`
	SHA256              string    `gorm:"column:sha256" json:"sha256"`
	CreatedBy           string    `gorm:"column:created_by" json:"createdBy"`
	CreatedAt           time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt           time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (ReceivedAsset) TableName() string { return "received_assets" }

type LifecycleEvent struct {
	ID                   string    `gorm:"column:id;primaryKey" json:"id"`
	ProjectID            string    `gorm:"column:project_id" json:"projectId"`
	WorkObjectVersionID  string    `gorm:"column:work_object_version_id" json:"workObjectVersionId"`
	Action               string    `gorm:"column:action" json:"action"`
	FromStatus           string    `gorm:"column:from_status" json:"fromStatus"`
	ToStatus             string    `gorm:"column:to_status" json:"toStatus"`
	ReplacementVersionID *string   `gorm:"column:replacement_version_id" json:"replacementVersionId"`
	Reason               string    `gorm:"column:reason" json:"reason"`
	OperatedBy           string    `gorm:"column:operated_by" json:"operatedBy"`
	OperatedAt           time.Time `gorm:"column:operated_at" json:"operatedAt"`
	CreatedAt            time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt            time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (LifecycleEvent) TableName() string { return "work_object_lifecycle_events" }

type WorkObjectVersionRow struct {
	ID                  string    `gorm:"column:id"`
	ProjectID           string    `gorm:"column:project_id"`
	WorkObjectID        string    `gorm:"column:work_object_id"`
	ObjectKind          string    `gorm:"column:object_kind"`
	ObjectName          string    `gorm:"column:object_name"`
	OriginalName        string    `gorm:"column:original_name"`
	Version             string    `gorm:"column:version"`
	Platform            string    `gorm:"column:platform"`
	Status              string    `gorm:"column:status"`
	SupersededByVersion string    `gorm:"column:superseded_by_version"`
	Source              string    `gorm:"column:source"`
	ReceivedAt          string    `gorm:"column:received_at"`
	ReceiveMode         string    `gorm:"column:receive_mode"`
	FileSize            int64     `gorm:"column:file_size"`
	FileType            string    `gorm:"column:file_type"`
	MimeType            string    `gorm:"column:mime_type"`
	SHA256              string    `gorm:"column:sha256"`
	AssetID             string    `gorm:"column:asset_id"`
	StoragePath         string    `gorm:"column:storage_path"`
	CreatedAt           time.Time `gorm:"column:created_at"`
	UpdatedAt           time.Time `gorm:"column:updated_at"`
}
