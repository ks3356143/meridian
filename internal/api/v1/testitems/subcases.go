package testitems

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	testitemsservice "chenmeridian/internal/modules/testitems"
)

type CreateSubItemInput struct {
	TestItemID string `path:"id"`
	Body       struct {
		Name string `json:"name"`
	}
}

type SubItemOutput struct {
	Body testitemsservice.SubItem
}

type SubItemIDInput struct {
	ID string `path:"id"`
}

type UpdateSubItemInput struct {
	ID   string `path:"id"`
	Body struct {
		Name        *string `json:"name,omitempty"`
		Description *string `json:"description,omitempty"`
		Ops         *string `json:"ops,omitempty" doc:"操作步骤（多行文本，行数与通过准则 1:1）"`
		Expected    *string `json:"expected,omitempty" doc:"通过准则/预期结果（多行文本）"`
	}
}

type MoveSubItemInput struct {
	ID   string `path:"id"`
	Body struct {
		TargetIndex int `json:"targetIndex" doc:"目标位置，0 起"`
	}
}

func registerSubItems(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "create-test-sub-item",
		Method:      http.MethodPost,
		Path:        "/api/v1/test-items/{id}/sub-items",
		Summary:     "新增测试子项",
		Description: "在测试项末尾追加子项，序号自动排到末尾。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *CreateSubItemInput) (*SubItemOutput, error) {
		sub, err := handler.service.CreateSubItem(ctx, input.TestItemID, input.Body.Name)
		if err != nil {
			return nil, toAPIError(err, "新增测试子项失败")
		}
		return &SubItemOutput{Body: sub}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "duplicate-test-sub-item",
		Method:      http.MethodPost,
		Path:        "/api/v1/test-sub-items/{id}/duplicate",
		Summary:     "复制测试子项",
		Description: "复制子项到末尾（富文本内容由前端按 block_key 复制）。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *SubItemIDInput) (*SubItemOutput, error) {
		sub, err := handler.service.CopySubItem(ctx, input.ID)
		if err != nil {
			return nil, toAPIError(err, "复制测试子项失败")
		}
		return &SubItemOutput{Body: sub}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "update-test-sub-item",
		Method:      http.MethodPatch,
		Path:        "/api/v1/test-sub-items/{id}",
		Summary:     "更新测试子项",
		Description: "行内更新子项名称、描述、操作步骤与通过准则。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *UpdateSubItemInput) (*SubItemOutput, error) {
		sub, err := handler.service.UpdateSubItem(ctx, input.ID, testitemsservice.UpdateSubItemInput{
			Name:        input.Body.Name,
			Description: input.Body.Description,
			Ops:         input.Body.Ops,
			Expected:    input.Body.Expected,
		})
		if err != nil {
			return nil, toAPIError(err, "更新测试子项失败")
		}
		return &SubItemOutput{Body: sub}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "delete-test-sub-item",
		Method:      http.MethodDelete,
		Path:        "/api/v1/test-sub-items/{id}",
		Summary:     "删除测试子项",
		Description: "删除后重排剩余子项序号。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *SubItemIDInput) (*struct{}, error) {
		if err := handler.service.DeleteSubItem(ctx, input.ID); err != nil {
			return nil, toAPIError(err, "删除测试子项失败")
		}
		return &struct{}{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "move-test-sub-item",
		Method:      http.MethodPost,
		Path:        "/api/v1/test-sub-items/{id}/move",
		Summary:     "移动测试子项",
		Description: "移动子项到目标位置并重排序号。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *MoveSubItemInput) (*struct{}, error) {
		if err := handler.service.MoveSubItem(ctx, input.ID, input.Body.TargetIndex); err != nil {
			return nil, toAPIError(err, "移动测试子项失败")
		}
		return &struct{}{}, nil
	})
}

type CreateCaseInput struct {
	TestItemID string `path:"id"`
	Body       struct {
		Name string `json:"name"`
	}
}

type CaseOutput struct {
	Body testitemsservice.Case
}

type CaseIDInput struct {
	ID string `path:"id"`
}

type UpdateCaseBody struct {
	Name              *string `json:"name,omitempty"`
	Summary           *string `json:"summary,omitempty"`
	InitText          *string `json:"initText,omitempty"`
	Prerequisites     *string `json:"prerequisites,omitempty"`
	DesignerID        *string `json:"designerId,omitempty"`
	TesterID          *string `json:"testerId,omitempty"`
	MonitorID         *string `json:"monitorId,omitempty"`
	Notes             *string `json:"notes,omitempty"`
	NotExecutedReason *string `json:"notExecutedReason,omitempty"`
	ClearExecDate     bool    `json:"clearExecDate,omitempty"`
}

type UpdateCaseInput struct {
	ID   string `path:"id"`
	Body UpdateCaseBody
}

type MoveCaseInput struct {
	ID   string `path:"id"`
	Body struct {
		TargetItemID string `json:"targetItemId"`
		TargetIndex  int    `json:"targetIndex"`
	}
}

func registerCases(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "create-test-case",
		Method:      http.MethodPost,
		Path:        "/api/v1/test-items/{id}/cases",
		Summary:     "新增用例",
		Description: "在测试项末尾追加用例，标识按 YL_{类型}_{后缀}_{序号} 自动生成。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *CreateCaseInput) (*CaseOutput, error) {
		itemCase, err := handler.service.CreateCase(ctx, input.TestItemID, input.Body.Name)
		if err != nil {
			return nil, toAPIError(err, "新增用例失败")
		}
		return &CaseOutput{Body: itemCase}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "duplicate-test-case",
		Method:      http.MethodPost,
		Path:        "/api/v1/test-cases/{id}/duplicate",
		Summary:     "复制用例",
		Description: "复制用例及其步骤，执行状态重置。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *CaseIDInput) (*CaseOutput, error) {
		itemCase, err := handler.service.DuplicateCase(ctx, input.ID)
		if err != nil {
			return nil, toAPIError(err, "复制用例失败")
		}
		return &CaseOutput{Body: itemCase}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "update-test-case",
		Method:      http.MethodPatch,
		Path:        "/api/v1/test-cases/{id}",
		Summary:     "更新用例",
		Description: "行内更新用例字段（名称、综述、初始化、前提、人员、备注、未执行原因）。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *UpdateCaseInput) (*CaseOutput, error) {
		itemCase, err := handler.service.UpdateCase(ctx, input.ID, testitemsservice.UpdateCaseInput{
			Name:              input.Body.Name,
			Summary:           input.Body.Summary,
			InitText:          input.Body.InitText,
			Prerequisites:     input.Body.Prerequisites,
			DesignerID:        input.Body.DesignerID,
			TesterID:          input.Body.TesterID,
			MonitorID:         input.Body.MonitorID,
			Notes:             input.Body.Notes,
			NotExecutedReason: input.Body.NotExecutedReason,
			ClearExecDate:     input.Body.ClearExecDate,
		})
		if err != nil {
			return nil, toAPIError(err, "更新用例失败")
		}
		return &CaseOutput{Body: itemCase}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "delete-test-case",
		Method:      http.MethodDelete,
		Path:        "/api/v1/test-cases/{id}",
		Summary:     "删除用例",
		Description: "删除后重排同测试项剩余用例的序号与标识。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *CaseIDInput) (*struct{}, error) {
		if err := handler.service.DeleteCase(ctx, input.ID); err != nil {
			return nil, toAPIError(err, "删除用例失败")
		}
		return &struct{}{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "move-test-case",
		Method:      http.MethodPost,
		Path:        "/api/v1/test-cases/{id}/move",
		Summary:     "移动用例",
		Description: "同测试项内排序或跨测试项移动，标识随目标测试项重排。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *MoveCaseInput) (*struct{}, error) {
		if err := handler.service.MoveCase(ctx, input.ID, input.Body.TargetItemID, input.Body.TargetIndex); err != nil {
			return nil, toAPIError(err, "移动用例失败")
		}
		return &struct{}{}, nil
	})
}
