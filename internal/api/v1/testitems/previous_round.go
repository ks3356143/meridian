package testitems

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	testitemsservice "chenmeridian/internal/modules/testitems"
)

type PreviousRoundResultInput struct {
	ID string `path:"id" doc:"当前轮用例 id"`
}

type PreviousRoundResultOutput struct {
	Body testitemsservice.PreviousRoundResult
}

func registerPreviousRoundResult(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-previous-round-result",
		Method:      http.MethodGet,
		Path:        "/api/v1/test-cases/{id}/previous-round-result",
		Summary:     "读取用例上轮实测",
		Description: "按测试项与用例 lineage_key 对齐上一轮记录，返回只读实测结果、执行信息和步骤富文本。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *PreviousRoundResultInput) (*PreviousRoundResultOutput, error) {
		result, err := handler.service.PreviousRoundResult(ctx, input.ID)
		if err != nil {
			return nil, toAPIError(err, "读取上轮实测失败")
		}
		if result.Steps == nil {
			result.Steps = []testitemsservice.PreviousRoundStep{}
		}
		return &PreviousRoundResultOutput{Body: result}, nil
	})
}
