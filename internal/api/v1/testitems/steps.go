package testitems

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	testitemsservice "chenmeridian/internal/modules/testitems"
)

type ListStepsInput struct {
	ID string `path:"id" doc:"用例 id"`
}

type StepsOutput struct {
	Body []testitemsservice.CaseStep
}

type StepOutput struct {
	Body testitemsservice.CaseStep
}

type CreateStepInput struct {
	CaseID string `path:"id"`
	Body   struct {
		ExpectText string `json:"expectText,omitempty"`
	}
}

type StepIDInput struct {
	ID string `path:"id"`
}

type UpdateStepInput struct {
	ID   string `path:"id"`
	Body struct {
		ExpectText *string `json:"expectText,omitempty"`
		Passed     *string `json:"passed,omitempty" doc:"none / pass / fail"`
	}
}

type MoveStepInput struct {
	ID   string `path:"id"`
	Body struct {
		TargetIndex int `json:"targetIndex"`
	}
}

func registerSteps(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "list-test-case-steps",
		Method:      http.MethodGet,
		Path:        "/api/v1/test-cases/{id}/steps",
		Summary:     "用例步骤列表",
		Description: "按序号返回用例步骤。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *ListStepsInput) (*StepsOutput, error) {
		steps, err := handler.service.ListSteps(ctx, input.ID)
		if err != nil {
			return nil, toAPIError(err, "查询用例步骤失败")
		}
		return &StepsOutput{Body: nonNil(steps)}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "create-test-case-step",
		Method:      http.MethodPost,
		Path:        "/api/v1/test-cases/{id}/steps",
		Summary:     "新增用例步骤",
		Description: "在用例末尾追加步骤。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *CreateStepInput) (*StepOutput, error) {
		step, err := handler.service.CreateStep(ctx, input.CaseID, input.Body.ExpectText)
		if err != nil {
			return nil, toAPIError(err, "新增用例步骤失败")
		}
		return &StepOutput{Body: step}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "update-test-case-step",
		Method:      http.MethodPatch,
		Path:        "/api/v1/test-case-steps/{id}",
		Summary:     "更新用例步骤",
		Description: "更新预期结果或通过状态；状态变化会联动用例状态与执行时间。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *UpdateStepInput) (*StepOutput, error) {
		step, err := handler.service.UpdateStep(ctx, input.ID, testitemsservice.UpdateStepInput{
			ExpectText: input.Body.ExpectText,
			Passed:     input.Body.Passed,
		})
		if err != nil {
			return nil, toAPIError(err, "更新用例步骤失败")
		}
		return &StepOutput{Body: step}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "toggle-test-case-step-pass",
		Method:      http.MethodPost,
		Path:        "/api/v1/test-case-steps/{id}/toggle",
		Summary:     "切换步骤通过状态",
		Description: "三态循环：未执行 → 通过 → 未通过。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *StepIDInput) (*StepOutput, error) {
		step, err := handler.service.ToggleStepPass(ctx, input.ID)
		if err != nil {
			return nil, toAPIError(err, "切换步骤状态失败")
		}
		return &StepOutput{Body: step}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "duplicate-test-case-step",
		Method:      http.MethodPost,
		Path:        "/api/v1/test-case-steps/{id}/duplicate",
		Summary:     "复制用例步骤",
		Description: "在当前步骤下方复制一行，通过状态重置。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *StepIDInput) (*StepOutput, error) {
		step, err := handler.service.DuplicateStep(ctx, input.ID)
		if err != nil {
			return nil, toAPIError(err, "复制用例步骤失败")
		}
		return &StepOutput{Body: step}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "delete-test-case-step",
		Method:      http.MethodDelete,
		Path:        "/api/v1/test-case-steps/{id}",
		Summary:     "删除用例步骤",
		Description: "至少保留 1 个步骤，删除后重排序号。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *StepIDInput) (*struct{}, error) {
		if err := handler.service.DeleteStep(ctx, input.ID); err != nil {
			return nil, toAPIError(err, "删除用例步骤失败")
		}
		return &struct{}{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "move-test-case-step",
		Method:      http.MethodPost,
		Path:        "/api/v1/test-case-steps/{id}/move",
		Summary:     "移动用例步骤",
		Description: "移动步骤到目标位置并重排序号。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *MoveStepInput) (*struct{}, error) {
		if err := handler.service.MoveStep(ctx, input.ID, input.Body.TargetIndex); err != nil {
			return nil, toAPIError(err, "移动用例步骤失败")
		}
		return &struct{}{}, nil
	})
}
