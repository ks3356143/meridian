package contentblocks

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gorm.io/gorm"
)

var (
	// ErrAssetNotFound 表示项目下不存在目标附件。
	ErrAssetNotFound = errors.New("附件不存在")
	// ErrAssetProjectNotFound 表示项目标识不存在。
	ErrAssetProjectNotFound = errors.New("项目不存在")
)

// AssetFile 是附件读取结果，供原始文件和缩略图接口共用。
type AssetFile struct {
	Bytes             []byte
	ContentType       string
	ETag              string
	ThumbnailFallback bool
}

// AssetContent 读取项目下的附件；width > 0 时优先返回缩略图。
func (s *Service) AssetContent(ctx context.Context, projectCode, assetID string, width int) (AssetFile, error) {
	code := strings.ToUpper(strings.TrimSpace(projectCode))
	if code == "" || strings.TrimSpace(assetID) == "" {
		return AssetFile{}, ErrAssetNotFound
	}

	projectID, err := s.projectIDByCode(ctx, code)
	if err != nil {
		return AssetFile{}, err
	}

	var asset Asset
	err = s.db.WithContext(ctx).
		Where("id = ? AND project_id = ?", strings.TrimSpace(assetID), projectID).
		First(&asset).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return AssetFile{}, ErrAssetNotFound
	}
	if err != nil {
		return AssetFile{}, fmt.Errorf("查询附件失败: %w", err)
	}

	path, err := s.assetPath(asset.StorageKey)
	if err != nil {
		return AssetFile{}, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return AssetFile{}, fmt.Errorf("读取附件文件失败: %w", err)
	}

	result := AssetFile{
		Bytes:       data,
		ContentType: asset.MimeType,
		ETag:        asset.SHA256,
	}
	if width <= 0 || !strings.HasPrefix(asset.MimeType, "image/") {
		return result, nil
	}

	thumb, thumbType, generated, thumbErr := CreateThumbnail(data, asset.MimeType, width)
	if thumbErr != nil || !generated {
		result.ThumbnailFallback = thumbErr != nil
		return result, nil
	}
	result.Bytes = thumb
	result.ContentType = thumbType
	result.ETag = fmt.Sprintf("%s-w%d", asset.SHA256, width)
	return result, nil
}

// projectIDByCode 按项目业务标识解析内部项目 ID。
func (s *Service) projectIDByCode(ctx context.Context, projectCode string) (string, error) {
	code := strings.ToUpper(strings.TrimSpace(projectCode))
	if code == "" {
		return "", ErrAssetProjectNotFound
	}
	var project struct {
		ID string `gorm:"column:id"`
	}
	err := s.db.WithContext(ctx).
		Table("projects").
		Select("id").
		Where("code = ?", code).
		Take(&project).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", ErrAssetProjectNotFound
	}
	if err != nil {
		return "", fmt.Errorf("查询项目失败: %w", err)
	}
	return project.ID, nil
}

func (s *Service) assetPath(storageKey string) (string, error) {
	root := filepath.Clean(s.assets.Root())
	key := filepath.Clean(filepath.FromSlash(strings.TrimSpace(storageKey)))
	if key == "." || filepath.IsAbs(key) {
		return "", fmt.Errorf("附件存储键非法")
	}
	target := filepath.Join(root, key)
	relative, err := filepath.Rel(root, target)
	if err != nil {
		return "", fmt.Errorf("计算附件路径失败: %w", err)
	}
	if relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("附件存储键越界")
	}
	return target, nil
}
