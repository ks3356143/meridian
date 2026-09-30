package contentblocks

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"chenmeridian/internal/id"
	"chenmeridian/internal/modules/officecli"
)

// 来源与创作方式枚举，对应 content_blocks 表约束。
const (
	OriginManual    = "manual"
	OriginAutoDraft = "auto_draft"
	OriginImported  = "imported"

	AuthoringAuto   = "auto"
	AuthoringManual = "manual"
	AuthoringMixed  = "mixed"
)

// ErrRequirementNotFound 表示拥有者（需求）不存在。
var ErrRequirementNotFound = errors.New("软件需求不存在")

var validOrigins = map[string]bool{OriginManual: true, OriginAutoDraft: true, OriginImported: true}
var validAuthoringModes = map[string]bool{AuthoringAuto: true, AuthoringManual: true, AuthoringMixed: true}

// Service 提供内容块读写能力。
type Service struct {
	db     *gorm.DB
	assets *AssetStore
}

func NewService(db *gorm.DB, assetRoot string) *Service {
	return &Service{db: db, assets: NewAssetStore(assetRoot)}
}

// DocxSource 提供 OfficeCLI 的正文树，便于测试时替换实现。
type DocxSource interface {
	Body(ctx context.Context, file string, depth int) ([]officecli.Node, error)
}

// ImportFromDocx 读取 DOCX 的正文树，把内嵌图片登记为项目资源后转换成受限内容块文档。
func (s *Service) ImportFromDocx(
	ctx context.Context,
	source DocxSource,
	docxPath string,
	projectID string,
	operator string,
) (ImportResult, error) {
	if source == nil {
		return ImportResult{}, errors.New("缺少 DOCX 解析源")
	}
	media, err := ExtractDocumentMedia(docxPath)
	if err != nil {
		return ImportResult{}, err
	}

	assetIDs := make(map[string]string, len(media.Files))
	for _, file := range media.Files {
		assetID, registerErr := s.RegisterAsset(ctx, projectID, "", operator, file)
		if registerErr != nil {
			return ImportResult{}, registerErr
		}
		assetIDs[file.RelID] = assetID
	}

	body, err := source.Body(ctx, docxPath, 8)
	if err != nil {
		return ImportResult{}, err
	}
	result := ConvertBody(body, ImportOptions{
		HeaderRow:       true,
		AssetIDForRelID: func(relID string) string { return assetIDs[relID] },
	})
	result.Skipped = append(media.Skipped, result.Skipped...)
	return result, nil
}

// BodyResponse 是需求正文块的响应结构。
type BodyResponse struct {
	RequirementID string `json:"requirementId"`
	Doc           Node   `json:"doc"`
	PlainText     string `json:"plainText"`
	Origin        string `json:"origin"`
	AuthoringMode string `json:"authoringMode"`
	HasContent    bool   `json:"hasContent"`
	UpdatedAt     string `json:"updatedAt"`
}

// requirementRef 是需求表的最小投影，避免跨模块依赖。
type requirementRef struct {
	ID        string `gorm:"column:id;primaryKey"`
	ProjectID string `gorm:"column:project_id"`
}

func (requirementRef) TableName() string { return "software_requirements" }

// RequirementBody 读取需求正文块；没有块记录时返回空文档。
func (s *Service) RequirementBody(ctx context.Context, requirementID string) (BodyResponse, error) {
	ref, err := s.loadRequirement(ctx, requirementID)
	if err != nil {
		return BodyResponse{}, err
	}

	var block ContentBlock
	err = s.db.WithContext(ctx).
		Where("project_id = ? AND owner_type = ? AND owner_id = ? AND block_key = ?",
			ref.ProjectID, OwnerTypeRequirement, ref.ID, BlockKeyRequirementBody).
		First(&block).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		doc, parseErr := ParseDocument([]byte(EmptyDocumentJSON))
		if parseErr != nil {
			return BodyResponse{}, parseErr
		}
		return BodyResponse{
			RequirementID: ref.ID,
			Doc:           doc,
			Origin:        OriginManual,
			AuthoringMode: AuthoringManual,
			HasContent:    false,
		}, nil
	}
	if err != nil {
		return BodyResponse{}, fmt.Errorf("查询需求正文块失败: %w", err)
	}

	doc, err := ParseDocument([]byte(block.BodyJSON))
	if err != nil {
		return BodyResponse{}, fmt.Errorf("需求正文块数据非法: %w", err)
	}
	doc = SanitizeDocument(doc)
	plainText := PlainText(doc)
	return BodyResponse{
		RequirementID: ref.ID,
		Doc:           doc,
		PlainText:     plainText,
		Origin:        block.Origin,
		AuthoringMode: block.AuthoringMode,
		HasContent:    HasContent(doc),
		UpdatedAt:     block.UpdatedAt.Format(time.RFC3339),
	}, nil
}

// SaveRequirementBody 校验并保存需求正文块。
func (s *Service) SaveRequirementBody(
	ctx context.Context,
	requirementID string,
	doc Node,
	origin string,
	authoringMode string,
	operator string,
) (BodyResponse, error) {
	ref, err := s.loadRequirement(ctx, requirementID)
	if err != nil {
		return BodyResponse{}, err
	}
	doc = SanitizeDocument(doc)
	if err := ValidateDocument(doc); err != nil {
		return BodyResponse{}, err
	}

	if origin == "" {
		origin = OriginManual
	}
	if !validOrigins[origin] {
		return BodyResponse{}, fmt.Errorf("来源 %q 不受支持", origin)
	}
	if authoringMode == "" {
		authoringMode = AuthoringManual
	}
	if !validAuthoringModes[authoringMode] {
		return BodyResponse{}, fmt.Errorf("创作方式 %q 不受支持", authoringMode)
	}

	if err := s.persist(ctx, ref.ProjectID, ref.ID, doc, origin, authoringMode, operator, true); err != nil {
		return BodyResponse{}, err
	}
	plainText := PlainText(doc)
	now := time.Now().UTC()

	return BodyResponse{
		RequirementID: ref.ID,
		Doc:           doc,
		PlainText:     plainText,
		Origin:        origin,
		AuthoringMode: authoringMode,
		HasContent:    HasContent(doc),
		UpdatedAt:     now.Format(time.RFC3339),
	}, nil
}

func (s *Service) loadRequirement(ctx context.Context, requirementID string) (requirementRef, error) {
	var ref requirementRef
	err := s.db.WithContext(ctx).Where("id = ?", requirementID).First(&ref).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return requirementRef{}, ErrRequirementNotFound
	}
	if err != nil {
		return requirementRef{}, fmt.Errorf("查询软件需求失败: %w", err)
	}
	return ref, nil
}

// persist 写入正文块；syncDescription 为真时同步需求摘要（过渡桥接）。
func (s *Service) persist(
	ctx context.Context,
	projectID string,
	ownerID string,
	doc Node,
	origin string,
	authoringMode string,
	operator string,
	syncDescription bool,
) error {
	bodyJSON, err := MarshalDocument(doc)
	if err != nil {
		return err
	}
	plainText := PlainText(doc)
	now := time.Now().UTC()

	blockID, err := id.New()
	if err != nil {
		return err
	}
	block := ContentBlock{
		ID:            blockID,
		ProjectID:     projectID,
		OwnerType:     OwnerTypeRequirement,
		OwnerID:       ownerID,
		BlockKey:      BlockKeyRequirementBody,
		BodyJSON:      bodyJSON,
		PayloadJSON:   "{}",
		PlainText:     plainText,
		SchemaVersion: SchemaVersion,
		Origin:        origin,
		AuthoringMode: authoringMode,
		CreatedBy:     operator,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "project_id"},
			{Name: "owner_type"},
			{Name: "owner_id"},
			{Name: "block_key"},
		},
		DoUpdates: clause.Assignments(map[string]any{
			"body_json":      bodyJSON,
			"plain_text":     plainText,
			"schema_version": SchemaVersion,
			"origin":         origin,
			"authoring_mode": authoringMode,
			"updated_at":     now,
		}),
	}).Create(&block).Error; err != nil {
		return fmt.Errorf("保存需求正文块失败: %w", err)
	}

	if !syncDescription {
		return nil
	}
	// 过渡桥接：列表摘要与搜索仍读取 software_requirements.description。
	// 正文块成为唯一权威源后，应改为直接取 content_blocks.plain_text 并移除此同步。
	if err := s.db.WithContext(ctx).
		Model(&requirementRef{}).
		Where("id = ?", ownerID).
		Updates(map[string]any{"description": plainText, "updated_at": now}).Error; err != nil {
		return fmt.Errorf("同步需求摘要失败: %w", err)
	}
	return nil
}
