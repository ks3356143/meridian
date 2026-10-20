package testitems

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	testitemsservice "chenmeridian/internal/modules/testitems"
)

type StaticWorkbenchOutput struct {
	Body testitemsservice.StaticWorkbench
}

type SaveStaticWorkbenchInput struct {
	TestItemID string `path:"id"`
	Body       struct {
		ExpectedVersion int64                        `json:"expectedVersion"`
		State           testitemsservice.StaticState `json:"state"`
	}
}

type StaticEnsureInput struct {
	Code string `path:"code"`
}

type StaticEnsureOutput struct {
	Body struct {
		Created []testitemsservice.TestItem `json:"created"`
	}
}

type StaticDeleteOutput struct {
	Body struct {
		Removed int64 `json:"removed"`
	}
}

func registerStaticWorkbenches(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-static-test-workbench",
		Method:      http.MethodGet,
		Path:        "/api/v1/test-items/{id}/static-workbench",
		Summary:     "静态测试工作台",
		Description: "读取 DC/SA/CR/CW 专属数据；首次访问按类型初始化。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *ItemIDInput) (*StaticWorkbenchOutput, error) {
		body, err := handler.service.GetStaticWorkbench(ctx, input.ID)
		if err != nil {
			return nil, toAPIError(err, "查询静态测试工作台失败")
		}
		return &StaticWorkbenchOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "save-static-test-workbench",
		Method:      http.MethodPut,
		Path:        "/api/v1/test-items/{id}/static-workbench",
		Summary:     "保存静态测试工作台",
		Description: "带版本号保存；版本冲突返回 409，避免多窗口互相覆盖。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *SaveStaticWorkbenchInput) (*StaticWorkbenchOutput, error) {
		body, err := handler.service.SaveStaticWorkbench(ctx, input.TestItemID, input.Body.ExpectedVersion, input.Body.State)
		if err != nil {
			return nil, toAPIError(err, "保存静态测试工作台失败")
		}
		return &StaticWorkbenchOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "ensure-recommended-static-items",
		Method:      http.MethodPost,
		Path:        "/api/v1/projects/{code}/static-items/ensure",
		Summary:     "补齐推荐静态测试项",
		Description: "按项目安全等级与平台创建缺失的 DC/SA/CR/CW，不覆盖既有内容。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *StaticEnsureInput) (*StaticEnsureOutput, error) {
		projectID, err := handler.projectID(ctx, input.Code)
		if err != nil {
			return nil, toAPIError(err, "项目不存在")
		}
		created, err := handler.service.EnsureRecommendedStaticItems(ctx, projectID, true)
		if err != nil {
			return nil, toAPIError(err, "生成静态测试项失败")
		}
		output := &StaticEnsureOutput{}
		output.Body.Created = nonNil(created)
		return output, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "delete-project-static-items",
		Method:      http.MethodDelete,
		Path:        "/api/v1/projects/{code}/static-items",
		Summary:     "删除项目静态测试项",
		Description: "删除项目内全部静态测试项及其工作台数据；用户主动删除后不自动回填。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *StaticEnsureInput) (*StaticDeleteOutput, error) {
		projectID, err := handler.projectID(ctx, input.Code)
		if err != nil {
			return nil, toAPIError(err, "项目不存在")
		}
		removed, err := handler.service.DeleteAllStaticItems(ctx, projectID)
		if err != nil {
			return nil, toAPIError(err, "删除静态测试项失败")
		}
		return &StaticDeleteOutput{Body: struct {
			Removed int64 `json:"removed"`
		}{Removed: removed}}, nil
	})
}
