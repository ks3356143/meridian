package testitems

import "time"

// ItemType 测试项类型字典（24 类，迁移 0019 种子）。
type ItemType struct {
	ID                  string `gorm:"column:id;primaryKey" json:"id"`
	Code                string `gorm:"column:code" json:"code"`
	Name                string `gorm:"column:name" json:"name"`
	Category            string `gorm:"column:category" json:"category"`
	IsStatic            bool   `gorm:"column:is_static" json:"isStatic"`
	PlatformScope       string `gorm:"column:platform_scope" json:"platformScope"`
	OutputOrder         int    `gorm:"column:output_order" json:"outputOrder"`
	DefaultAdequacy     string `gorm:"column:default_adequacy" json:"defaultAdequacy"`
	DefaultPassCriteria string `gorm:"column:default_pass_criteria" json:"defaultPassCriteria"`
	// DefaultTestMethod 静态四类的默认测试方法（CPU/通用）；FPGA 变体见下一列。
	DefaultTestMethod     string `gorm:"column:default_test_method" json:"defaultTestMethod"`
	DefaultTestMethodFPGA string `gorm:"column:default_test_method_fpga" json:"defaultTestMethodFpga"`
	// DefaultDescription 测试项默认描述；DefaultSubItemName/DefaultSubItemDesc/DefaultExpected 默认子项的名称、描述与通过准则。
	DefaultDescription string    `gorm:"column:default_description" json:"defaultDescription"`
	DefaultSubItemName string    `gorm:"column:default_sub_item_name" json:"defaultSubItemName"`
	DefaultSubItemDesc string    `gorm:"column:default_sub_item_desc" json:"defaultSubItemDesc"`
	DefaultExpected    string    `gorm:"column:default_expected" json:"defaultExpected"`
	IsEnabled          bool      `gorm:"column:is_enabled" json:"isEnabled"`
	CreatedAt          time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt          time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (ItemType) TableName() string { return "test_item_types" }

// Folder 测试项文件夹：纯容器，限装同一类型测试项，可嵌套。
type Folder struct {
	ID        string    `gorm:"column:id;primaryKey" json:"id"`
	ProjectID string    `gorm:"column:project_id" json:"projectId"`
	TypeCode  string    `gorm:"column:type_code" json:"typeCode"`
	ParentID  *string   `gorm:"column:parent_id" json:"parentId"`
	Name      string    `gorm:"column:name" json:"name"`
	SortOrder int       `gorm:"column:sort_order" json:"sortOrder"`
	CreatedAt time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (Folder) TableName() string { return "test_item_folders" }

// TestItem 项目级测试项逻辑定义（跨轮保持同一标识）。
type TestItem struct {
	ID           string  `gorm:"column:id;primaryKey" json:"id"`
	ProjectID    string  `gorm:"column:project_id" json:"projectId"`
	TypeCode     string  `gorm:"column:type_code" json:"typeCode"`
	Identifier   string  `gorm:"column:identifier" json:"identifier"`
	Suffix       string  `gorm:"column:suffix" json:"suffix"`
	Name         string  `gorm:"column:name" json:"name"`
	Priority     string  `gorm:"column:priority" json:"priority"`
	FolderID     *string `gorm:"column:folder_id" json:"folderId"`
	SortOrder    int     `gorm:"column:sort_order" json:"sortOrder"`
	Description  string  `gorm:"column:description" json:"description"`
	Adequacy     string  `gorm:"column:adequacy" json:"adequacy"`
	PassCriteria string  `gorm:"column:pass_criteria" json:"passCriteria"`
	// ImplicitRequirement 隐含需求：不关联需求时按隐含需求处理，完善度的"追踪关系"按已满足计。
	ImplicitRequirement bool      `gorm:"column:implicit_requirement" json:"implicitRequirement"`
	CreatedAt           time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt           time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (TestItem) TableName() string { return "test_items" }

// SubItem 测试子项：测试方法内容，操作/预期富文本存 content_blocks（block_key = sub_item.{ID}.ops|exp）。
type SubItem struct {
	ID          string `gorm:"column:id;primaryKey" json:"id"`
	TestItemID  string `gorm:"column:test_item_id" json:"testItemId"`
	Seq         int    `gorm:"column:seq" json:"seq"`
	Name        string `gorm:"column:name" json:"name"`
	Description string `gorm:"column:description" json:"description"`
	// Ops 操作步骤、Expected 通过准则：多行纯文本，行数按 1:1 对照（老项目口径）。
	Ops       string    `gorm:"column:ops" json:"ops"`
	Expected  string    `gorm:"column:expected" json:"expected"`
	SortOrder int       `gorm:"column:sort_order" json:"sortOrder"`
	CreatedAt time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (SubItem) TableName() string { return "test_sub_items" }

// Case 用例逻辑定义；操作/实际富文本存 content_blocks（step.{步骤ID}.op|act）。
type Case struct {
	ID            string `gorm:"column:id;primaryKey" json:"id"`
	ProjectID     string `gorm:"column:project_id" json:"projectId"`
	TestItemID    string `gorm:"column:test_item_id" json:"testItemId"`
	Identifier    string `gorm:"column:identifier" json:"identifier"`
	Seq           int    `gorm:"column:seq" json:"seq"`
	Name          string `gorm:"column:name" json:"name"`
	Summary       string `gorm:"column:summary" json:"summary"`
	InitText      string `gorm:"column:init_text" json:"initText"`
	Prerequisites string `gorm:"column:prerequisites" json:"prerequisites"`
	// TerminationText 终止条件、PassCriteria 通过准则：测试说明侧两栏（迁移 0025，切片 5b）。
	TerminationText   string     `gorm:"column:termination_text" json:"terminationText"`
	PassCriteria      string     `gorm:"column:pass_criteria" json:"passCriteria"`
	DesignerID        *string    `gorm:"column:designer_id" json:"designerId"`
	TesterID          *string    `gorm:"column:tester_id" json:"testerId"`
	MonitorID         *string    `gorm:"column:monitor_id" json:"monitorId"`
	ExecDate          *time.Time `gorm:"column:exec_date" json:"execDate"`
	Status            string     `gorm:"column:status" json:"status"`
	Notes             string     `gorm:"column:notes" json:"notes"`
	NotExecutedReason string     `gorm:"column:not_executed_reason" json:"notExecutedReason"`
	SortOrder         int        `gorm:"column:sort_order" json:"sortOrder"`
	CreatedAt         time.Time  `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt         time.Time  `gorm:"column:updated_at" json:"updatedAt"`
}

func (Case) TableName() string { return "test_cases" }

// CaseStep 用例步骤；通过状态三态：none / pass / fail。
type CaseStep struct {
	ID         string    `gorm:"column:id;primaryKey" json:"id"`
	TestCaseID string    `gorm:"column:test_case_id" json:"testCaseId"`
	Seq        int       `gorm:"column:seq" json:"seq"`
	ExpectText string    `gorm:"column:expect_text" json:"expectText"`
	Passed     string    `gorm:"column:passed" json:"passed"`
	SortOrder  int       `gorm:"column:sort_order" json:"sortOrder"`
	CreatedAt  time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt  time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (CaseStep) TableName() string { return "test_case_steps" }

// RequirementLink 需求 ↔ 测试项多对多（静态测试项不建立关联）。
type RequirementLink struct {
	ID            string    `gorm:"column:id;primaryKey" json:"id"`
	ProjectID     string    `gorm:"column:project_id" json:"projectId"`
	RequirementID string    `gorm:"column:requirement_id" json:"requirementId"`
	TestItemID    string    `gorm:"column:test_item_id" json:"testItemId"`
	CreatedAt     time.Time `gorm:"column:created_at" json:"createdAt"`
}

func (RequirementLink) TableName() string { return "requirement_test_items" }

// Round 轮次（第 1 轮新建项目时创建；历史项目首次进入测试项页懒补齐）。
type Round struct {
	ID            string    `gorm:"column:id;primaryKey" json:"id"`
	ProjectID     string    `gorm:"column:project_id" json:"projectId"`
	RoundNumber   int       `gorm:"column:round_number" json:"roundNumber"`
	Name          string    `gorm:"column:name" json:"name"`
	RoundType     string    `gorm:"column:round_type" json:"roundType"`
	Status        string    `gorm:"column:status" json:"status"`
	StartedOn     *string   `gorm:"column:started_on" json:"startedOn"`
	EndedOn       *string   `gorm:"column:ended_on" json:"endedOn"`
	DutVersion    string    `gorm:"column:dut_version" json:"dutVersion"`
	ChangeReason  string    `gorm:"column:change_reason" json:"changeReason"`
	ReasonSummary string    `gorm:"column:reason_summary" json:"reasonSummary"`
	SourceRoundID *string   `gorm:"column:source_round_id" json:"sourceRoundId"`
	CreatedAt     time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt     time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (Round) TableName() string { return "test_rounds" }

// RoundItem 轮次纳入的测试项实例（第一版只写入，范围切片在切片 7 启用）。
type RoundItem struct {
	ID         string    `gorm:"column:id;primaryKey" json:"id"`
	RoundID    string    `gorm:"column:round_id" json:"roundId"`
	TestItemID string    `gorm:"column:test_item_id" json:"testItemId"`
	SourceType string    `gorm:"column:source_type" json:"sourceType"`
	SortOrder  int       `gorm:"column:sort_order" json:"sortOrder"`
	CreatedAt  time.Time `gorm:"column:created_at" json:"createdAt"`
}

func (RoundItem) TableName() string { return "round_test_items" }

// RoundCase 轮次纳入的用例实例。
type RoundCase struct {
	ID         string    `gorm:"column:id;primaryKey" json:"id"`
	RoundID    string    `gorm:"column:round_id" json:"roundId"`
	TestCaseID string    `gorm:"column:test_case_id" json:"testCaseId"`
	SourceType string    `gorm:"column:source_type" json:"sourceType"`
	CreatedAt  time.Time `gorm:"column:created_at" json:"createdAt"`
}

func (RoundCase) TableName() string { return "round_test_cases" }
