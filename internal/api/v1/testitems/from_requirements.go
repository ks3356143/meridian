package testitems

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	testitemsservice "chenmeridian/internal/modules/testitems"
)

type BatchCreateFromRequirementsInput struct {
	Code string `path:"code" doc:"项目标识"`
	Body struct {
		All            bool     `json:"all,omitempty" doc:"为项目内全部已确认需求创建测试项"`
		RequirementIDs []string `json:"requirementIds,omitempty" doc:"选中的需求 id；all=false 时必填"`
	}
}

type BatchCreateFromRequirementsOutput struct {
	Body testitemsservice.BatchCreateFromRequirementsResult
}

func registerBatchCreateFromRequirements(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "batch-create-test-items-from-requirements",
		Method:      http.MethodPost,
		Path:        "/api/v1/projects/{code}/test-items/from-requirements",
		Summary:     "按需求批量创建测试项",
		Description: "为全部或选中的已确认需求创建并关联测试项；默认跳过已关联和待补描述需求，逐条复用单条创建规则并返回汇总。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *BatchCreateFromRequirementsInput) (*BatchCreateFromRequirementsOutput, error) {
		if input.Body.All && len(input.Body.RequirementIDs) > 0 {
			return nil, huma.Error422UnprocessableEntity("不能同时选择全部需求和指定需求")
		}
		if !input.Body.All && len(input.Body.RequirementIDs) == 0 {
			return nil, huma.Error422UnprocessableEntity("请选择需求")
		}
		projectID, err := handler.projectID(ctx, input.Code)
		if err != nil {
			return nil, toAPIError(err, "项目不存在")
		}
		result, err := handler.service.CreateTestItemsFromRequirements(
			ctx,
			projectID,
			input.Body.RequirementIDs,
			input.Body.All,
		)
		if err != nil {
			return nil, toAPIError(err, "批量创建测试项失败")
		}
		return &BatchCreateFromRequirementsOutput{Body: result}, nil
	})
}
