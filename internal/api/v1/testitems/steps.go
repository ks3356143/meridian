package testitems

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	contentblocksservice "chenmeridian/internal/modules/contentblocks"
	testitemsservice "chenmeridian/internal/modules/testitems"
)

type ListStepsInput struct {
	ID string `path:"id" doc:"用例 id"`
}

type StepsOutput struct {
	Body []testitemsservice.StepView
}

type StepOutput struct {
	Body testitemsservice.CaseStep
}

type StepViewOutput struct {
	Body testitemsservice.StepView
}

type SaveStepBlocksInput struct {
	ID   string `path:"id"`
	Body struct {
		Op  *contentblocksservice.Node `json:"op,omitempty" doc:"输入及操作文档；与 act 至少提交一个"`
		Act *contentblocksservice.Node `json:"act,omitempty" doc:"实测结果文档；与 op 至少提交一个"`
	}
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

type ImportStepInput struct {
	CaseID string `path:"id" doc:"目标用例 id"`
	Body   struct {
		SourceStepID string `json:"sourceStepId" doc:"源步骤 id（同项目内任意用例）"`
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
		steps, err := handler.service.ListStepsWithBlocks(ctx, input.ID)
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
		OperationID: "save-test-case-step-blocks",
		Method:      http.MethodPut,
		Path:        "/api/v1/test-case-steps/{id}/blocks",
		Summary:     "保存步骤富文本块",
		Description: "保存「输入及操作」（禁表格）或「实测结果」，返回更新后的步骤视图；两者至少提交一个。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *SaveStepBlocksInput) (*StepViewOutput, error) {
		var view testitemsservice.StepView
		saved := false
		if input.Body.Op != nil {
			updated, err := handler.service.SaveStepBlock(ctx, input.ID, contentblocksservice.StepKindOp, *input.Body.Op, currentUserID(ctx))
			if err != nil {
				return nil, toAPIError(err, "保存输入及操作失败")
			}
			view, saved = updated, true
		}
		if input.Body.Act != nil {
			updated, err := handler.service.SaveStepBlock(ctx, input.ID, contentblocksservice.StepKindAct, *input.Body.Act, currentUserID(ctx))
			if err != nil {
				return nil, toAPIError(err, "保存实测结果失败")
			}
			view, saved = updated, true
		}
		if !saved {
			return nil, huma.Error422UnprocessableEntity("请至少提交一个内容块（op / act）")
		}
		return &StepViewOutput{Body: view}, nil
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
		OperationID: "insert-test-case-step-before",
		Method:      http.MethodPost,
		Path:        "/api/v1/test-case-steps/{id}/insert-before",
		Summary:     "上方插入步骤",
		Description: "在目标步骤上方插入一个空步骤（步骤表快捷键 Ctrl+Shift+Enter）。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *StepIDInput) (*StepOutput, error) {
		step, err := handler.service.InsertStepBefore(ctx, input.ID)
		if err != nil {
			return nil, toAPIError(err, "插入用例步骤失败")
		}
		return &StepOutput{Body: step}, nil
	})
	huma.Register(api, huma.Operation{
		OperationID: "import-test-case-step",
		Method:      http.MethodPost,
		Path:        "/api/v1/test-cases/{id}/steps/import",
		Summary:     "导入步骤到用例末尾",
		Description: "把源步骤的设计内容（期望结果 + 输入及操作块）复制到目标用例末尾（跨用例复制步骤）。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *ImportStepInput) (*StepOutput, error) {
		step, err := handler.service.ImportStep(ctx, input.CaseID, input.Body.SourceStepID)
		if err != nil {
			return nil, toAPIError(err, "粘贴步骤失败")
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
