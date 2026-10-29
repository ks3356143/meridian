package testitems

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	testitemsservice "chenmeridian/internal/modules/testitems"
)

type LinkRequirementInput struct {
	ItemID string `path:"id"`
	Body   struct {
		RequirementID string `json:"requirementId"`
	}
}

type UnlinkRequirementInput struct {
	ItemID        string `path:"id"`
	RequirementID string `path:"requirementId"`
}

type RequirementRefsOutput struct {
	Body []testitemsservice.RequirementRef
}

type ItemsOutput struct {
	Body []testitemsservice.TestItem
}

type RequirementIDInput struct {
	ID      string `path:"id" doc:"需求 id"`
	RoundID string `query:"roundId" doc:"轮次 id；省略时取当前轮次"`
}

func registerLinks(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "link-test-item-requirement",
		Method:      http.MethodPost,
		Path:        "/api/v1/test-items/{id}/requirements",
		Summary:     "关联需求",
		Description: "建立需求 ↔ 测试项多对多关联；静态测试项（DC/SA/CR/CW）拒绝。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *LinkRequirementInput) (*RequirementRefsOutput, error) {
		item, err := handler.service.GetTestItem(ctx, input.ItemID)
		if err != nil {
			return nil, toAPIError(err, "查询测试项失败")
		}
		if err := handler.service.LinkRequirement(ctx, item.ProjectID, input.ItemID, input.Body.RequirementID); err != nil {
			return nil, toAPIError(err, "关联需求失败")
		}
		refs, err := handler.service.ListRequirements(ctx, input.ItemID)
		if err != nil {
			return nil, toAPIError(err, "查询关联需求失败")
		}
		return &RequirementRefsOutput{Body: nonNil(refs)}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "unlink-test-item-requirement",
		Method:      http.MethodDelete,
		Path:        "/api/v1/test-items/{id}/requirements/{requirementId}",
		Summary:     "解除需求关联",
		Description: "解除需求与测试项的关联。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *UnlinkRequirementInput) (*RequirementRefsOutput, error) {
		if err := handler.service.UnlinkRequirement(ctx, input.ItemID, input.RequirementID); err != nil {
			return nil, toAPIError(err, "解除需求关联失败")
		}
		refs, err := handler.service.ListRequirements(ctx, input.ItemID)
		if err != nil {
			return nil, toAPIError(err, "查询关联需求失败")
		}
		return &RequirementRefsOutput{Body: nonNil(refs)}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "list-requirement-test-items",
		Method:      http.MethodGet,
		Path:        "/api/v1/software-requirements/{id}/test-items",
		Summary:     "需求关联的测试项",
		Description: "返回指定轮次内关联到某需求的测试项；省略 roundId 时取当前轮次。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *RequirementIDInput) (*ItemsOutput, error) {
		items, err := handler.service.ListTestItemsByRequirement(ctx, input.ID, input.RoundID)
		if err != nil {
			return nil, toAPIError(err, "查询测试项失败")
		}
		return &ItemsOutput{Body: nonNil(items)}, nil
	})
}
