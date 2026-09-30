package contentblocks

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/danielgtaylor/huma/v2"

	authservice "chenmeridian/internal/auth"
	contentblocksservice "chenmeridian/internal/modules/contentblocks"
)

type Handler struct {
	service *contentblocksservice.Service
}

func Register(api huma.API, service *contentblocksservice.Service) {
	handler := &Handler{service: service}

	huma.Register(api, huma.Operation{
		OperationID: "get-requirement-body",
		Method:      http.MethodGet,
		Path:        "/api/v1/software-requirements/{id}/blocks",
		Summary:     "读取需求正文块",
		Description: "返回需求正文的结构化块文档与纯文本；没有正文块时返回空文档。",
		Tags:        []string{"需求与追踪"},
	}, func(ctx context.Context, input *RequirementBodyInput) (*RequirementBodyOutput, error) {
		body, err := handler.service.RequirementBody(ctx, input.ID)
		if err != nil {
			return nil, toAPIError(err, "读取需求正文失败")
		}
		return &RequirementBodyOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "save-requirement-body",
		Method:      http.MethodPut,
		Path:        "/api/v1/software-requirements/{id}/blocks",
		Summary:     "保存需求正文块",
		Description: "按受限节点白名单校验后保存需求正文，并同步需求摘要。",
		Tags:        []string{"需求与追踪"},
	}, func(ctx context.Context, input *SaveRequirementBodyInput) (*RequirementBodyOutput, error) {
		body, err := handler.service.SaveRequirementBody(
			ctx,
			input.ID,
			input.Body.Doc,
			input.Body.Origin,
			input.Body.AuthoringMode,
			currentUserID(ctx),
		)
		if err != nil {
			return nil, toAPIError(err, "保存需求正文失败")
		}
		return &RequirementBodyOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "get-project-asset",
		Method:      http.MethodGet,
		Path:        "/api/v1/projects/{code}/assets/{assetId}",
		Summary:     "读取项目附件",
		Description: "按项目归属读取内容块附件；传 w 时返回缩略图，解码失败自动回退原图。",
		Tags:        []string{"内容块与附件"},
	}, func(ctx context.Context, input *AssetContentInput) (*huma.StreamResponse, error) {
		file, err := handler.service.AssetContent(ctx, input.Code, input.AssetID, input.Width)
		if err != nil {
			return nil, toAPIError(err, "读取附件失败")
		}
		return &huma.StreamResponse{
			Body: func(hctx huma.Context) {
				hctx.SetHeader("Content-Type", file.ContentType)
				hctx.SetHeader("Content-Length", strconv.Itoa(len(file.Bytes)))
				hctx.SetHeader("Cache-Control", "private, max-age=86400")
				hctx.SetHeader("X-Content-Type-Options", "nosniff")
				if file.ETag != "" {
					hctx.SetHeader("ETag", `"`+file.ETag+`"`)
				}
				if file.ThumbnailFallback {
					hctx.SetHeader("X-Thumbnail-Fallback", "1")
				}
				_, _ = hctx.BodyWriter().Write(file.Bytes)
			},
		}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "upload-project-asset",
		Method:      http.MethodPost,
		Path:        "/api/v1/projects/{code}/assets",
		Summary:     "上传项目附件",
		Description: "上传内容块图片资源，校验项目归属与图片类型，并返回图片元数据。",
		Tags:        []string{"内容块与附件"},
	}, func(ctx context.Context, input *AssetUploadInput) (*AssetUploadOutput, error) {
		file := input.RawBody.Data().File
		defer file.Close()
		data, err := io.ReadAll(io.LimitReader(file, contentblocksservice.MaxAssetUploadBytes+1))
		if err != nil {
			return nil, huma.Error400BadRequest("读取上传文件失败")
		}
		if len(data) > contentblocksservice.MaxAssetUploadBytes {
			return nil, huma.Error413RequestEntityTooLarge("图片不能超过 20MB")
		}
		asset, err := handler.service.UploadAsset(ctx, input.Code, contentblocksservice.AssetUpload{
			Data:     data,
			Filename: file.Filename,
			MimeType: file.ContentType,
			Operator: currentUserID(ctx),
		})
		if err != nil {
			return nil, toAPIError(err, "上传附件失败")
		}
		return &AssetUploadOutput{Body: asset}, nil
	})
}

func currentUserID(ctx context.Context) string {
	claims, ok := authservice.ClaimsFromContext(ctx)
	if !ok {
		return ""
	}
	return claims.UserID
}

func toAPIError(err error, fallback string) error {
	switch {
	case errors.Is(err, contentblocksservice.ErrRequirementNotFound):
		return huma.Error404NotFound("软件需求不存在")
	case errors.Is(err, contentblocksservice.ErrAssetProjectNotFound):
		return huma.Error404NotFound("项目不存在")
	case errors.Is(err, contentblocksservice.ErrAssetNotFound):
		return huma.Error404NotFound("附件不存在")
	case errors.Is(err, contentblocksservice.ErrAssetUploadTooLarge):
		return huma.Error413RequestEntityTooLarge("图片不能超过 20MB")
	case errors.Is(err, contentblocksservice.ErrAssetUploadType):
		return huma.Error422UnprocessableEntity("仅支持 PNG / JPEG / WebP / GIF 图片")
	default:
		var validationErr *contentblocksservice.ValidationError
		if errors.As(err, &validationErr) {
			return huma.Error422UnprocessableEntity(validationErr.Error())
		}
		return huma.Error500InternalServerError(fallback)
	}
}
