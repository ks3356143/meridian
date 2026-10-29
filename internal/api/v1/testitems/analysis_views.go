package testitems

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	testitemsservice "chenmeridian/internal/modules/testitems"
)

type TypeCoverageInput struct {
	Code    string `path:"code" doc:"项目标识"`
	RoundID string `query:"roundId" doc:"轮次 id；传 all 返回跨轮只读聚合；省略时取当前轮次"`
}

type TypeCoverageOutput struct {
	Body testitemsservice.TypeCoverageResult
}

type SaveTypeCoverageNoteInput struct {
	Code     string `path:"code" doc:"项目标识"`
	TypeCode string `path:"typeCode" doc:"测试项类型代号"`
	RoundID  string `query:"roundId" doc:"轮次 id"`
	Body     struct {
		ReasonText string `json:"reasonText" doc:"不测评说明"`
	}
}

type SaveTypeCoverageNoteOutput struct {
	Body testitemsservice.TypeCoverageNote
}

func registerAnalysisViews(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-type-coverage",
		Method:      http.MethodGet,
		Path:        "/api/v1/projects/{code}/type-coverage",
		Summary:     "类型覆盖视图",
		Description: "返回 24 类测试项在当前轮或全部轮次的测试项数、用例执行统计和不测评说明；静态类型在第二轮及以后标记为不适用。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *TypeCoverageInput) (*TypeCoverageOutput, error) {
		projectID, err := handler.projectID(ctx, input.Code)
		if err != nil {
			return nil, toAPIError(err, "项目不存在")
		}
		result, err := handler.service.TypeCoverage(ctx, projectID, input.RoundID)
		if err != nil {
			return nil, toAPIError(err, "读取类型覆盖视图失败")
		}
		result.Types = nonNil(result.Types)
		result.Rounds = nonNil(result.Rounds)
		return &TypeCoverageOutput{Body: result}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "save-type-coverage-note",
		Method:      http.MethodPut,
		Path:        "/api/v1/projects/{code}/type-coverage/{typeCode}/note",
		Summary:     "保存不测评说明",
		Description: "为当前轮次没有测试项的类型保存不测评说明；已有测试项或第二轮及以后的静态类型不允许填写。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *SaveTypeCoverageNoteInput) (*SaveTypeCoverageNoteOutput, error) {
		projectID, err := handler.projectID(ctx, input.Code)
		if err != nil {
			return nil, toAPIError(err, "项目不存在")
		}
		note, err := handler.service.SaveTypeCoverageNote(
			ctx, projectID, input.RoundID, input.TypeCode, input.Body.ReasonText, currentUserID(ctx),
		)
		if err != nil {
			return nil, toAPIError(err, "保存不测评说明失败")
		}
		return &SaveTypeCoverageNoteOutput{Body: note}, nil
	})
}
