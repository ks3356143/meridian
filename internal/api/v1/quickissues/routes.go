package quickissues

import (
	"context"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	authservice "chenmeridian/internal/auth"
	quickissuesservice "chenmeridian/internal/modules/quickissues"
)

type Handler struct {
	service *quickissuesservice.Service
}

func Register(api huma.API, service *quickissuesservice.Service) {
	handler := &Handler{service: service}

	huma.Register(api, huma.Operation{
		OperationID: "list-quick-issues",
		Method:      http.MethodGet,
		Path:        "/api/v1/test-cases/{id}/quick-issues",
		Summary:     "读取用例快捷问题草稿",
		Description: "项目成员可查看当前用例的快捷问题草稿；非创建人只读。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *CaseInput) (*NoteListOutput, error) {
		notes, err := handler.service.List(ctx, input.ID, currentUserID(ctx))
		if err != nil {
			return nil, toAPIError(err, "读取问题草稿失败")
		}
		if notes == nil {
			notes = []quickissuesservice.NoteView{}
		}
		return &NoteListOutput{Body: notes}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "create-quick-issue",
		Method:      http.MethodPost,
		Path:        "/api/v1/test-cases/{id}/quick-issues",
		Summary:     "新建快捷问题草稿",
		Description: "记录一句话和可选截图；步骤可空，填写时必须属于当前用例。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *CreateInput) (*NoteOutput, error) {
		note, err := handler.service.Create(ctx, quickissuesservice.CreateInput{
			CaseID:            input.ID,
			TestCaseStepID:    input.Body.TestCaseStepID,
			NoteText:          input.Body.NoteText,
			ScreenshotAssetID: input.Body.ScreenshotAssetID,
			CreatedBy:         currentUserID(ctx),
		})
		if err != nil {
			return nil, toAPIError(err, "保存问题草稿失败")
		}
		return &NoteOutput{Body: note}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "update-quick-issue",
		Method:      http.MethodPatch,
		Path:        "/api/v1/quick-issues/{id}",
		Summary:     "编辑快捷问题草稿",
		Description: "只有创建人可以编辑自己的问题草稿。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *UpdateInput) (*NoteOutput, error) {
		note, err := handler.service.Update(ctx, input.ID, quickissuesservice.UpdateInput{
			NoteText:          input.Body.NoteText,
			ScreenshotAssetID: input.Body.ScreenshotAssetID,
			ClearScreenshot:   input.Body.ClearScreenshot,
			UpdatedBy:         currentUserID(ctx),
		})
		if err != nil {
			return nil, toAPIError(err, "更新问题草稿失败")
		}
		return &NoteOutput{Body: note}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "delete-quick-issue",
		Method:      http.MethodDelete,
		Path:        "/api/v1/quick-issues/{id}",
		Summary:     "删除快捷问题草稿",
		Description: "只有创建人可以删除自己的问题草稿。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *NoteIDInput) (*struct{}, error) {
		if err := handler.service.Delete(ctx, input.ID, currentUserID(ctx)); err != nil {
			return nil, toAPIError(err, "删除问题草稿失败")
		}
		return &struct{}{}, nil
	})
}

type CaseInput struct {
	ID string `path:"id" doc:"用例 id"`
}

type NoteIDInput struct {
	ID string `path:"id" doc:"问题草稿 id"`
}

type CreateInput struct {
	ID   string `path:"id" doc:"用例 id"`
	Body struct {
		TestCaseStepID    *string `json:"testCaseStepId,omitempty"`
		NoteText          string  `json:"noteText"`
		ScreenshotAssetID *string `json:"screenshotAssetId,omitempty"`
	}
}

type UpdateInput struct {
	ID   string `path:"id" doc:"问题草稿 id"`
	Body struct {
		NoteText          *string `json:"noteText,omitempty"`
		ScreenshotAssetID *string `json:"screenshotAssetId,omitempty"`
		ClearScreenshot   bool    `json:"clearScreenshot,omitempty"`
	}
}

type NoteOutput struct {
	Body quickissuesservice.NoteView
}

type NoteListOutput struct {
	Body []quickissuesservice.NoteView
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
	case errors.Is(err, quickissuesservice.ErrCaseNotFound):
		return huma.Error404NotFound("用例不存在")
	case errors.Is(err, quickissuesservice.ErrNoteNotFound):
		return huma.Error404NotFound("问题草稿不存在")
	case errors.Is(err, quickissuesservice.ErrForbidden):
		return huma.Error403Forbidden("只有创建人可以编辑或删除自己的问题草稿")
	case errors.Is(err, quickissuesservice.ErrNoteRequired):
		return huma.Error422UnprocessableEntity("问题内容不能为空")
	case errors.Is(err, quickissuesservice.ErrNoteTooLong):
		return huma.Error422UnprocessableEntity("问题内容不能超过 500 个字符")
	case errors.Is(err, quickissuesservice.ErrStepMismatch):
		return huma.Error422UnprocessableEntity("所选步骤不属于当前用例")
	case errors.Is(err, quickissuesservice.ErrAssetMismatch):
		return huma.Error422UnprocessableEntity("截图不属于当前项目")
	case errors.Is(err, quickissuesservice.ErrNoUpdate):
		return huma.Error422UnprocessableEntity("没有需要修改的内容")
	default:
		return huma.Error500InternalServerError(fallback)
	}
}
