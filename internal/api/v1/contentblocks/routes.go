package contentblocks

import (
	"context"
	"errors"
	"net/http"

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
	default:
		var validationErr *contentblocksservice.ValidationError
		if errors.As(err, &validationErr) {
			return huma.Error422UnprocessableEntity(validationErr.Error())
		}
		return huma.Error500InternalServerError(fallback)
	}
}