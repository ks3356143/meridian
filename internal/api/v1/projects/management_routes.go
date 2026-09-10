package projects

import (
	"context"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	projectservice "chenmeridian/internal/modules/projects"
)

func registerDictionaryManagement(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "list-dictionaries",
		Method:      http.MethodGet,
		Path:        "/api/v1/dictionaries",
		Summary:     "技术字典列表",
		Description: "返回全部技术字典，包含已停用项。",
		Tags:        []string{"字典配置"},
	}, func(ctx context.Context, input *struct{}) (*DictionaryListOutput, error) {
		items, err := handler.service.ListDictionaryManagement(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("查询技术字典失败")
		}
		return &DictionaryListOutput{Body: items}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "create-dictionary",
		Method:      http.MethodPost,
		Path:        "/api/v1/dictionaries",
		Summary:     "新增技术字典",
		Description: "新增编程语言、运行环境或开发环境字典项。",
		Tags:        []string{"字典配置"},
	}, func(ctx context.Context, input *CreateDictionaryInput) (*DictionaryOutput, error) {
		item, err := handler.service.CreateDictionary(ctx, toSaveDictionaryInput(input.Body))
		if err != nil {
			return nil, dictionaryError(err, "新增技术字典失败")
		}
		return &DictionaryOutput{Body: item}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "update-dictionary",
		Method:      http.MethodPut,
		Path:        "/api/v1/dictionaries/{id}",
		Summary:     "编辑技术字典",
		Description: "编辑技术字典类型、名称、排序和启用状态。",
		Tags:        []string{"字典配置"},
	}, func(ctx context.Context, input *UpdateDictionaryInput) (*DictionaryOutput, error) {
		item, err := handler.service.UpdateDictionary(ctx, input.ID, toSaveDictionaryInput(input.Body))
		if err != nil {
			return nil, dictionaryError(err, "保存技术字典失败")
		}
		return &DictionaryOutput{Body: item}, nil
	})
}

func registerStandardManagement(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "list-reference-standards",
		Method:      http.MethodGet,
		Path:        "/api/v1/reference-standards",
		Summary:     "依据标准列表",
		Description: "返回全部依据标准，包含已停用项。",
		Tags:        []string{"字典配置"},
	}, func(ctx context.Context, input *struct{}) (*ReferenceStandardListOutput, error) {
		items, err := handler.service.ListStandardManagement(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("查询依据标准失败")
		}
		return &ReferenceStandardListOutput{Body: items}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "create-reference-standard",
		Method:      http.MethodPost,
		Path:        "/api/v1/reference-standards",
		Summary:     "新增依据标准",
		Description: "新增测评大纲可引用的标准或管理文件。",
		Tags:        []string{"字典配置"},
	}, func(ctx context.Context, input *CreateReferenceStandardInput) (*ReferenceStandardOutput, error) {
		item, err := handler.service.CreateStandard(ctx, toSaveStandardInput(input.Body))
		if err != nil {
			return nil, standardError(err, "新增依据标准失败")
		}
		return &ReferenceStandardOutput{Body: item}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "update-reference-standard",
		Method:      http.MethodPut,
		Path:        "/api/v1/reference-standards/{id}",
		Summary:     "编辑依据标准",
		Description: "编辑依据标准名称、标识、发布日期、来源、排序和启用状态。",
		Tags:        []string{"字典配置"},
	}, func(ctx context.Context, input *UpdateReferenceStandardInput) (*ReferenceStandardOutput, error) {
		item, err := handler.service.UpdateStandard(ctx, input.ID, toSaveStandardInput(input.Body))
		if err != nil {
			return nil, standardError(err, "保存依据标准失败")
		}
		return &ReferenceStandardOutput{Body: item}, nil
	})
}

func toSaveDictionaryInput(request SaveDictionaryRequest) projectservice.SaveDictionaryInput {
	return projectservice.SaveDictionaryInput{
		Category:  request.Category,
		Name:      request.Name,
		SortOrder: request.SortOrder,
		IsEnabled: request.IsEnabled,
	}
}

func toSaveStandardInput(request SaveReferenceStandardRequest) projectservice.SaveReferenceStandardInput {
	return projectservice.SaveReferenceStandardInput{
		Name:          request.Name,
		Code:          request.Code,
		PublishedDate: request.PublishedDate,
		Source:        request.Source,
		SortOrder:     request.SortOrder,
		IsEnabled:     request.IsEnabled,
	}
}

func dictionaryError(err error, fallback string) error {
	switch {
	case errors.Is(err, projectservice.ErrDictionaryExists):
		return huma.Error409Conflict("同类技术字典名称已存在")
	case errors.Is(err, projectservice.ErrDictionaryNotFound):
		return huma.Error404NotFound("技术字典不存在")
	default:
		return huma.Error500InternalServerError(fallback)
	}
}

func standardError(err error, fallback string) error {
	switch {
	case errors.Is(err, projectservice.ErrStandardExists):
		return huma.Error409Conflict("依据标准名称已存在")
	case errors.Is(err, projectservice.ErrStandardNotFound):
		return huma.Error404NotFound("依据标准不存在")
	default:
		return huma.Error500InternalServerError(fallback)
	}
}
func registerRelatedPartyManagement(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "list-related-parties",
		Method:      http.MethodGet,
		Path:        "/api/v1/related-parties",
		Summary:     "相关方字典列表",
		Description: "返回全部相关方字典，包含已停用项。",
		Tags:        []string{"字典配置"},
	}, func(ctx context.Context, input *struct{}) (*RelatedPartyListOutput, error) {
		items, err := handler.service.ListRelatedPartyManagement(ctx)
		if err != nil {
			return nil, huma.Error500InternalServerError("查询相关方字典失败")
		}
		return &RelatedPartyListOutput{Body: items}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "create-related-party",
		Method:      http.MethodPost,
		Path:        "/api/v1/related-parties",
		Summary:     "新增相关方",
		Description: "新增委托方、研制方或测评中心条目。",
		Tags:        []string{"字典配置"},
	}, func(ctx context.Context, input *CreateRelatedPartyInput) (*RelatedPartyOutput, error) {
		item, err := handler.service.CreateRelatedParty(ctx, toSaveRelatedPartyInput(input.Body))
		if err != nil {
			return nil, relatedPartyError(err, "新增相关方失败")
		}
		return &RelatedPartyOutput{Body: item}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "update-related-party",
		Method:      http.MethodPut,
		Path:        "/api/v1/related-parties/{id}",
		Summary:     "编辑相关方",
		Description: "编辑相关方类别、名称、排序和启用状态。",
		Tags:        []string{"字典配置"},
	}, func(ctx context.Context, input *UpdateRelatedPartyInput) (*RelatedPartyOutput, error) {
		item, err := handler.service.UpdateRelatedParty(ctx, input.ID, toSaveRelatedPartyInput(input.Body))
		if err != nil {
			return nil, relatedPartyError(err, "保存相关方失败")
		}
		return &RelatedPartyOutput{Body: item}, nil
	})
}

func toSaveRelatedPartyInput(request SaveRelatedPartyRequest) projectservice.SaveRelatedPartyInput {
	return projectservice.SaveRelatedPartyInput{
		Category:  request.Category,
		Name:      request.Name,
		Contact:   request.Contact,
		Phone:     request.Phone,
		Address:   request.Address,
		SortOrder: request.SortOrder,
		IsEnabled: request.IsEnabled,
	}
}

func relatedPartyError(err error, fallback string) error {
	switch {
	case errors.Is(err, projectservice.ErrRelatedPartyExists):
		return huma.Error409Conflict("同类相关方名称已存在")
	case errors.Is(err, projectservice.ErrRelatedPartyNotFound):
		return huma.Error404NotFound("相关方不存在")
	default:
		return huma.Error500InternalServerError(fallback)
	}
}
