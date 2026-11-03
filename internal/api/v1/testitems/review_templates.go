package testitems

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	testitemsservice "chenmeridian/internal/modules/testitems"
)

type ReviewChecklistListOutput struct {
	Body struct {
		Items []testitemsservice.ReviewChecklistTemplate `json:"items"`
	}
}

type ReviewChecklistOutput struct {
	Body testitemsservice.ReviewChecklistTemplate
}

type ReviewChecklistIDInput struct {
	ID string `path:"id"`
}

type ReviewChecklistSaveInput struct {
	ID   string `path:"id"`
	Body testitemsservice.ReviewChecklistTemplateInput
}

func registerReviewChecklists(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "list-review-checklists",
		Method:      http.MethodGet,
		Path:        "/api/v1/review-checklists",
		Summary:     "审查单模板列表",
		Description: "返回管理员维护的文档审查单模板与检查项；首次访问写入内置 4 张模板。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, _ *struct{}) (*ReviewChecklistListOutput, error) {
		items, err := handler.service.ListReviewChecklistTemplates(ctx)
		if err != nil {
			return nil, toAPIError(err, "查询审查单模板失败")
		}
		output := &ReviewChecklistListOutput{}
		output.Body.Items = nonNil(items)
		return output, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "create-review-checklist",
		Method:      http.MethodPost,
		Path:        "/api/v1/review-checklists",
		Summary:     "新建审查单模板",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *struct {
		Body testitemsservice.ReviewChecklistTemplateInput
	}) (*ReviewChecklistOutput, error) {
		template, err := handler.service.CreateReviewChecklistTemplate(ctx, input.Body)
		if err != nil {
			return nil, toAPIError(err, "新建审查单模板失败")
		}
		return &ReviewChecklistOutput{Body: template}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "update-review-checklist",
		Method:      http.MethodPut,
		Path:        "/api/v1/review-checklists/{id}",
		Summary:     "保存审查单模板",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *ReviewChecklistSaveInput) (*ReviewChecklistOutput, error) {
		template, err := handler.service.UpdateReviewChecklistTemplate(ctx, input.ID, input.Body)
		if err != nil {
			return nil, toAPIError(err, "保存审查单模板失败")
		}
		return &ReviewChecklistOutput{Body: template}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "delete-review-checklist",
		Method:      http.MethodDelete,
		Path:        "/api/v1/review-checklists/{id}",
		Summary:     "删除审查单模板",
		Description: "已绑定到测试项的审查单是快照，删除模板不影响既有审查单。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *ReviewChecklistIDInput) (*struct{}, error) {
		if err := handler.service.DeleteReviewChecklistTemplate(ctx, input.ID); err != nil {
			return nil, toAPIError(err, "删除审查单模板失败")
		}
		return &struct{}{}, nil
	})
}
