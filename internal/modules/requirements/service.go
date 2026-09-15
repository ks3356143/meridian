package requirements

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"

	"chenmeridian/internal/id"
)

const (
	KindFunctional   = "functional"
	KindPerformance  = "performance"
	KindInterface    = "interface"
	KindSafety       = "safety"
	KindReliability  = "reliability"
	KindOther        = "other"
	StatusCandidate  = "candidate"
	StatusOfficial   = "official"
	StatusExcluded   = "excluded"
	StatusSuperseded = "superseded"
	OriginManual     = "manual"
	OriginParsed     = "parsed"
)

var (
	ErrProjectNotFound      = errors.New("项目不存在")
	ErrSourceNotFound       = errors.New("可解析的软件需求规格说明不存在")
	ErrNoSourceFile         = errors.New("该 SRS 没有电子文件")
	ErrNeedsDocx            = errors.New("当前 SRS 为 .doc，需要先转换为 .docx 后解析")
	ErrSectionNotFound      = errors.New("需求章节不存在")
	ErrParentMissing        = errors.New("父章节不存在")
	ErrChapterInvalid       = errors.New("章节号格式不正确")
	ErrSectionExists        = errors.New("同一 SRS 版本中章节号已存在")
	ErrRequirementExists    = errors.New("同一 SRS 版本中有效需求章节号已存在")
	ErrRequirementNotFound  = errors.New("软件需求不存在")
	ErrRequirementNotActive = errors.New("候选或正式需求才允许修改")
	ErrNoChanges            = errors.New("没有需要修改的需求信息")
	ErrNoRequirements       = errors.New("没有可操作的需求")
	ErrReasonRequired       = errors.New("排除需求必须填写原因")
	ErrInvalidKind          = errors.New("主需求性质不正确")
)

type Service struct {
	db   *gorm.DB
	root string
}

func NewService(db *gorm.DB, assetRoot string) *Service {
	return &Service{db: db, root: assetRoot}
}

type SourceRow struct {
	ID           string `gorm:"column:id"`
	ProjectID    string `gorm:"column:project_id"`
	ObjectName   string `gorm:"column:object_name"`
	Version      string `gorm:"column:version"`
	FileType     string `gorm:"column:file_type"`
	StoragePath  string `gorm:"column:storage_path"`
	OriginalName string `gorm:"column:original_name"`
	UpdatedAt    time.Time
}

type SourceResponse struct {
	ID           string `json:"id"`
	ObjectName   string `json:"objectName"`
	Version      string `json:"version"`
	FileType     string `json:"fileType"`
	OriginalName string `json:"originalName"`
	HasLocalFile bool   `json:"hasLocalFile"`
	ParseState   string `json:"parseState"`
	UpdatedAt    string `json:"updatedAt"`
}

type SectionResponse struct {
	ID              string `json:"id"`
	ParentID        string `json:"parentId"`
	SourceVersionID string `json:"sourceVersionId"`
	ChapterNumber   string `json:"chapterNumber"`
	Title           string `json:"title"`
	Origin          string `json:"origin"`
	SourceAnchor    string `json:"sourceAnchor"`
	CreatedAt       string `json:"createdAt"`
	UpdatedAt       string `json:"updatedAt"`
}

type RequirementResponse struct {
	ID                 string   `json:"id"`
	SourceVersionID    string   `json:"sourceVersionId"`
	SectionID          string   `json:"sectionId"`
	ChapterNumber      string   `json:"chapterNumber"`
	ExternalIdentifier string   `json:"externalIdentifier"`
	Name               string   `json:"name"`
	Description        string   `json:"description"`
	PrimaryKind        string   `json:"primaryKind"`
	Tags               []string `json:"tags"`
	Origin             string   `json:"origin"`
	SourceAnchor       string   `json:"sourceAnchor"`
	Status             string   `json:"status"`
	TestItemTaskStatus string   `json:"testItemTaskStatus"`
	CreatedAt          string   `json:"createdAt"`
	UpdatedAt          string   `json:"updatedAt"`
}

type WorkbenchResponse struct {
	Sources      []SourceResponse      `json:"sources"`
	Sections     []SectionResponse     `json:"sections"`
	Requirements []RequirementResponse `json:"requirements"`
}

type ParseResult struct {
	SectionCount       int `json:"sectionCount"`
	CandidateCount     int `json:"candidateCount"`
	OfficialMatchCount int `json:"officialMatchCount"`
	ExcludedMatchCount int `json:"excludedMatchCount"`
}

type CreateSectionInput struct {
	ProjectCode     string
	SourceVersionID string
	ParentID        string
	ChapterNumber   string
	Title           string
	OperatedBy      string
}

type CreateRequirementInput struct {
	ProjectCode        string
	SourceVersionID    string
	SectionID          string
	ChapterNumber      string
	ExternalIdentifier string
	Name               string
	Description        string
	PrimaryKind        string
	Tags               []string
	OperatedBy         string
}

type UpdateRequirementInput struct {
	ID                 string
	SectionID          string
	ChapterNumber      string
	ExternalIdentifier string
	Name               string
	Description        string
	PrimaryKind        string
	Tags               []string
	OperatedBy         string
}

type BulkItem struct {
	NodeType      string `json:"nodeType"`
	ChapterNumber string `json:"chapterNumber"`
	Title         string `json:"title,omitempty"`
	Name          string `json:"name,omitempty"`
	Description   string `json:"description,omitempty"`
	PrimaryKind   string `json:"primaryKind,omitempty"`
}

type BulkCreateInput struct {
	ProjectCode     string
	SourceVersionID string
	Items           []BulkItem
	OperatedBy      string
}

type BulkCreateResult struct {
	SectionCount     int `json:"sectionCount"`
	RequirementCount int `json:"requirementCount"`
}

type StatusActionInput struct {
	ProjectCode string
	IDs         []string
	Action      string
	Reason      string
	OperatedBy  string
}

type StatusActionResult struct {
	UpdatedCount int `json:"updatedCount"`
}

func (s *Service) Workbench(ctx context.Context, projectCode string, sourceVersionID string) (WorkbenchResponse, error) {
	projectID, err := s.findProject(ctx, projectCode)
	if err != nil {
		return WorkbenchResponse{}, err
	}

	sources, err := s.listSources(ctx, projectID)
	if err != nil {
		return WorkbenchResponse{}, err
	}
	selectedSource := sourceVersionID
	if selectedSource == "" && len(sources) > 0 {
		selectedSource = sources[0].ID
	}
	sourceValid := false
	for _, source := range sources {
		if source.ID == selectedSource {
			sourceValid = true
			break
		}
	}
	if selectedSource != "" && !sourceValid {
		return WorkbenchResponse{}, ErrSourceNotFound
	}

	var sections []Section
	sectionQuery := s.db.WithContext(ctx).Where("project_id = ?", projectID)
	if selectedSource != "" {
		sectionQuery = sectionQuery.Where("source_version_id = ?", selectedSource)
	}
	if err := sectionQuery.Find(&sections).Error; err != nil {
		return WorkbenchResponse{}, fmt.Errorf("查询需求章节失败: %w", err)
	}
	sortSections(sections)

	var requirements []Requirement
	requirementQuery := s.db.WithContext(ctx).Where("project_id = ?", projectID)
	if selectedSource != "" {
		requirementQuery = requirementQuery.Where("source_version_id = ?", selectedSource)
	}
	if err := requirementQuery.Find(&requirements).Error; err != nil {
		return WorkbenchResponse{}, fmt.Errorf("查询软件需求失败: %w", err)
	}
	sortRequirements(requirements)

	return WorkbenchResponse{
		Sources:      toSourceResponses(sources),
		Sections:     toSectionResponses(sections),
		Requirements: toRequirementResponses(requirements),
	}, nil
}

func (s *Service) CreateSection(ctx context.Context, input CreateSectionInput) (SectionResponse, error) {
	source, err := s.findSource(ctx, input.ProjectCode, input.SourceVersionID)
	if err != nil {
		return SectionResponse{}, err
	}
	chapter, title, err := validateSection(input.ChapterNumber, input.Title)
	if err != nil {
		return SectionResponse{}, err
	}

	var created Section
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		parentID, parentErr := resolveParentID(tx, source, input.ParentID, chapter)
		if parentErr != nil {
			return parentErr
		}
		section, createErr := createSectionInTx(tx, source.ProjectID, source.ID, parentID, chapter, title, OriginManual, "", input.OperatedBy)
		if createErr != nil {
			return createErr
		}
		created = section
		return nil
	})
	if err != nil {
		return SectionResponse{}, err
	}
	return toSectionResponse(created), nil
}

func (s *Service) CreateRequirement(ctx context.Context, input CreateRequirementInput) (RequirementResponse, error) {
	source, err := s.findSource(ctx, input.ProjectCode, input.SourceVersionID)
	if err != nil {
		return RequirementResponse{}, err
	}
	if err := validatePrimaryKind(input.PrimaryKind); err != nil {
		return RequirementResponse{}, err
	}
	chapter, name, description, err := validateRequirement(input.ChapterNumber, input.Name, input.Description)
	if err != nil {
		return RequirementResponse{}, err
	}

	var created Requirement
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		requirement, createErr := createRequirementInTx(tx, source, input.SectionID, chapter,
			strings.TrimSpace(input.ExternalIdentifier), name, description, input.PrimaryKind,
			normalizeTags(input.Tags), OriginManual, "", StatusOfficial, input.OperatedBy)
		if createErr != nil {
			return createErr
		}
		created = requirement
		return nil
	})
	if err != nil {
		return RequirementResponse{}, err
	}
	return toRequirementResponse(created), nil
}

func (s *Service) BulkCreate(ctx context.Context, input BulkCreateInput) (BulkCreateResult, error) {
	if len(input.Items) == 0 {
		return BulkCreateResult{}, fmt.Errorf("批量录入内容不能为空")
	}
	if len(input.Items) > 1000 {
		return BulkCreateResult{}, fmt.Errorf("单次最多批量录入 1000 行")
	}
	source, err := s.findSource(ctx, input.ProjectCode, input.SourceVersionID)
	if err != nil {
		return BulkCreateResult{}, err
	}

	result := BulkCreateResult{}
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, item := range input.Items {
			nodeType := strings.TrimSpace(item.NodeType)
			if nodeType == "section" {
				chapter, title, validateErr := validateSection(item.ChapterNumber, item.Title)
				if validateErr != nil {
					return validateErr
				}
				parentID, parentErr := resolveParentID(tx, source, "", chapter)
				if parentErr != nil {
					return parentErr
				}
				if _, createErr := createSectionInTx(tx, source.ProjectID, source.ID, parentID,
					chapter, title, OriginManual, "", input.OperatedBy); createErr != nil {
					return createErr
				}
				result.SectionCount++
				continue
			}

			kind := strings.TrimSpace(item.PrimaryKind)
			if kind == "" {
				kind = KindFunctional
			}
			if validateErr := validatePrimaryKind(kind); validateErr != nil {
				return validateErr
			}
			chapter, name, description, validateErr := validateBulkRequirement(
				item.ChapterNumber, item.Name, item.Description,
			)
			if validateErr != nil {
				return validateErr
			}
			if _, createErr := createRequirementInTx(tx, source, "", chapter, "", name,
				description, kind, normalizeTags(nil), OriginManual, "", StatusOfficial, input.OperatedBy); createErr != nil {
				return createErr
			}
			result.RequirementCount++
		}
		return nil
	})
	if err != nil {
		return BulkCreateResult{}, err
	}
	return result, nil
}

func (s *Service) UpdateRequirement(ctx context.Context, input UpdateRequirementInput) (RequirementResponse, error) {
	var current Requirement
	if err := s.db.WithContext(ctx).Where("id = ?", input.ID).First(&current).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return RequirementResponse{}, ErrRequirementNotFound
		}
		return RequirementResponse{}, fmt.Errorf("查询软件需求失败: %w", err)
	}
	if current.Status != StatusCandidate && current.Status != StatusOfficial {
		return RequirementResponse{}, ErrRequirementNotActive
	}
	if err := validatePrimaryKind(input.PrimaryKind); err != nil {
		return RequirementResponse{}, err
	}
	chapter, name, description, err := validateRequirement(input.ChapterNumber, input.Name, input.Description)
	if err != nil {
		return RequirementResponse{}, err
	}
	tags := normalizeTags(input.Tags)
	externalID := strings.TrimSpace(input.ExternalIdentifier)
	if current.ChapterNumber == chapter && current.Name == name &&
		current.Description == description && current.PrimaryKind == input.PrimaryKind &&
		strings.Join(parseTags(current.Tags), ",") == strings.Join(tags, ",") &&
		current.ExternalIdentifier == externalID {
		return RequirementResponse{}, ErrNoChanges
	}

	sectionID := current.SectionID
	var section Section
	if err := s.db.WithContext(ctx).Where("id = ?", dereference(sectionID)).First(&section).Error; err == nil {
		if section.ChapterNumber != chapter {
			var nextSection Section
			nextErr := s.db.WithContext(ctx).
				Where("source_version_id = ? AND chapter_number = ?", current.SourceVersionID, chapter).
				First(&nextSection).Error
			if nextErr != nil {
				return RequirementResponse{}, ErrSectionNotFound
			}
			sectionID = &nextSection.ID
		}
	} else {
		return RequirementResponse{}, ErrSectionNotFound
	}

	now := time.Now()
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var count int64
		if countErr := tx.Model(&Requirement{}).
			Where("source_version_id = ? AND chapter_number = ? AND id <> ? AND status IN (?, ?)",
				current.SourceVersionID, chapter, current.ID, StatusCandidate, StatusOfficial).
			Count(&count).Error; countErr != nil {
			return fmt.Errorf("检查需求章节冲突失败: %w", countErr)
		}
		if count > 0 {
			return ErrRequirementExists
		}
		if updateErr := tx.Model(&Requirement{}).Where("id = ?", current.ID).Updates(map[string]any{
			"section_id":          sectionID,
			"chapter_number":      chapter,
			"external_identifier": externalID,
			"name":                name,
			"description":         description,
			"primary_kind":        input.PrimaryKind,
			"tags":                marshalTags(tags),
			"updated_at":          now,
		}).Error; updateErr != nil {
			return fmt.Errorf("更新软件需求失败: %w", updateErr)
		}
		nextTestTaskStatus := current.TestItemTaskStatus
		if current.Status == StatusOfficial {
			if current.TestItemTaskStatus == "none" && strings.TrimSpace(description) != "" {
				nextTestTaskStatus = "pending"
			}
			if current.TestItemTaskStatus == "pending" && strings.TrimSpace(description) == "" {
				nextTestTaskStatus = "none"
			}
		}
		if nextTestTaskStatus != current.TestItemTaskStatus {
			if taskErr := tx.Model(&Requirement{}).Where("id = ?", current.ID).
				Update("test_item_task_status", nextTestTaskStatus).Error; taskErr != nil {
				return fmt.Errorf("更新测试项任务状态失败: %w", taskErr)
			}
		}
		return createEvent(tx, current.ProjectID, current.ID, "update", current.Status, current.Status,
			"修改需求登记信息", input.OperatedBy, now)
	})
	if err != nil {
		return RequirementResponse{}, err
	}

	var updated Requirement
	if err := s.db.WithContext(ctx).Where("id = ?", current.ID).First(&updated).Error; err != nil {
		return RequirementResponse{}, fmt.Errorf("查询更新后的需求失败: %w", err)
	}
	return toRequirementResponse(updated), nil
}

func (s *Service) ChangeStatus(ctx context.Context, input StatusActionInput) (StatusActionResult, error) {
	if len(input.IDs) == 0 {
		return StatusActionResult{}, ErrNoRequirements
	}
	action := strings.TrimSpace(input.Action)
	if action != "confirm" && action != "exclude" {
		return StatusActionResult{}, fmt.Errorf("不支持的需求状态操作")
	}
	reason := strings.TrimSpace(input.Reason)
	if action == "exclude" && reason == "" {
		return StatusActionResult{}, ErrReasonRequired
	}

	result := StatusActionResult{}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, requirementID := range input.IDs {
			var current Requirement
			if err := tx.Where("id = ?", requirementID).First(&current).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return ErrRequirementNotFound
				}
				return fmt.Errorf("查询软件需求失败: %w", err)
			}
			if action == "confirm" {
				if current.Status != StatusCandidate {
					continue
				}
				now := time.Now()
				if err := tx.Model(&Requirement{}).Where("id = ?", current.ID).Updates(map[string]any{
					"status":                StatusOfficial,
					"test_item_task_status": "pending",
					"updated_at":            now,
				}).Error; err != nil {
					return fmt.Errorf("确认软件需求失败: %w", err)
				}
				if err := createEvent(tx, current.ProjectID, current.ID, "confirm", StatusCandidate, StatusOfficial,
					"确认候选需求为正式需求", input.OperatedBy, now); err != nil {
					return err
				}
				result.UpdatedCount++
				continue
			}

			if current.Status != StatusCandidate && current.Status != StatusOfficial {
				continue
			}
			now := time.Now()
			if err := tx.Model(&Requirement{}).Where("id = ?", current.ID).Updates(map[string]any{
				"status":     StatusExcluded,
				"updated_at": now,
			}).Error; err != nil {
				return fmt.Errorf("排除软件需求失败: %w", err)
			}
			if err := createEvent(tx, current.ProjectID, current.ID, "exclude", current.Status, StatusExcluded,
				reason, input.OperatedBy, now); err != nil {
				return err
			}
			result.UpdatedCount++
		}
		if result.UpdatedCount == 0 {
			return ErrNoRequirements
		}
		return nil
	})
	if err != nil {
		return StatusActionResult{}, err
	}
	return result, nil
}

func (s *Service) Parse(ctx context.Context, projectCode string, sourceVersionID string, operatedBy string) (ParseResult, error) {
	source, err := s.findSource(ctx, projectCode, sourceVersionID)
	if err != nil {
		return ParseResult{}, err
	}
	if source.StoragePath == "" {
		return ParseResult{}, ErrNoSourceFile
	}
	if !hasDocxExtension(source.StoragePath) {
		return ParseResult{}, ErrNeedsDocx
	}
	parsed, err := ParseDOCX(filepath.Join(s.root, filepath.FromSlash(source.StoragePath)))
	if err != nil {
		return ParseResult{}, err
	}

	result := ParseResult{}
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("source_version_id = ? AND status = ?", source.ID, StatusCandidate).
			Delete(&Requirement{}).Error; err != nil {
			return fmt.Errorf("清理旧候选需求失败: %w", err)
		}

		sectionsByChapter := make(map[string]Section)
		var existingSections []Section
		if err := tx.Where("source_version_id = ?", source.ID).Find(&existingSections).Error; err != nil {
			return fmt.Errorf("查询已有章节失败: %w", err)
		}
		for _, section := range existingSections {
			sectionsByChapter[section.ChapterNumber] = section
		}

		now := time.Now()
		for _, node := range parsed {
			parentID := new(string)
			if node.ParentChapter == "" {
				parentID = nil
			} else {
				parent, ok := sectionsByChapter[node.ParentChapter]
				if !ok {
					return fmt.Errorf("解析出的章节 %s 缺少父章节 %s", node.ChapterNumber, node.ParentChapter)
				}
				*parentID = parent.ID
			}

			section, ok := sectionsByChapter[node.ChapterNumber]
			if ok {
				section.ParentID = parentID
				section.Title = node.Title
				section.SourceAnchor = node.SourceAnchor
				section.UpdatedAt = now
				if err := tx.Model(&Section{}).Where("id = ?", section.ID).Updates(map[string]any{
					"parent_id":     section.ParentID,
					"title":         section.Title,
					"source_anchor": section.SourceAnchor,
					"origin":        OriginParsed,
					"updated_at":    section.UpdatedAt,
				}).Error; err != nil {
					return fmt.Errorf("同步解析章节失败: %w", err)
				}
			} else {
				newSection, createErr := createSectionInTx(tx, source.ProjectID, source.ID, parentID,
					node.ChapterNumber, node.Title, OriginParsed, node.SourceAnchor, operatedBy)
				if createErr != nil {
					return createErr
				}
				section = newSection
			}
			sectionsByChapter[node.ChapterNumber] = section
			result.SectionCount++

			if !node.IsRequirement {
				continue
			}

			var existing Requirement
			err := tx.Where("source_version_id = ? AND chapter_number = ?", source.ID, node.ChapterNumber).
				First(&existing).Error
			if err == nil {
				if existing.Status == StatusOfficial {
					result.OfficialMatchCount++
					continue
				}
				if existing.Status == StatusExcluded || existing.Status == StatusSuperseded {
					result.ExcludedMatchCount++
					continue
				}
				if updateErr := tx.Model(&Requirement{}).Where("id = ?", existing.ID).Updates(map[string]any{
					"section_id":    section.ID,
					"name":          node.Title,
					"description":   node.Description,
					"primary_kind":  node.PrimaryKind,
					"source_anchor": node.SourceAnchor,
					"origin":        OriginParsed,
					"updated_at":    now,
				}).Error; updateErr != nil {
					return fmt.Errorf("更新候选需求失败: %w", updateErr)
				}
				result.CandidateCount++
				continue
			}
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("查询同章节需求失败: %w", err)
			}

			created, createErr := createRequirementInTx(tx, source, section.ID, node.ChapterNumber, "",
				node.Title, node.Description, node.PrimaryKind, []string{}, OriginParsed,
				node.SourceAnchor, StatusCandidate, operatedBy)
			if createErr != nil {
				return createErr
			}
			if eventErr := createEvent(tx, source.ProjectID, created.ID, "parse", "", StatusCandidate,
				"自动解析生成候选需求", operatedBy, now); eventErr != nil {
				return eventErr
			}
			result.CandidateCount++
		}
		return nil
	})
	if err != nil {
		return ParseResult{}, err
	}
	return result, nil
}

func (s *Service) findProject(ctx context.Context, projectCode string) (string, error) {
	var project struct {
		ID string `gorm:"column:id"`
	}
	err := s.db.WithContext(ctx).
		Table("projects").
		Select("id").
		Where("code = ?", strings.ToUpper(strings.TrimSpace(projectCode))).
		Scan(&project).Error
	if err != nil {
		return "", fmt.Errorf("查询项目失败: %w", err)
	}
	if project.ID == "" {
		return "", ErrProjectNotFound
	}
	return project.ID, nil
}

func (s *Service) listSources(ctx context.Context, projectID string) ([]SourceRow, error) {
	var rows []SourceRow
	err := s.db.WithContext(ctx).
		Table("work_object_versions AS v").
		Select(`
			v.id, v.project_id, v.version, v.updated_at,
			w.name AS object_name,
			COALESCE(a.file_type, '') AS file_type,
			COALESCE(a.storage_path, '') AS storage_path,
			COALESCE(a.original_name, '') AS original_name
		`).
		Joins("JOIN work_objects AS w ON w.id = v.work_object_id").
		Joins("LEFT JOIN received_assets AS a ON a.work_object_version_id = v.id").
		Where("v.project_id = ? AND v.status = ? AND w.object_kind = ?", projectID, "confirmed", "srs").
		Order("v.updated_at DESC").
		Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("查询可解析 SRS 失败: %w", err)
	}
	return rows, nil
}

func (s *Service) findSource(ctx context.Context, projectCode string, sourceVersionID string) (SourceRow, error) {
	projectID, err := s.findProject(ctx, projectCode)
	if err != nil {
		return SourceRow{}, err
	}
	sources, err := s.listSources(ctx, projectID)
	if err != nil {
		return SourceRow{}, err
	}
	for _, source := range sources {
		if source.ID == sourceVersionID {
			return source, nil
		}
	}
	return SourceRow{}, ErrSourceNotFound
}

func ensureParentChain(tx *gorm.DB, source SourceRow, chapter string, origin string, operatedBy string) (*string, error) {
	parentChapterNum := parentChapter(chapter)
	if parentChapterNum == "" {
		return nil, nil
	}

	parts := strings.Split(parentChapterNum, ".")
	chain := make([]string, 0, len(parts))
	for i := range parts {
		chain = append(chain, strings.Join(parts[:i+1], "."))
	}

	var parentID *string
	for _, chainChapter := range chain {
		section, err := findSectionByChapter(tx, source.ID, chainChapter)
		if err == nil {
			parentID = &section.ID
			continue
		}
		if !errors.Is(err, ErrParentMissing) {
			return nil, err
		}
		created, createErr := createSectionInTx(tx, source.ProjectID, source.ID, parentID, chainChapter, chainChapter, origin, "", operatedBy)
		if createErr != nil {
			return nil, createErr
		}
		parentID = &created.ID
	}
	return parentID, nil
}

func resolveParentID(tx *gorm.DB, source SourceRow, parentID string, chapter string) (*string, error) {
	expectedParentChapter := parentChapter(chapter)
	if expectedParentChapter == "" {
		return nil, nil
	}
	if strings.TrimSpace(parentID) != "" {
		var parent Section
		if err := tx.Where("id = ? AND source_version_id = ?", parentID, source.ID).
			First(&parent).Error; err != nil {
			return nil, ErrParentMissing
		}
		if parent.ChapterNumber != expectedParentChapter {
			return nil, ErrParentMissing
		}
		return &parent.ID, nil
	}
	return ensureParentChain(tx, source, chapter, OriginManual, "system")
}

func findSectionByChapter(tx *gorm.DB, sourceVersionID string, chapter string) (Section, error) {
	var section Section
	err := tx.Where("source_version_id = ? AND chapter_number = ?", sourceVersionID, chapter).
		First(&section).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Section{}, ErrParentMissing
	}
	if err != nil {
		return Section{}, fmt.Errorf("查询父章节失败: %w", err)
	}
	return section, nil
}

func createSectionInTx(
	tx *gorm.DB,
	projectID string,
	sourceVersionID string,
	parentID *string,
	chapter string,
	title string,
	origin string,
	sourceAnchor string,
	operatedBy string,
) (Section, error) {
	var count int64
	if err := tx.Model(&Section{}).
		Where("source_version_id = ? AND chapter_number = ?", sourceVersionID, chapter).
		Count(&count).Error; err != nil {
		return Section{}, fmt.Errorf("检查章节冲突失败: %w", err)
	}
	if count > 0 {
		return Section{}, ErrSectionExists
	}
	sectionID, err := id.New()
	if err != nil {
		return Section{}, err
	}
	now := time.Now()
	section := Section{
		ID: sectionID, ProjectID: projectID, SourceVersionID: sourceVersionID, ParentID: parentID,
		ChapterNumber: chapter, Title: title, Origin: origin, SourceAnchor: sourceAnchor,
		CreatedBy: operatedBy, CreatedAt: now, UpdatedAt: now,
	}
	if err := tx.Create(&section).Error; err != nil {
		return Section{}, fmt.Errorf("保存需求章节失败: %w", err)
	}
	return section, nil
}

func createRequirementInTx(
	tx *gorm.DB,
	source SourceRow,
	requestSectionID string,
	chapter string,
	externalID string,
	name string,
	description string,
	primaryKind string,
	tags []string,
	origin string,
	sourceAnchor string,
	status string,
	operatedBy string,
) (Requirement, error) {
	section, sectionErr := resolveOrCreateRequirementSection(
		tx, source, requestSectionID, chapter, name, origin, sourceAnchor, operatedBy,
	)
	if sectionErr != nil {
		return Requirement{}, sectionErr
	}

	var count int64
	if err := tx.Model(&Requirement{}).
		Where("source_version_id = ? AND chapter_number = ? AND status IN (?, ?)",
			source.ID, chapter, StatusCandidate, StatusOfficial).
		Count(&count).Error; err != nil {
		return Requirement{}, fmt.Errorf("检查需求冲突失败: %w", err)
	}
	if count > 0 {
		return Requirement{}, ErrRequirementExists
	}

	requirementID, err := id.New()
	if err != nil {
		return Requirement{}, err
	}
	now := time.Now()
	testTaskStatus := "none"
	if status == StatusOfficial && strings.TrimSpace(description) != "" {
		testTaskStatus = "pending"
	}
	requirement := Requirement{
		ID: requirementID, ProjectID: source.ProjectID, SourceVersionID: source.ID,
		SectionID: &section.ID, ChapterNumber: chapter, ExternalIdentifier: externalID,
		Name: name, Description: description, PrimaryKind: primaryKind,
		Tags: marshalTags(tags), Origin: origin, SourceAnchor: sourceAnchor,
		Status: status, TestItemTaskStatus: testTaskStatus, CreatedBy: operatedBy,
		CreatedAt: now, UpdatedAt: now,
	}
	if err := tx.Create(&requirement).Error; err != nil {
		return Requirement{}, fmt.Errorf("保存软件需求失败: %w", err)
	}
	if err := createEvent(tx, source.ProjectID, requirement.ID, "create", "", status,
		"创建"+originLabel(origin)+"需求", operatedBy, now); err != nil {
		return Requirement{}, err
	}
	return requirement, nil
}

func resolveOrCreateRequirementSection(
	tx *gorm.DB,
	source SourceRow,
	requestSectionID string,
	chapter string,
	name string,
	origin string,
	sourceAnchor string,
	operatedBy string,
) (Section, error) {
	expectedParent := parentChapter(chapter)
	var parentID *string

	if strings.TrimSpace(requestSectionID) != "" {
		var requested Section
		if err := tx.Where("id = ? AND source_version_id = ?", requestSectionID, source.ID).
			First(&requested).Error; err != nil {
			return Section{}, ErrSectionNotFound
		}
		if requested.ChapterNumber == chapter {
			return requested, nil
		}
		if expectedParent == "" || requested.ChapterNumber != expectedParent {
			return Section{}, ErrSectionNotFound
		}
		parentID = &requested.ID
	} else if expectedParent != "" {
		parent, err := ensureParentChain(tx, source, chapter, origin, operatedBy)
		if err != nil {
			return Section{}, err
		}
		parentID = parent
	}

	if existing, err := findSectionByChapter(tx, source.ID, chapter); err == nil {
		return existing, nil
	} else if !errors.Is(err, ErrParentMissing) {
		return Section{}, err
	}
	return createSectionInTx(
		tx, source.ProjectID, source.ID, parentID, chapter, name, origin, sourceAnchor, operatedBy,
	)
}

func createEvent(
	tx *gorm.DB,
	projectID string,
	requirementID string,
	action string,
	fromStatus string,
	toStatus string,
	detail string,
	operatedBy string,
	now time.Time,
) error {
	eventID, err := id.New()
	if err != nil {
		return err
	}
	return tx.Create(&Event{
		ID: eventID, ProjectID: projectID, RequirementID: requirementID, Action: action,
		FromStatus: fromStatus, ToStatus: toStatus, Detail: detail, OperatedBy: operatedBy,
		OperatedAt: now, CreatedAt: now, UpdatedAt: now,
	}).Error
}

func validateSection(chapter string, title string) (string, string, error) {
	chapter = strings.TrimSpace(chapter)
	title = strings.TrimSpace(title)
	if !chapterPattern.MatchString(chapter) {
		return "", "", ErrChapterInvalid
	}
	if title == "" {
		return "", "", fmt.Errorf("章节标题不能为空")
	}
	if len([]rune(title)) > 240 {
		return "", "", fmt.Errorf("章节标题最多 240 个字符")
	}
	return chapter, title, nil
}

func validateRequirement(chapter string, name string, description string) (string, string, string, error) {
	chapter = strings.TrimSpace(chapter)
	name = strings.TrimSpace(name)
	description = strings.TrimSpace(description)
	if !chapterPattern.MatchString(chapter) {
		return "", "", "", ErrChapterInvalid
	}
	if name == "" {
		return "", "", "", fmt.Errorf("需求名称不能为空")
	}
	if description == "" {
		return "", "", "", fmt.Errorf("需求描述不能为空")
	}
	if len([]rune(name)) > 240 {
		return "", "", "", fmt.Errorf("需求名称最多 240 个字符")
	}
	return chapter, name, description, nil
}

func validateBulkRequirement(
	chapter string,
	name string,
	description string,
) (string, string, string, error) {
	chapter, name, _, err := validateRequirement(chapter, name, "批量结构占位描述")
	if err != nil {
		return "", "", "", err
	}
	return chapter, name, strings.TrimSpace(description), nil
}

func validatePrimaryKind(kind string) error {
	switch kind {
	case KindFunctional, KindPerformance, KindInterface, KindSafety, KindReliability, KindOther:
		return nil
	default:
		return ErrInvalidKind
	}
}

func normalizeTags(values []string) []string {
	seen := make(map[string]bool)
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		if len([]rune(value)) > 32 {
			value = string([]rune(value)[:32])
		}
		seen[value] = true
		result = append(result, value)
	}
	if len(result) > 12 {
		result = result[:12]
	}
	return result
}

func marshalTags(values []string) string {
	if len(values) == 0 {
		return "[]"
	}
	data, err := json.Marshal(values)
	if err != nil {
		return "[]"
	}
	return string(data)
}

func originLabel(origin string) string {
	if origin == OriginParsed {
		return "解析候选"
	}
	return "手动正式"
}

func parseTags(value string) []string {
	var result []string
	if err := json.Unmarshal([]byte(value), &result); err != nil {
		return []string{}
	}
	return normalizeTags(result)
}

func dereference(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func sortSections(sections []Section) {
	sort.Slice(sections, func(i int, j int) bool {
		return compareChapter(sections[i].ChapterNumber, sections[j].ChapterNumber) < 0
	})
}

func sortRequirements(requirements []Requirement) {
	sort.Slice(requirements, func(i int, j int) bool {
		return compareChapter(requirements[i].ChapterNumber, requirements[j].ChapterNumber) < 0
	})
}

func toSourceResponses(rows []SourceRow) []SourceResponse {
	result := make([]SourceResponse, 0, len(rows))
	for _, row := range rows {
		result = append(result, SourceResponse{
			ID: row.ID, ObjectName: row.ObjectName, Version: row.Version,
			FileType: row.FileType, OriginalName: row.OriginalName,
			HasLocalFile: row.StoragePath != "", ParseState: parseState(row),
			UpdatedAt: row.UpdatedAt.Format(time.RFC3339),
		})
	}
	return result
}

func parseState(row SourceRow) string {
	if row.StoragePath == "" {
		return "manual"
	}
	if hasDocxExtension(row.StoragePath) {
		return "ready"
	}
	if strings.EqualFold(filepath.Ext(row.StoragePath), ".doc") {
		return "convert"
	}
	return "register"
}

func toSectionResponses(sections []Section) []SectionResponse {
	result := make([]SectionResponse, 0, len(sections))
	for _, section := range sections {
		result = append(result, toSectionResponse(section))
	}
	return result
}

func toSectionResponse(section Section) SectionResponse {
	return SectionResponse{
		ID: section.ID, ParentID: dereference(section.ParentID),
		SourceVersionID: section.SourceVersionID, ChapterNumber: section.ChapterNumber,
		Title: section.Title, Origin: section.Origin, SourceAnchor: section.SourceAnchor,
		CreatedAt: section.CreatedAt.Format(time.RFC3339), UpdatedAt: section.UpdatedAt.Format(time.RFC3339),
	}
}

func toRequirementResponses(requirements []Requirement) []RequirementResponse {
	result := make([]RequirementResponse, 0, len(requirements))
	for _, requirement := range requirements {
		result = append(result, toRequirementResponse(requirement))
	}
	return result
}

func toRequirementResponse(requirement Requirement) RequirementResponse {
	return RequirementResponse{
		ID: requirement.ID, SourceVersionID: requirement.SourceVersionID,
		SectionID: dereference(requirement.SectionID), ChapterNumber: requirement.ChapterNumber,
		ExternalIdentifier: requirement.ExternalIdentifier, Name: requirement.Name,
		Description: requirement.Description, PrimaryKind: requirement.PrimaryKind,
		Tags: parseTags(requirement.Tags), Origin: requirement.Origin,
		SourceAnchor: requirement.SourceAnchor, Status: requirement.Status,
		TestItemTaskStatus: requirement.TestItemTaskStatus,
		CreatedAt:          requirement.CreatedAt.Format(time.RFC3339),
		UpdatedAt:          requirement.UpdatedAt.Format(time.RFC3339),
	}
}
