package testitems

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"chenmeridian/internal/id"
)

// ErrReviewTemplateNotFound 审查单模板不存在。
var ErrReviewTemplateNotFound = errors.New("审查单模板不存在")

// ErrReviewTemplateInvalid 审查单模板内容不合法。
var ErrReviewTemplateInvalid = errors.New("审查单模板内容不合法")

// ErrReviewDocumentTypeExists 同一审查文档类型只允许一个模板。
var ErrReviewDocumentTypeExists = errors.New("该审查文档类型已有模板，请编辑原模板切换版本")

// ErrPreviousStaticItemMissing 上一轮没有同类型静态测试项。
var ErrPreviousStaticItemMissing = errors.New("上一轮没有可导入的静态测试项")

type reviewChecklistTemplateRow struct {
	ID              string    `gorm:"column:id;primaryKey"`
	Code            string    `gorm:"column:code"`
	Name            string    `gorm:"column:name"`
	Appendix        string    `gorm:"column:appendix"`
	Condition       string    `gorm:"column:condition"`
	DocumentType    string    `gorm:"column:document_type"`
	DocumentVersion string    `gorm:"column:document_version"`
	SortOrder       int       `gorm:"column:sort_order"`
	ItemsJSON       string    `gorm:"column:items_json"`
	CreatedAt       time.Time `gorm:"column:created_at"`
	UpdatedAt       time.Time `gorm:"column:updated_at"`
}

func (reviewChecklistTemplateRow) TableName() string { return "review_checklist_templates" }

// ReviewChecklistItem 审查单检查项模板。
type ReviewChecklistItem struct {
	Seq          int    `json:"seq"`
	Category     string `json:"category"`
	Title        string `json:"title"`
	Requirement  string `json:"requirement"`
	Basis        string `json:"basis"`
	GoodPractice string `json:"goodPractice"`
	BadPractice  string `json:"badPractice"`
}

// ReviewChecklistTemplate 管理员维护的审查单模板。
type ReviewChecklistTemplate struct {
	ID              string                `json:"id"`
	Code            string                `json:"code"`
	Name            string                `json:"name"`
	Appendix        string                `json:"appendix"`
	Condition       string                `json:"condition"`
	DocumentType    string                `json:"documentType"`
	DocumentVersion string                `json:"documentVersion"`
	SortOrder       int                   `json:"sortOrder"`
	Items           []ReviewChecklistItem `json:"items"`
	CreatedAt       time.Time             `json:"createdAt"`
	UpdatedAt       time.Time             `json:"updatedAt"`
}

// ReviewChecklistTemplateInput 新建/保存模板的入参。
type ReviewChecklistTemplateInput struct {
	Name            string                `json:"name"`
	Appendix        string                `json:"appendix"`
	Condition       string                `json:"condition"`
	DocumentType    string                `json:"documentType"`
	DocumentVersion string                `json:"documentVersion"`
	Items           []ReviewChecklistItem `json:"items"`
}

func (template ReviewChecklistTemplate) sheetTemplate() StaticSheetTemplate {
	checks := make([]StaticCheckTemplate, 0, len(template.Items))
	for _, item := range template.Items {
		checks = append(checks, StaticCheckTemplate{
			Category: item.Category, Title: item.Title, Requirement: item.Requirement,
			Basis: item.Basis, GoodPractice: item.GoodPractice, BadPractice: item.BadPractice,
		})
	}
	return StaticSheetTemplate{
		Code: template.Code, Kind: "DC", Name: template.Name, Appendix: template.Appendix,
		Condition: template.Condition, DocumentType: template.DocumentType,
		DocumentVersion: template.DocumentVersion, SortOrder: template.SortOrder, Checks: checks,
	}
}

// ensureReviewTemplates 表为空时写入内嵌的 4 张内置模板。
func (s *Service) ensureReviewTemplates(ctx context.Context) error {
	var count int64
	if err := s.db.WithContext(ctx).Model(&reviewChecklistTemplateRow{}).Count(&count).Error; err != nil {
		return fmt.Errorf("统计审查单模板失败: %w", err)
	}
	if count > 0 {
		return nil
	}
	now := time.Now()
	for _, sheet := range staticCatalogData.ReviewSheets {
		items := make([]ReviewChecklistItem, 0, len(sheet.Checks))
		for index, check := range sheet.Checks {
			items = append(items, ReviewChecklistItem{
				Seq: index + 1, Category: check.Category, Title: check.Title,
				Requirement: check.Requirement, Basis: check.Basis,
				GoodPractice: check.GoodPractice, BadPractice: check.BadPractice,
			})
		}
		payload, err := json.Marshal(items)
		if err != nil {
			return fmt.Errorf("序列化审查单模板失败: %w", err)
		}
		templateID, err := id.New()
		if err != nil {
			return err
		}
		documentType := strings.TrimSpace(sheet.DocumentType)
		if documentType == "" {
			documentType = legacyDocumentType(sheet.Code)
		}
		row := reviewChecklistTemplateRow{
			ID: templateID, Code: sheet.Code, Name: sheet.Name, Appendix: sheet.Appendix,
			Condition: sheet.Condition, DocumentType: documentType,
			DocumentVersion: sheet.DocumentVersion,
			SortOrder:       sheet.SortOrder, ItemsJSON: string(payload),
			CreatedAt: now, UpdatedAt: now,
		}
		if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
			return fmt.Errorf("初始化审查单模板失败: %w", err)
		}
	}
	return nil
}

// ListReviewChecklistTemplates 返回模板列表（含检查项）。
func (s *Service) ListReviewChecklistTemplates(ctx context.Context) ([]ReviewChecklistTemplate, error) {
	if err := s.ensureReviewTemplates(ctx); err != nil {
		return nil, err
	}
	var rows []reviewChecklistTemplateRow
	if err := s.db.WithContext(ctx).
		Order("sort_order asc, created_at asc").Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("查询审查单模板失败: %w", err)
	}
	templates := make([]ReviewChecklistTemplate, 0, len(rows))
	for _, row := range rows {
		template, err := row.toTemplate()
		if err != nil {
			return nil, err
		}
		// 齐套性不在 UI 中出现，只在 Word 渲染时统一输出全部通过。
		if template.DocumentType == "齐套性" {
			continue
		}
		templates = append(templates, template)
	}
	return templates, nil
}

func (row reviewChecklistTemplateRow) toTemplate() (ReviewChecklistTemplate, error) {
	items := []ReviewChecklistItem{}
	if strings.TrimSpace(row.ItemsJSON) != "" {
		if err := json.Unmarshal([]byte(row.ItemsJSON), &items); err != nil {
			return ReviewChecklistTemplate{}, fmt.Errorf("解析审查单模板检查项失败: %w", err)
		}
	}
	return ReviewChecklistTemplate{
		ID: row.ID, Code: row.Code, Name: row.Name, Appendix: row.Appendix,
		Condition: row.Condition, DocumentType: row.DocumentType,
		DocumentVersion: row.DocumentVersion, SortOrder: row.SortOrder, Items: items,
		CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}, nil
}

// legacyDocumentType 兼容内置模板编码到审查文档类型。
func legacyDocumentType(code string) string {
	switch code {
	case "rc-1":
		return "齐套性"
	case "rc-2":
		return "需求规格说明"
	case "rc-3":
		return "详细设计"
	case "rc-4":
		return "用户手册"
	default:
		return ""
	}
}

// validReviewDocumentType 工作台可配置的五类审查文档；齐套性只在 Word 渲染时默认通过。
func validReviewDocumentType(value string) bool {
	switch value {
	case "需求规格说明", "详细设计", "概要设计", "用户手册", "任务书":
		return true
	default:
		return false
	}
}

// sheetTemplates 返回某静态类型可用的审查单模板；DC 以数据库模板为准。
func (s *Service) sheetTemplates(ctx context.Context, kind string) ([]StaticSheetTemplate, error) {
	if kind != "DC" {
		return catalogFor(kind).ReviewSheets, nil
	}
	templates, err := s.ListReviewChecklistTemplates(ctx)
	if err != nil {
		return nil, err
	}
	sheets := make([]StaticSheetTemplate, 0, len(templates))
	for _, template := range templates {
		sheets = append(sheets, template.sheetTemplate())
	}
	return sheets, nil
}

func (s *Service) reviewDocumentTypeTaken(ctx context.Context, documentType, excludeID string) (bool, error) {
	query := s.db.WithContext(ctx).Model(&reviewChecklistTemplateRow{}).
		Where("document_type = ?", documentType)
	if excludeID != "" {
		query = query.Where("id <> ?", excludeID)
	}
	var count int64
	if err := query.Count(&count).Error; err != nil {
		return false, fmt.Errorf("检查审查文档类型失败: %w", err)
	}
	return count > 0, nil
}

// CreateReviewChecklistTemplate 新建管理员模板。
func (s *Service) CreateReviewChecklistTemplate(ctx context.Context, input ReviewChecklistTemplateInput) (ReviewChecklistTemplate, error) {
	items, err := normalizeReviewItems(input.Items)
	if err != nil {
		return ReviewChecklistTemplate{}, err
	}
	documentType := strings.TrimSpace(input.DocumentType)
	if !validReviewDocumentType(documentType) {
		return ReviewChecklistTemplate{}, ErrReviewTemplateInvalid
	}
	if err := s.ensureReviewTemplates(ctx); err != nil {
		return ReviewChecklistTemplate{}, err
	}
	taken, err := s.reviewDocumentTypeTaken(ctx, documentType, "")
	if err != nil {
		return ReviewChecklistTemplate{}, err
	}
	if taken {
		return ReviewChecklistTemplate{}, ErrReviewDocumentTypeExists
	}
	var maxOrder int
	_ = s.db.WithContext(ctx).Model(&reviewChecklistTemplateRow{}).
		Select("COALESCE(MAX(sort_order), 0)").Scan(&maxOrder).Error
	templateID, err := id.New()
	if err != nil {
		return ReviewChecklistTemplate{}, err
	}
	codeID, err := id.New()
	if err != nil {
		return ReviewChecklistTemplate{}, err
	}
	now := time.Now()
	row := reviewChecklistTemplateRow{
		ID: templateID, Code: "rc-custom-" + strings.ReplaceAll(codeID, "-", ""),
		Name: strings.TrimSpace(input.Name), Appendix: strings.TrimSpace(input.Appendix),
		Condition: strings.TrimSpace(input.Condition), DocumentType: documentType,
		DocumentVersion: strings.TrimSpace(input.DocumentVersion),
		SortOrder:       maxOrder + 1,
		ItemsJSON:       mustMarshal(items), CreatedAt: now, UpdatedAt: now,
	}
	if row.Name == "" {
		return ReviewChecklistTemplate{}, ErrReviewTemplateInvalid
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return ReviewChecklistTemplate{}, fmt.Errorf("新建审查单模板失败: %w", err)
	}
	return row.toTemplate()
}

// UpdateReviewChecklistTemplate 整体保存模板。
func (s *Service) UpdateReviewChecklistTemplate(ctx context.Context, templateID string, input ReviewChecklistTemplateInput) (ReviewChecklistTemplate, error) {
	items, err := normalizeReviewItems(input.Items)
	if err != nil {
		return ReviewChecklistTemplate{}, err
	}
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return ReviewChecklistTemplate{}, ErrReviewTemplateInvalid
	}
	documentType := strings.TrimSpace(input.DocumentType)
	if !validReviewDocumentType(documentType) {
		return ReviewChecklistTemplate{}, ErrReviewTemplateInvalid
	}
	var row reviewChecklistTemplateRow
	if err := s.db.WithContext(ctx).Where("id = ?", templateID).First(&row).Error; errors.Is(err, gorm.ErrRecordNotFound) {
		return ReviewChecklistTemplate{}, ErrReviewTemplateNotFound
	} else if err != nil {
		return ReviewChecklistTemplate{}, fmt.Errorf("查询审查单模板失败: %w", err)
	}
	taken, err := s.reviewDocumentTypeTaken(ctx, documentType, templateID)
	if err != nil {
		return ReviewChecklistTemplate{}, err
	}
	if taken {
		return ReviewChecklistTemplate{}, ErrReviewDocumentTypeExists
	}
	row.Name = name
	row.Appendix = strings.TrimSpace(input.Appendix)
	row.Condition = strings.TrimSpace(input.Condition)
	row.DocumentType = documentType
	row.DocumentVersion = strings.TrimSpace(input.DocumentVersion)
	row.ItemsJSON = mustMarshal(items)
	row.UpdatedAt = time.Now()
	if err := s.db.WithContext(ctx).Save(&row).Error; err != nil {
		return ReviewChecklistTemplate{}, fmt.Errorf("保存审查单模板失败: %w", err)
	}
	return row.toTemplate()
}

// DeleteReviewChecklistTemplate 删除模板；已绑定审查单是快照，不受影响。
func (s *Service) DeleteReviewChecklistTemplate(ctx context.Context, templateID string) error {
	result := s.db.WithContext(ctx).Where("id = ?", templateID).Delete(&reviewChecklistTemplateRow{})
	if result.Error != nil {
		return fmt.Errorf("删除审查单模板失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrReviewTemplateNotFound
	}
	return nil
}

func normalizeReviewItems(items []ReviewChecklistItem) ([]ReviewChecklistItem, error) {
	normalized := make([]ReviewChecklistItem, 0, len(items))
	for index, item := range items {
		title := strings.TrimSpace(item.Title)
		if title == "" {
			return nil, ErrReviewTemplateInvalid
		}
		normalized = append(normalized, ReviewChecklistItem{
			Seq: index + 1, Category: strings.TrimSpace(item.Category), Title: title,
			Requirement: strings.TrimSpace(item.Requirement), Basis: strings.TrimSpace(item.Basis),
			GoodPractice: item.GoodPractice, BadPractice: item.BadPractice,
		})
	}
	if len(normalized) == 0 {
		return nil, ErrReviewTemplateInvalid
	}
	return normalized, nil
}

func mustMarshal(value any) string {
	raw, err := json.Marshal(value)
	if err != nil {
		return "[]"
	}
	return string(raw)
}

func (s *Service) projectPlatform(ctx context.Context, projectID string) (string, error) {
	var platform string
	if err := s.db.WithContext(ctx).Table("projects").
		Select("platform").Where("id = ?", projectID).Scan(&platform).Error; err != nil {
		return "", fmt.Errorf("查询项目平台失败: %w", err)
	}
	return strings.TrimSpace(platform), nil
}

func documentsForPlatform(platform string) []string {
	key := strings.ToLower(strings.TrimSpace(platform))
	switch key {
	case "fpga":
		key = "fpga"
	case "desktop", "桌面":
		key = "desktop"
	default:
		key = "cpu"
	}
	docs := make([]string, 0, len(staticCatalogData.DocumentOptions))
	for _, name := range staticCatalogData.DocumentOptions {
		flags, ok := staticCatalogData.DocumentPlatforms[name]
		if !ok || flags[key] {
			docs = append(docs, name)
		}
	}
	return docs
}
