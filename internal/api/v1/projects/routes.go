package projects

import (
	"context"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	projectservice "chenmeridian/internal/modules/projects"
)

type Handler struct {
	service *projectservice.Service
}

func Register(api huma.API, service *projectservice.Service) {
	handler := &Handler{service: service}

	registerDictionaryManagement(api, handler)
	registerStandardManagement(api, handler)

	huma.Register(api, huma.Operation{
		OperationID: "list-projects",
		Method:      http.MethodGet,
		Path:        "/api/v1/projects",
		Summary:     "项目列表",
		Description: "返回当前系统的全部项目及其基础字典、依据标准和成员信息。",
		Tags:        []string{"项目管理"},
	}, func(ctx context.Context, input *struct{}) (*ProjectListOutput, error) {
		items, err := handler.service.List(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("查询项目列表失败")
		}
		return &ProjectListOutput{Body: items}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "get-project",
		Method:      http.MethodGet,
		Path:        "/api/v1/projects/{code}",
		Summary:     "项目详情",
		Description: "按项目标识查询项目详情。",
		Tags:        []string{"项目管理"},
	}, func(ctx context.Context, input *ProjectDetailInput) (*ProjectOutput, error) {
		project, err := handler.service.FindByCode(ctx, input.Code)
		if err != nil {
			if errors.Is(err, projectservice.ErrProjectNotFound) {
				return nil, huma.Error404NotFound("项目不存在")
			}
			return nil, huma.Error500InternalServerError("查询项目失败")
		}
		return &ProjectOutput{Body: project}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "get-project-options",
		Method:      http.MethodGet,
		Path:        "/api/v1/project-options",
		Summary:     "项目创建选项",
		Description: "返回项目创建需要的技术字典、依据标准和可分配用户。",
		Tags:        []string{"项目管理"},
	}, func(ctx context.Context, input *struct{}) (*ProjectOptionsOutput, error) {
		options, err := handler.service.Options(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("查询项目创建选项失败")
		}
		return &ProjectOptionsOutput{Body: options}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "create-project",
		Method:      http.MethodPost,
		Path:        "/api/v1/projects",
		Summary:     "创建项目",
		Description: "创建项目基础信息，同时保存技术字典、依据标准和项目成员；项目初始状态为编制大纲中。",
		Tags:        []string{"项目管理"},
	}, func(ctx context.Context, input *CreateProjectInput) (*ProjectOutput, error) {
		project, err := handler.service.Create(ctx, projectservice.CreateProjectInput(input.Body))
		if err != nil {
			switch {
			case errors.Is(err, projectservice.ErrProjectExists):
				return nil, huma.Error409Conflict("项目标识已存在")
			case errors.Is(err, projectservice.ErrUserNotFound):
				return nil, huma.Error400BadRequest("项目负责人或成员不存在")
			case errors.Is(err, projectservice.ErrStandardNotFound):
				return nil, huma.Error400BadRequest("依据标准不存在")
			default:
				return nil, huma.Error500InternalServerError("创建项目失败")
			}
		}
		return &ProjectOutput{Body: project}, nil
	})
}
