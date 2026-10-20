package testitems

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	testitemsservice "chenmeridian/internal/modules/testitems"
)

type BatchAssignCasesInput struct {
	TestItemID string `path:"id"`
	Body       struct {
		CaseIDs  []string `json:"caseIds" doc:"选中的用例 id"`
		TesterID *string  `json:"testerId,omitempty" doc:"测试人员 id；空字符串清除指派；省略表示不修改"`
		Status   *string  `json:"status,omitempty" doc:"pending/passed/failed；省略表示不修改"`
		ExecDate *string  `json:"execDate,omitempty" doc:"YYYY-MM-DD；空字符串清除；省略表示不修改"`
	}
}

type BatchAssignCasesOutput struct {
	Body struct {
		Cases []testitemsservice.Case `json:"cases"`
	}
}

type SearchCasesInput struct {
	TestItemID string `path:"id"`
	Query      string `query:"q" doc:"用例名称、综述或步骤正文关键字"`
}

type SearchCasesOutput struct {
	Body struct {
		Hits []testitemsservice.CaseSearchHit `json:"hits"`
	}
}

type CopyCaseInput struct {
	CaseID string `path:"id"`
	Body   struct {
		TargetItemID string `json:"targetItemId"`
		TargetIndex  int    `json:"targetIndex"`
	}
}

func registerCaseEfficiency(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "batch-assign-test-cases",
		Method:      http.MethodPost,
		Path:        "/api/v1/test-items/{id}/cases/batch-assign",
		Summary:     "批量指派用例",
		Description: "同一测试项内批量设置测试人员、执行状态与执行日期；未传字段保持不变。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *BatchAssignCasesInput) (*BatchAssignCasesOutput, error) {
		cases, err := handler.service.BatchAssignCases(ctx, input.TestItemID, testitemsservice.BatchAssignCasesInput{
			CaseIDs:  input.Body.CaseIDs,
			TesterID: input.Body.TesterID,
			Status:   input.Body.Status,
			ExecDate: input.Body.ExecDate,
		})
		if err != nil {
			return nil, toAPIError(err, "批量指派用例失败")
		}
		output := &BatchAssignCasesOutput{}
		output.Body.Cases = nonNil(cases)
		return output, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "search-test-cases",
		Method:      http.MethodGet,
		Path:        "/api/v1/test-items/{id}/search",
		Summary:     "测试项内查找",
		Description: "查找用例字段与步骤正文，返回字段、摘要与步骤定位信息。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *SearchCasesInput) (*SearchCasesOutput, error) {
		hits, err := handler.service.SearchCases(ctx, input.TestItemID, input.Query)
		if err != nil {
			return nil, toAPIError(err, "测试项内查找失败")
		}
		output := &SearchCasesOutput{}
		output.Body.Hits = nonNil(hits)
		return output, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "copy-test-case",
		Method:      http.MethodPost,
		Path:        "/api/v1/test-cases/{id}/copy",
		Summary:     "复制用例到指定位置",
		Description: "Ctrl+拖拽复制用例：复制设计内容，重置执行状态与实测结果，并在目标测试项重排用例标识。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *CopyCaseInput) (*CaseOutput, error) {
		created, err := handler.service.CopyCaseTo(ctx, input.CaseID, input.Body.TargetItemID, input.Body.TargetIndex)
		if err != nil {
			return nil, toAPIError(err, "复制用例失败")
		}
		return &CaseOutput{Body: created}, nil
	})
}
