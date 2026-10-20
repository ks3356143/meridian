package testitems

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"chenmeridian/internal/id"
)

//go:embed static_catalog.json
var staticCatalogFS embed.FS

var (
	// ErrNotStaticTestItem 当前测试项不是 DC/SA/CR/CW。
	ErrNotStaticTestItem = errors.New("当前测试项不是静态测试项")
	// ErrStaticVersionConflict 静态工作台已被其他窗口更新。
	ErrStaticVersionConflict = errors.New("静态工作台已被其他窗口更新，请刷新后重试")
	// ErrStaticInvalidState 静态工作台提交内容不合法。
	ErrStaticInvalidState = errors.New("静态工作台数据不合法")
)

type StaticDocument struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Version  string `json:"version"`
	Category string `json:"category"`
	Seq      int    `json:"seq"`
}

type StaticCheckTemplate struct {
	Category    string `json:"category"`
	Title       string `json:"title"`
	Requirement string `json:"requirement"`
	Basis       string `json:"basis"`
	Practice    string `json:"practice"`
}

type StaticSheetTemplate struct {
	Code     string                `json:"code"`
	Kind     string                `json:"kind"`
	Name     string                `json:"name"`
	Language string                `json:"language,omitempty"`
	Checks   []StaticCheckTemplate `json:"checks"`
}

type StaticReviewCheck struct {
	ID          string `json:"id"`
	Seq         int    `json:"seq"`
	Category    string `json:"category"`
	Title       string `json:"title"`
	Requirement string `json:"requirement"`
	Basis       string `json:"basis"`
	Practice    string `json:"practice"`
	Result      string `json:"result"`
	Notes       string `json:"notes"`
}

type StaticReviewSheet struct {
	ID                    string              `json:"id"`
	TemplateCode          string              `json:"templateCode"`
	Name                  string              `json:"name"`
	TargetDocumentName    string              `json:"targetDocumentName"`
	TargetDocumentVersion string              `json:"targetDocumentVersion"`
	Checks                []StaticReviewCheck `json:"checks"`
}

type StaticMetrics struct {
	SoftwareName        string   `json:"softwareName"`
	SoftwareVersion     string   `json:"softwareVersion"`
	SoftwareScale       *float64 `json:"softwareScale"`
	CodeLines           *float64 `json:"codeLines"`
	CommentLines        *float64 `json:"commentLines"`
	BlankLines          *float64 `json:"blankLines"`
	ModuleCount         *float64 `json:"moduleCount"`
	AverageSize         *float64 `json:"averageSize"`
	AverageFanout       *float64 `json:"averageFanout"`
	AverageComplexity   *float64 `json:"averageComplexity"`
	MaxComplexity       *float64 `json:"maxComplexity"`
	HighComplexityRatio *float64 `json:"highComplexityRatio"`
	CommentRatio        *float64 `json:"commentRatio"`
}

type StaticRuleViolation struct {
	RuleCode string `json:"ruleCode"`
	Reason   string `json:"reason"`
	Location string `json:"location"`
}

type StaticAnalysisCheck struct {
	ID          string `json:"id"`
	Form        string `json:"form"`
	Seq         int    `json:"seq"`
	Requirement string `json:"requirement"`
	HasIssue    bool   `json:"hasIssue"`
	Problem     string `json:"problem"`
	Location    string `json:"location"`
	IssueID     string `json:"issueId"`
}

type StaticReviewTarget struct {
	ID        string              `json:"id"`
	Language  string              `json:"language"`
	SheetCode string              `json:"sheetCode"`
	Name      string              `json:"name"`
	Checks    []StaticReviewCheck `json:"checks"`
}

type StaticCodeFile struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Lines *int   `json:"lines"`
}

type StaticState struct {
	Documents        []StaticDocument      `json:"documents"`
	ReviewSheets     []StaticReviewSheet   `json:"reviewSheets"`
	Metrics          StaticMetrics         `json:"metrics"`
	MetricConclusion string                `json:"metricConclusion"`
	RuleViolations   []StaticRuleViolation `json:"ruleViolations"`
	AnalysisChecks   []StaticAnalysisCheck `json:"analysisChecks"`
	C3Conclusion     string                `json:"c3Conclusion"`
	C4Conclusion     string                `json:"c4Conclusion"`
	ReviewTargets    []StaticReviewTarget  `json:"reviewTargets"`
	CodeFiles        []StaticCodeFile      `json:"codeFiles"`
}

type StaticRule struct {
	Code        string `json:"code"`
	Description string `json:"description"`
}

type StaticRuleGroup struct {
	Code  string       `json:"code"`
	Name  string       `json:"name"`
	Rules []StaticRule `json:"rules"`
}

type StaticAnalysisRequirement struct {
	Seq         int    `json:"seq"`
	Requirement string `json:"requirement"`
}

type StaticCatalogData struct {
	DocumentOptions  []string                               `json:"documentOptions"`
	ReviewSheets     []StaticSheetTemplate                  `json:"reviewSheets"`
	CodeReviewSheets []StaticSheetTemplate                  `json:"codeReviewSheets"`
	Analysis         map[string][]StaticAnalysisRequirement `json:"analysis"`
	RuleGroups       []StaticRuleGroup                      `json:"ruleGroups"`
}

type StaticCatalog struct {
	DocumentOptions []string                               `json:"documentOptions"`
	ReviewSheets    []StaticSheetTemplate                  `json:"reviewSheets"`
	RuleGroups      []StaticRuleGroup                      `json:"ruleGroups"`
	AnalysisChecks  map[string][]StaticAnalysisRequirement `json:"analysisChecks"`
}

type StaticWorkbench struct {
	TestItemID string        `json:"testItemId"`
	Kind       string        `json:"kind"`
	Version    int64         `json:"version"`
	State      StaticState   `json:"state"`
	Catalog    StaticCatalog `json:"catalog"`
	UpdatedAt  time.Time     `json:"updatedAt"`
}

type staticWorkbenchRow struct {
	TestItemID string    `gorm:"column:test_item_id;primaryKey"`
	ProjectID  string    `gorm:"column:project_id"`
	Kind       string    `gorm:"column:kind"`
	Payload    string    `gorm:"column:payload_json"`
	Version    int64     `gorm:"column:version"`
	CreatedAt  time.Time `gorm:"column:created_at"`
	UpdatedAt  time.Time `gorm:"column:updated_at"`
}

func (staticWorkbenchRow) TableName() string { return "static_test_workbenches" }

var staticCatalogData StaticCatalogData

func init() {
	raw, err := staticCatalogFS.ReadFile("static_catalog.json")
	if err != nil {
		panic(fmt.Sprintf("读取静态测试目录失败: %v", err))
	}
	if err := json.Unmarshal(raw, &staticCatalogData); err != nil {
		panic(fmt.Sprintf("解析静态测试目录失败: %v", err))
	}
}

func catalogFor(kind string) StaticCatalog {
	catalog := StaticCatalog{
		DocumentOptions: staticCatalogData.DocumentOptions,
		RuleGroups:      staticCatalogData.RuleGroups,
		AnalysisChecks:  staticCatalogData.Analysis,
	}
	for _, sheet := range staticCatalogData.ReviewSheets {
		if sheet.Kind == kind {
			catalog.ReviewSheets = append(catalog.ReviewSheets, sheet)
		}
	}
	if kind == "CR" {
		catalog.ReviewSheets = staticCatalogData.CodeReviewSheets
	}
	return catalog
}

func (s *Service) staticItemKind(ctx context.Context, testItemID string) (TestItem, string, error) {
	item, err := s.GetTestItem(ctx, testItemID)
	if err != nil {
		return TestItem{}, "", err
	}
	itemType, err := findItemType(s.db, item.TypeCode)
	if err != nil {
		return TestItem{}, "", err
	}
	if !itemType.IsStatic {
		return TestItem{}, "", ErrNotStaticTestItem
	}
	return item, item.TypeCode, nil
}

// GetStaticWorkbench 读取（必要时初始化）静态测试项专属工作台。
func (s *Service) GetStaticWorkbench(ctx context.Context, testItemID string) (StaticWorkbench, error) {
	item, kind, err := s.staticItemKind(ctx, testItemID)
	if err != nil {
		return StaticWorkbench{}, err
	}
	var row staticWorkbenchRow
	err = s.db.WithContext(ctx).Where("test_item_id = ?", testItemID).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		state, initErr := defaultStaticState(item.ID, kind)
		if initErr != nil {
			return StaticWorkbench{}, initErr
		}
		payload, marshalErr := json.Marshal(state)
		if marshalErr != nil {
			return StaticWorkbench{}, fmt.Errorf("序列化静态工作台失败: %w", marshalErr)
		}
		now := time.Now()
		row = staticWorkbenchRow{
			TestItemID: item.ID,
			ProjectID:  item.ProjectID,
			Kind:       kind,
			Payload:    string(payload),
			Version:    1,
			CreatedAt:  now,
			UpdatedAt:  now,
		}
		if createErr := s.db.WithContext(ctx).Create(&row).Error; createErr != nil {
			return StaticWorkbench{}, fmt.Errorf("初始化静态工作台失败: %w", createErr)
		}
	} else if err != nil {
		return StaticWorkbench{}, fmt.Errorf("查询静态工作台失败: %w", err)
	}

	var state StaticState
	if err := json.Unmarshal([]byte(row.Payload), &state); err != nil {
		return StaticWorkbench{}, fmt.Errorf("解析静态工作台失败: %w", err)
	}
	normalizeStaticState(&state)
	return StaticWorkbench{
		TestItemID: item.ID,
		Kind:       kind,
		Version:    row.Version,
		State:      state,
		Catalog:    catalogFor(kind),
		UpdatedAt:  row.UpdatedAt,
	}, nil
}

// SaveStaticWorkbench 以版本号做乐观并发控制保存静态工作台。
func (s *Service) SaveStaticWorkbench(ctx context.Context, testItemID string, expectedVersion int64, state StaticState) (StaticWorkbench, error) {
	_, kind, err := s.staticItemKind(ctx, testItemID)
	if err != nil {
		return StaticWorkbench{}, err
	}
	normalizeStaticState(&state)
	if err := validateStaticState(kind, state); err != nil {
		return StaticWorkbench{}, err
	}
	payload, err := json.Marshal(state)
	if err != nil {
		return StaticWorkbench{}, fmt.Errorf("序列化静态工作台失败: %w", err)
	}
	now := time.Now()
	result := s.db.WithContext(ctx).Model(&staticWorkbenchRow{}).
		Where("test_item_id = ? AND version = ?", testItemID, expectedVersion).
		Updates(map[string]any{"payload_json": string(payload), "version": expectedVersion + 1, "updated_at": now})
	if result.Error != nil {
		return StaticWorkbench{}, fmt.Errorf("保存静态工作台失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return StaticWorkbench{}, ErrStaticVersionConflict
	}

	return s.GetStaticWorkbench(ctx, testItemID)
}

func normalizeStaticState(state *StaticState) {
	if state.Documents == nil {
		state.Documents = []StaticDocument{}
	}
	if state.ReviewSheets == nil {
		state.ReviewSheets = []StaticReviewSheet{}
	}
	if state.RuleViolations == nil {
		state.RuleViolations = []StaticRuleViolation{}
	}
	if state.AnalysisChecks == nil {
		state.AnalysisChecks = []StaticAnalysisCheck{}
	}
	if state.ReviewTargets == nil {
		state.ReviewTargets = []StaticReviewTarget{}
	}
	if state.CodeFiles == nil {
		state.CodeFiles = []StaticCodeFile{}
	}
}

func validateStaticState(kind string, state StaticState) error {
	for _, sheet := range state.ReviewSheets {
		for _, check := range sheet.Checks {
			if check.Result != "" && check.Result != "unreviewed" && check.Result != "passed" && check.Result != "failed" {
				return ErrStaticInvalidState
			}
		}
	}
	for _, target := range state.ReviewTargets {
		for _, check := range target.Checks {
			if check.Result != "" && check.Result != "unreviewed" && check.Result != "passed" && check.Result != "failed" {
				return ErrStaticInvalidState
			}
		}
	}
	if kind == "SA" {
		for _, check := range state.AnalysisChecks {
			if check.Form != "C3" && check.Form != "C4" {
				return ErrStaticInvalidState
			}
		}
	}
	return nil
}

func defaultStaticState(itemID, kind string) (StaticState, error) {
	state := StaticState{}
	catalog := catalogFor(kind)
	switch kind {
	case "DC":
		for index, name := range catalog.DocumentOptions {
			docID, err := id.New()
			if err != nil {
				return StaticState{}, err
			}
			state.Documents = append(state.Documents, StaticDocument{ID: docID, Name: name, Category: "GJB 438C", Seq: index + 1})
		}
		for _, template := range catalog.ReviewSheets {
			if template.Code == "DC-USER" {
				continue
			}
			sheet, err := newReviewSheet(template)
			if err != nil {
				return StaticState{}, err
			}
			state.ReviewSheets = append(state.ReviewSheets, sheet)
		}
	case "SA":
		for _, form := range []string{"C3", "C4"} {
			for _, requirement := range catalog.AnalysisChecks[form] {
				checkID, err := id.New()
				if err != nil {
					return StaticState{}, err
				}
				state.AnalysisChecks = append(state.AnalysisChecks, StaticAnalysisCheck{
					ID: checkID, Form: form, Seq: requirement.Seq, Requirement: requirement.Requirement,
				})
			}
		}
	case "CW":
		state.CodeFiles = []StaticCodeFile{}
	}
	normalizeStaticState(&state)
	return state, nil
}

func newReviewSheet(template StaticSheetTemplate) (StaticReviewSheet, error) {
	sheetID, err := id.New()
	if err != nil {
		return StaticReviewSheet{}, err
	}
	sheet := StaticReviewSheet{
		ID: sheetID, TemplateCode: template.Code, Name: template.Name,
		Checks: make([]StaticReviewCheck, 0, len(template.Checks)),
	}
	for index, check := range template.Checks {
		checkID, err := id.New()
		if err != nil {
			return StaticReviewSheet{}, err
		}
		sheet.Checks = append(sheet.Checks, StaticReviewCheck{
			ID: checkID, Seq: index + 1, Category: check.Category, Title: check.Title,
			Requirement: check.Requirement, Basis: check.Basis, Practice: check.Practice,
			Result: "unreviewed",
		})
	}
	return sheet, nil
}

// NewReviewSheetFromCatalog 供 API 把模板副本加入 DC/CR 工作台。
func NewReviewSheetFromCatalog(templateCode string) (StaticReviewSheet, error) {
	for _, sheet := range staticCatalogData.ReviewSheets {
		if sheet.Code == templateCode {
			return newReviewSheet(sheet)
		}
	}
	for _, sheet := range staticCatalogData.CodeReviewSheets {
		if sheet.Code == templateCode {
			return newReviewSheet(sheet)
		}
	}
	return StaticReviewSheet{}, ErrStaticInvalidState
}

// NewReviewTarget 从代码审查模板生成一个审查目标（默认未审）。
func NewReviewTarget(language, templateCode string) (StaticReviewTarget, error) {
	sheet, err := NewReviewSheetFromCatalog(templateCode)
	if err != nil {
		return StaticReviewTarget{}, err
	}
	targetID, err := id.New()
	if err != nil {
		return StaticReviewTarget{}, err
	}
	return StaticReviewTarget{
		ID: targetID, Language: language, SheetCode: templateCode, Name: sheet.Name, Checks: sheet.Checks,
	}, nil
}

func staticKindLabel(kind string) string {
	return strings.ToUpper(strings.TrimSpace(kind))
}
