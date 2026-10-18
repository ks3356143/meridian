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

	if err := s.persist(ctx, ref.ProjectID, ref.ID, doc, origin, authoringMode, operator); err != nil {
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

// BlockView 通用内容块视图：解析后的文档 + 纯文本 + 非空判定。
type BlockView struct {
	Doc        Node      `json:"doc"`
	PlainText  string    `json:"plainText"`
	HasContent bool      `json:"hasContent"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// emptyBlockView 无块记录时的默认视图（空文档），包级缓存避免重复解析。
var emptyBlockView = func() BlockView {
	doc, err := ParseDocument([]byte(EmptyDocumentJSON))
	if err != nil {
		return BlockView{}
	}
	return BlockView{Doc: doc}
}()

// EmptyBlockView 返回无块记录时的空视图。
func EmptyBlockView() BlockView {
	return emptyBlockView
}

// SaveBlockOptions 控制块写入的来源标记与额外节点禁用。
type SaveBlockOptions struct {
	Origin        string
	AuthoringMode string
	// BannedNodes 在标准白名单之外禁用指定节点类型，由调用方按业务传入。
	BannedNodes map[string]bool
}

// LoadBlocks 按拥有者读取块视图；keyPrefix 为空时返回该拥有者全部块。
func (s *Service) LoadBlocks(
	ctx context.Context,
	projectID string,
	ownerType string,
	ownerID string,
	keyPrefix string,
) (map[string]BlockView, error) {
	query := s.db.WithContext(ctx).
		Where("project_id = ? AND owner_type = ? AND owner_id = ?", projectID, ownerType, ownerID)
	if keyPrefix != "" {
		query = query.Where("block_key LIKE ?", keyPrefix+"%")
	}
	var blocks []ContentBlock
	if err := query.Find(&blocks).Error; err != nil {
		return nil, fmt.Errorf("查询内容块失败: %w", err)
	}
	views := make(map[string]BlockView, len(blocks))
	for _, block := range blocks {
		doc, err := ParseDocument([]byte(block.BodyJSON))
		if err != nil {
			return nil, fmt.Errorf("内容块数据非法: %w", err)
		}
		views[block.BlockKey] = BlockView{
			Doc:        doc,
			PlainText:  PlainText(doc),
			HasContent: HasContent(doc),
			UpdatedAt:  block.UpdatedAt,
		}
	}
	return views, nil
}

// SaveBlock 校验并保存单个内容块（按拥有者+块键 upsert），返回最新视图。
func (s *Service) SaveBlock(
	ctx context.Context,
	projectID string,
	ownerType string,
	ownerID string,
	blockKey string,
	doc Node,
	opts SaveBlockOptions,
	operator string,
) (BlockView, error) {
	doc = SanitizeDocument(doc)
	if err := ValidateDocumentBanned(doc, opts.BannedNodes); err != nil {
		return BlockView{}, err
	}
	origin := opts.Origin
	if origin == "" {
		origin = OriginManual
	}
	if !validOrigins[origin] {
		return BlockView{}, fmt.Errorf("来源 %q 不受支持", origin)
	}
	authoringMode := opts.AuthoringMode
	if authoringMode == "" {
		authoringMode = AuthoringManual
	}
	if !validAuthoringModes[authoringMode] {
		return BlockView{}, fmt.Errorf("创作方式 %q 不受支持", authoringMode)
	}

	bodyJSON, err := MarshalDocument(doc)
	if err != nil {
		return BlockView{}, err
	}
	plainText := PlainText(doc)
	now := time.Now().UTC()

	blockID, err := id.New()
	if err != nil {
		return BlockView{}, err
	}
	block := ContentBlock{
		ID:            blockID,
		ProjectID:     projectID,
		OwnerType:     ownerType,
		OwnerID:       ownerID,
		BlockKey:      blockKey,
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
		return BlockView{}, fmt.Errorf("保存内容块失败: %w", err)
	}

	return BlockView{Doc: doc, PlainText: plainText, HasContent: HasContent(doc), UpdatedAt: now}, nil
}

// persist 写入需求正文块。正文块是正文的权威源，不再回写 software_requirements.description。
func (s *Service) persist(
	ctx context.Context,
	projectID string,
	ownerID string,
	doc Node,
	origin string,
	authoringMode string,
	operator string,
) error {
	_, err := s.SaveBlock(ctx, projectID, OwnerTypeRequirement, ownerID, BlockKeyRequirementBody, doc, SaveBlockOptions{
		Origin:        origin,
		AuthoringMode: authoringMode,
	}, operator)
	return err
}
