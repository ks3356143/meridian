package contentblocks

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
)

const MaxAssetUploadBytes = 20 << 20 // 20MB

var (
	// ErrAssetUploadTooLarge 表示上传图片超过容量限制。
	ErrAssetUploadTooLarge = errors.New("图片不能超过 20MB")
	// ErrAssetUploadType 表示上传文件不是支持的图片类型。
	ErrAssetUploadType = errors.New("仅支持 PNG / JPEG / WebP / GIF 图片")
)

// AssetUpload 是一次内容块图片上传输入。
type AssetUpload struct {
	Data     []byte
	Filename string
	MimeType string
	Operator string
}

// AssetUploadResponse 是图片上传后的元数据。
type AssetUploadResponse struct {
	ID       string `json:"id"`
	MimeType string `json:"mimeType"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	FileSize int64  `json:"fileSize"`
}

// UploadAsset 校验并登记项目图片资源，供正文图片块替换使用。
func (s *Service) UploadAsset(ctx context.Context, projectCode string, upload AssetUpload) (AssetUploadResponse, error) {
	projectID, err := s.projectIDByCode(ctx, projectCode)
	if err != nil {
		return AssetUploadResponse{}, err
	}
	if len(upload.Data) == 0 {
		return AssetUploadResponse{}, ErrAssetUploadType
	}
	if len(upload.Data) > MaxAssetUploadBytes {
		return AssetUploadResponse{}, ErrAssetUploadTooLarge
	}

	extension := strings.ToLower(filepath.Ext(strings.TrimSpace(upload.Filename)))
	mimeType, ok := supportedMediaTypes[extension]
	if !ok {
		return AssetUploadResponse{}, ErrAssetUploadType
	}
	if declared := strings.TrimSpace(strings.ToLower(upload.MimeType)); declared != "" &&
		declared != "application/octet-stream" && declared != mimeType {
		return AssetUploadResponse{}, fmt.Errorf("%w: 声明的类型 %s 与扩展名不匹配", ErrAssetUploadType, declared)
	}

	width, height, err := imageDimensions(upload.Data)
	if err != nil {
		return AssetUploadResponse{}, fmt.Errorf("图片内容无法识别: %w", err)
	}

	assetID, err := s.RegisterAsset(ctx, projectID, "", upload.Operator, MediaFile{
		Extension: extension,
		MimeType:  mimeType,
		Data:      upload.Data,
		Width:     width,
		Height:    height,
	})
	if err != nil {
		return AssetUploadResponse{}, err
	}
	return AssetUploadResponse{
		ID:       assetID,
		MimeType: mimeType,
		Width:    width,
		Height:   height,
		FileSize: int64(len(upload.Data)),
	}, nil
}
