package contentblocks

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"gorm.io/gorm"

	"chenmeridian/internal/id"
)

// Asset 对应 assets 表，保存内容块引用的附件元数据。
type Asset struct {
	ID             string    `gorm:"column:id;primaryKey"`
	ProjectID      string    `gorm:"column:project_id"`
	ContentBlockID *string   `gorm:"column:content_block_id"`
	SHA256         string    `gorm:"column:sha256"`
	StorageKey     string    `gorm:"column:storage_key"`
	MimeType       string    `gorm:"column:mime_type"`
	FileExt        string    `gorm:"column:file_ext"`
	FileSize       int64     `gorm:"column:file_size"`
	Width          int       `gorm:"column:width"`
	Height         int       `gorm:"column:height"`
	Caption        string    `gorm:"column:caption"`
	CreatedBy      string    `gorm:"column:created_by"`
	CreatedAt      time.Time `gorm:"column:created_at"`
	UpdatedAt      time.Time `gorm:"column:updated_at"`
}

func (Asset) TableName() string { return "assets" }

// AssetStore 按内容哈希存储附件文件，路径规则见《附件模型》。
type AssetStore struct {
	root string
}

func NewAssetStore(root string) *AssetStore {
	if strings.TrimSpace(root) == "" {
		root = filepath.Join("data", "assets")
	}
	return &AssetStore{root: root}
}

// Root 返回附件根目录。
func (s *AssetStore) Root() string { return s.root }

// Save 写入文件并返回 sha256 与相对存储键；同一哈希只存一份。
func (s *AssetStore) Save(data []byte, extension string) (string, string, error) {
	if len(data) == 0 {
		return "", "", errors.New("附件内容为空")
	}
	digest := sha256.Sum256(data)
	sum := hex.EncodeToString(digest[:])
	safeExt := strings.ToLower(strings.TrimSpace(extension))
	if !strings.HasPrefix(safeExt, ".") {
		safeExt = "." + safeExt
	}
	if safeExt == "." {
		safeExt = ""
	}
	storageKey := path.Join(sum[:2], sum+safeExt)
	target := filepath.Join(s.root, filepath.FromSlash(storageKey))
	if _, err := os.Stat(target); err == nil {
		return sum, storageKey, nil
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return "", "", fmt.Errorf("创建附件目录失败: %w", err)
	}
	temp := target + ".tmp"
	if err := os.WriteFile(temp, data, 0o644); err != nil {
		return "", "", fmt.Errorf("写入附件失败: %w", err)
	}
	if err := os.Rename(temp, target); err != nil {
		return "", "", fmt.Errorf("保存附件失败: %w", err)
	}
	return sum, storageKey, nil
}

// RegisterAsset 保存媒体文件并登记资源记录；同一项目内相同哈希复用已有记录。
func (s *Service) RegisterAsset(
	ctx context.Context,
	projectID string,
	contentBlockID string,
	operator string,
	media MediaFile,
) (string, error) {
	sum, storageKey, err := s.assets.Save(media.Data, media.Extension)
	if err != nil {
		return "", err
	}

	var existing Asset
	err = s.db.WithContext(ctx).
		Where("project_id = ? AND sha256 = ?", projectID, sum).
		First(&existing).Error
	if err == nil {
		if existing.Width == 0 && media.Width > 0 {
			_ = s.db.WithContext(ctx).Model(&Asset{}).Where("id = ?", existing.ID).Updates(map[string]any{
				"width":  media.Width,
				"height": media.Height,
			}).Error
		}
		return existing.ID, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", fmt.Errorf("查询附件失败: %w", err)
	}

	assetID, err := id.New()
	if err != nil {
		return "", err
	}
	now := time.Now().UTC()
	record := Asset{
		ID:         assetID,
		ProjectID:  projectID,
		SHA256:     sum,
		StorageKey: storageKey,
		MimeType:   media.MimeType,
		FileExt:    media.Extension,
		FileSize:   int64(len(media.Data)),
		Width:      media.Width,
		Height:     media.Height,
		CreatedBy:  operator,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if strings.TrimSpace(contentBlockID) != "" {
		record.ContentBlockID = &contentBlockID
	}
	if err := s.db.WithContext(ctx).Create(&record).Error; err != nil {
		return "", fmt.Errorf("登记附件失败: %w", err)
	}
	return record.ID, nil
}
