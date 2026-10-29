package testitems

import (
	"context"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"

	testitemsservice "chenmeridian/internal/modules/testitems"
)

// RoundCopyPreviewInput 预览来源轮可带入的测试项。
type RoundCopyPreviewInput struct {
	Code          string `path:"code" doc:"项目标识"`
	SourceRoundID string `path:"sourceRoundId" doc:"来源轮次 id"`
}

// RoundCopyPreviewOutput 预览响应。
type RoundCopyPreviewOutput struct {
	Body testitemsservice.RoundCopyPreview
}

type RoundListInput struct {
	Code string `path:"code" doc:"项目标识"`
}

type RoundListOutput struct {
	Body []testitemsservice.Round
}

// CreateRoundCopyInput 新建后续轮并复制选定测试项树。
type CreateRoundCopyInput struct {
	Code string `path:"code" doc:"项目标识"`
	Body struct {
		SourceRoundID string   `json:"sourceRoundId" doc:"来源轮次 id"`
		TestItemIDs   []string `json:"testItemIds" doc:"要带入的测试项 id；可为空数组"`
		Name          string   `json:"name,omitempty" doc:"轮次名称；留空按轮次号生成"`
		DutVersion    string   `json:"dutVersion,omitempty"`
		StartedOn     *string  `json:"startedOn,omitempty"`
		EndedOn       *string  `json:"endedOn,omitempty"`
		ChangeReason  string   `json:"changeReason,omitempty"`
		ReasonSummary string   `json:"reasonSummary,omitempty"`
	}
}

// CreateRoundCopyOutput 新建轮次结果。
type CreateRoundCopyOutput struct {
	Body testitemsservice.RoundCopyResult
}

func registerRounds(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "list-test-rounds",
		Method:      http.MethodGet,
		Path:        "/api/v1/projects/{code}/test-rounds",
		Summary:     "项目轮次列表",
		Description: "返回项目全部轮次，按轮次号升序，供工作区轮次切换与新建向导使用。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *RoundListInput) (*RoundListOutput, error) {
		projectID, err := handler.projectID(ctx, input.Code)
		if err != nil {
			return nil, toAPIError(err, "项目不存在")
		}
		rounds, err := handler.service.ListRounds(ctx, projectID)
		if err != nil {
			return nil, toAPIError(err, "读取轮次列表失败")
		}
		return &RoundListOutput{Body: nonNil(rounds)}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "preview-round-copy",
		Method:      http.MethodGet,
		Path:        "/api/v1/projects/{code}/test-rounds/{sourceRoundId}/copy-preview",
		Summary:     "预览轮次复制范围",
		Description: "返回来源轮中可带入后续轮的动态测试项，以及按上轮未通过用例计算的默认勾选和通过/未通过统计；静态项不出现。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *RoundCopyPreviewInput) (*RoundCopyPreviewOutput, error) {
		projectID, err := handler.projectID(ctx, input.Code)
		if err != nil {
			return nil, toAPIError(err, "项目不存在")
		}
		preview, err := handler.service.PreviewRoundCopy(ctx, projectID, input.SourceRoundID)
		if err != nil {
			return nil, toAPIError(err, "读取轮次复制预览失败")
		}
		preview.TestItems = nonNil(preview.TestItems)
		return &RoundCopyPreviewOutput{Body: preview}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "create-round-copy",
		Method:      http.MethodPost,
		Path:        "/api/v1/projects/{code}/test-rounds",
		Summary:     "新建后续轮并复制测试项树",
		Description: "在单事务内新建后续轮，复制选中的动态测试项、文件夹、子项、需求关联、用例和步骤；执行状态与 act 内容清空，选择空数组时创建空轮。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *CreateRoundCopyInput) (*CreateRoundCopyOutput, error) {
		if strings.TrimSpace(input.Body.SourceRoundID) == "" {
			return nil, huma.Error422UnprocessableEntity("来源轮次不能为空")
		}
		projectID, err := handler.projectID(ctx, input.Code)
		if err != nil {
			return nil, toAPIError(err, "项目不存在")
		}
		result, err := handler.service.CreateRoundCopy(ctx, testitemsservice.CreateRoundCopyInput{
			ProjectID:     projectID,
			SourceRoundID: input.Body.SourceRoundID,
			TestItemIDs:   input.Body.TestItemIDs,
			Name:          input.Body.Name,
			DutVersion:    input.Body.DutVersion,
			StartedOn:     input.Body.StartedOn,
			EndedOn:       input.Body.EndedOn,
			ChangeReason:  input.Body.ChangeReason,
			ReasonSummary: input.Body.ReasonSummary,
		})
		if err != nil {
			return nil, toAPIError(err, "创建轮次失败")
		}
		return &CreateRoundCopyOutput{Body: result}, nil
	})
}
