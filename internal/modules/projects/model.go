package projects

import "time"

type Project struct {
	ID               string    `gorm:"column:id;primaryKey" json:"id"`
	Code             string    `gorm:"column:code;uniqueIndex" json:"code"`
	Name             string    `gorm:"column:name" json:"name"`
	Nature           string    `gorm:"column:nature" json:"nature"`
	Platform         string    `gorm:"column:platform" json:"platform"`
	SoftwareType     string    `gorm:"column:software_type" json:"softwareType"`
	Classification   string    `gorm:"column:classification" json:"classification"`
	SecurityLevel    string    `gorm:"column:security_level" json:"securityLevel"`
	Organization     string    `gorm:"column:organization" json:"organization"`
	OwnerID          string    `gorm:"column:owner_id" json:"ownerId"`
	Status           string    `gorm:"column:status" json:"status"`
	CasesTotal       int       `gorm:"column:cases_total" json:"casesTotal"`
	CasesExecuted    int       `gorm:"column:cases_executed" json:"casesExecuted"`
	CriticalIssues   int       `gorm:"column:critical_issues" json:"criticalIssues"`
	SeriousIssues    int       `gorm:"column:serious_issues" json:"seriousIssues"`
	NormalIssues     int       `gorm:"column:normal_issues" json:"normalIssues"`
	SuggestionIssues int       `gorm:"column:suggestion_issues" json:"suggestionIssues"`
	CreatedAt        time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt        time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (Project) TableName() string { return "projects" }

type DictionaryItem struct {
	ID        string    `gorm:"column:id;primaryKey" json:"id"`
	Category  string    `gorm:"column:category" json:"category"`
	Name      string    `gorm:"column:name" json:"name"`
	SortOrder int       `gorm:"column:sort_order" json:"sortOrder"`
	IsEnabled bool      `gorm:"column:is_enabled" json:"isEnabled"`
	IsPreset  bool      `gorm:"column:is_preset" json:"isPreset"`
	CreatedAt time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (DictionaryItem) TableName() string { return "dictionary_items" }

type ReferenceStandard struct {
	ID            string    `gorm:"column:id;primaryKey" json:"id"`
	Name          string    `gorm:"column:name" json:"name"`
	Code          string    `gorm:"column:code" json:"code"`
	PublishedDate string    `gorm:"column:published_date" json:"publishedDate"`
	Source        string    `gorm:"column:source" json:"source"`
	SortOrder     int       `gorm:"column:sort_order" json:"sortOrder"`
	IsEnabled     bool      `gorm:"column:is_enabled" json:"isEnabled"`
	CreatedAt     time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt     time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (ReferenceStandard) TableName() string { return "reference_standards" }

type ProjectMember struct {
	ID        string    `gorm:"column:id;primaryKey" json:"id"`
	ProjectID string    `gorm:"column:project_id" json:"projectId"`
	UserID    string    `gorm:"column:user_id" json:"userId"`
	IsOwner   bool      `gorm:"column:is_owner" json:"isOwner"`
	CreatedAt time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (ProjectMember) TableName() string { return "project_members" }

type ProjectDictionaryItem struct {
	ID               string    `gorm:"column:id;primaryKey" json:"id"`
	ProjectID        string    `gorm:"column:project_id" json:"projectId"`
	DictionaryItemID string    `gorm:"column:dictionary_item_id" json:"dictionaryItemId"`
	CreatedAt        time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt        time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (ProjectDictionaryItem) TableName() string { return "project_languages" }

type ProjectRuntimeEnvironment struct {
	ProjectDictionaryItem
}

func (ProjectRuntimeEnvironment) TableName() string { return "project_runtime_environments" }

type ProjectDevelopmentEnvironment struct {
	ProjectDictionaryItem
}

func (ProjectDevelopmentEnvironment) TableName() string { return "project_development_environments" }

type ProjectReferenceStandard struct {
	ID                  string    `gorm:"column:id;primaryKey" json:"id"`
	ProjectID           string    `gorm:"column:project_id" json:"projectId"`
	ReferenceStandardID string    `gorm:"column:reference_standard_id" json:"referenceStandardId"`
	CreatedAt           time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt           time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (ProjectReferenceStandard) TableName() string { return "project_reference_standards" }
