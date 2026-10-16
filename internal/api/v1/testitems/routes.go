package testitems

import (
	"context"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	authservice "chenmeridian/internal/auth"
	contentblocksservice "chenmeridian/internal/modules/contentblocks"
	testitemsservice "chenmeridian/internal/modules/testitems"
)

type Handler struct {
	service *testitemsservice.Service
}

func Register(api huma.API, service *testitemsservice.Service) {
	handler := &Handler{service: service}
	registerWorkspace(api, handler)
	registerItems(api, handler)
	registerFolders(api, handler)
	registerSubItems(api, handler)
	registerCases(api, handler)
	registerSteps(api, handler)
	registerLinks(api, handler)
}

func currentUserID(ctx context.Context) string {
	claims, ok := authservice.ClaimsFromContext(ctx)
	if !ok {
		return ""
	}
	return claims.UserID
}

// nonNil 把 nil 切片转为空切片，保证 JSON 输出 [] 而不是 null（前端按数组消费）。
func nonNil[T any](items []T) []T {
	if items == nil {
		return []T{}
	}
	return items
}

// WorkspaceBody 测试项页首屏数据：类型字典 + 第 1 轮 + 文件夹 + 测试项 + 用例摘要 + 树徽章计数。
type WorkspaceBody struct {
	Round   testitemsservice.Round                 `json:"round"`
	Types   []testitemsservice.ItemType            `json:"types"`
	Folders []testitemsservice.Folder              `json:"folders"`
	Items   []testitemsservice.TestItem            `json:"items"`
	Cases   []testitemsservice.Case                `json:"cases"`
	Counts  map[string]testitemsservice.ItemCounts `json:"counts"`
}

type WorkspaceInput struct {
	Code string `path:"code" doc:"项目标识"`
}

type WorkspaceOutput struct {
	Body WorkspaceBody
}

func registerWorkspace(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-test-items-workspace",
		Method:      http.MethodGet,
		Path:        "/api/v1/projects/{code}/test-items",
		Summary:     "测试项工作台数据",
		Description: "返回类型字典、当前轮次、文件夹、测试项与用例摘要；首次访问会懒补齐第 1 轮与静态测试项的默认测试方法。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *WorkspaceInput) (*WorkspaceOutput, error) {
		body, err := handler.workspace(ctx, input.Code)
		if err != nil {
			return nil, toAPIError(err, "查询测试项工作台失败")
		}
		return &WorkspaceOutput{Body: body}, nil
	})
}

func (h *Handler) workspace(ctx context.Context, projectCode string) (WorkspaceBody, error) {
	projectID, err := h.projectID(ctx, projectCode)
	if err != nil {
		return WorkspaceBody{}, err
	}

	round, err := h.service.EnsureRound(ctx, projectID)
	if err != nil {
		return WorkspaceBody{}, err
	}
	// 历史静态测试项懒补齐默认测试方法子项（幂等，不覆盖用户改动）。
	if err := h.service.EnsureStaticItemDefaults(ctx, projectID); err != nil {
		return WorkspaceBody{}, err
	}
	types, err := h.service.ListTypes(ctx)
	if err != nil {
		return WorkspaceBody{}, err
	}
	folders, err := h.service.ListFolders(ctx, projectID)
	if err != nil {
		return WorkspaceBody{}, err
	}
	items, err := h.service.ListTestItems(ctx, projectID)
	if err != nil {
		return WorkspaceBody{}, err
	}
	cases, err := h.service.ListCasesByProject(ctx, projectID)
	if err != nil {
		return WorkspaceBody{}, err
	}
	counts, err := h.service.CountItemChildren(ctx, projectID)
	if err != nil {
		return WorkspaceBody{}, err
	}

	return WorkspaceBody{
		Round:   round,
		Types:   nonNil(types),
		Folders: nonNil(folders),
		Items:   nonNil(items),
		Cases:   nonNil(cases),
		Counts:  counts,
	}, nil
}

type CreateItemInput struct {
	Code string `path:"code" doc:"项目标识"`
	Body struct {
		TypeCode     string  `json:"typeCode" doc:"类型代号，如 SU"`
		Name         string  `json:"name" doc:"测试项名称"`
		Suffix       string  `json:"suffix,omitempty" doc:"标识后缀，留空按名称自动生成"`
		Priority     string  `json:"priority,omitempty" doc:"高/中/低"`
		FolderID     *string `json:"folderId,omitempty"`
		Description  string  `json:"description,omitempty"`
		Adequacy     string  `json:"adequacy,omitempty"`
		PassCriteria string  `json:"passCriteria,omitempty"`
		// ImplicitRequirement 隐含需求：不关联需求时勾选，完善度的追踪关系按已满足计。
		ImplicitRequirement bool `json:"implicitRequirement,omitempty"`
	}
}

type ItemOutput struct {
	Body testitemsservice.TestItem
}

type ItemDetailBody struct {
	Item         testitemsservice.TestItem         `json:"item"`
	SubItems     []testitemsservice.SubItem        `json:"subItems"`
	Requirements []testitemsservice.RequirementRef `json:"requirements"`
	Cases        []testitemsservice.Case           `json:"cases"`
}

type ItemDetailOutput struct {
	Body ItemDetailBody
}

type ItemIDInput struct {
	ID string `path:"id" doc:"测试项 id"`
}

func registerItems(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "create-test-item",
		Method:      http.MethodPost,
		Path:        "/api/v1/projects/{code}/test-items",
		Summary:     "新增测试项",
		Description: "静态类型（DC/SA/CR/CW）自动带一条壳用例；套话按类型预填。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *CreateItemInput) (*ItemOutput, error) {
		projectID, err := handler.projectID(ctx, input.Code)
		if err != nil {
			return nil, toAPIError(err, "项目不存在")
		}
		item, err := handler.service.CreateTestItem(ctx, testitemsservice.CreateTestItemInput{
			ProjectID:    projectID,
			TypeCode:     input.Body.TypeCode,
			Name:         input.Body.Name,
			Suffix:       input.Body.Suffix,
			Priority:     input.Body.Priority,
			FolderID:     input.Body.FolderID,
			Description:  input.Body.Description,
			Adequacy:     input.Body.Adequacy,
			PassCriteria: input.Body.PassCriteria,

			ImplicitRequirement: input.Body.ImplicitRequirement,
		})
		if err != nil {
			return nil, toAPIError(err, "新增测试项失败")
		}
		return &ItemOutput{Body: item}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "get-test-item",
		Method:      http.MethodGet,
		Path:        "/api/v1/test-items/{id}",
		Summary:     "测试项详情",
		Description: "返回测试项、测试子项、关联需求与用例列表。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *ItemIDInput) (*ItemDetailOutput, error) {
		item, err := handler.service.GetTestItem(ctx, input.ID)
		if err != nil {
			return nil, toAPIError(err, "查询测试项失败")
		}
		subItems, err := handler.service.ListSubItems(ctx, input.ID)
		if err != nil {
			return nil, toAPIError(err, "查询测试子项失败")
		}
		requirements, err := handler.service.ListRequirements(ctx, input.ID)
		if err != nil {
			return nil, toAPIError(err, "查询关联需求失败")
		}
		cases, err := handler.service.ListCases(ctx, input.ID)
		if err != nil {
			return nil, toAPIError(err, "查询用例失败")
		}
		return &ItemDetailOutput{Body: ItemDetailBody{
			Item:         item,
			SubItems:     nonNil(subItems),
			Requirements: nonNil(requirements),
			Cases:        nonNil(cases),
		}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "update-test-item",
		Method:      http.MethodPatch,
		Path:        "/api/v1/test-items/{id}",
		Summary:     "更新测试项",
		Description: "行内更新字段；改后缀会同步重排用例标识。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *UpdateItemInput) (*ItemOutput, error) {
		item, err := handler.service.UpdateTestItem(ctx, input.ID, testitemsservice.UpdateTestItemInput{
			TypeCode:     input.Body.TypeCode,
			Name:         input.Body.Name,
			Suffix:       input.Body.Suffix,
			Priority:     input.Body.Priority,
			FolderID:     input.Body.FolderID,
			ClearFolder:  input.Body.ClearFolder,
			Description:  input.Body.Description,
			Adequacy:     input.Body.Adequacy,
			PassCriteria: input.Body.PassCriteria,

			ImplicitRequirement: input.Body.ImplicitRequirement,
		})
		if err != nil {
			return nil, toAPIError(err, "更新测试项失败")
		}
		return &ItemOutput{Body: item}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "delete-test-item",
		Method:      http.MethodDelete,
		Path:        "/api/v1/test-items/{id}",
		Summary:     "删除测试项",
		Description: "级联删除子项、用例与步骤。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *ItemIDInput) (*struct{}, error) {
		if err := handler.service.DeleteTestItem(ctx, input.ID); err != nil {
			return nil, toAPIError(err, "删除测试项失败")
		}
		return &struct{}{}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "duplicate-test-item",
		Method:      http.MethodPost,
		Path:        "/api/v1/test-items/{id}/duplicate",
		Summary:     "复制新增测试项",
		Description: "复制内容字段与测试子项，标识按「-副本」重新生成；追踪关系不复制，静态类型不允许复制。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *ItemIDInput) (*ItemOutput, error) {
		item, err := handler.service.DuplicateItem(ctx, input.ID)
		if err != nil {
			return nil, toAPIError(err, "复制测试项失败")
		}
		return &ItemOutput{Body: item}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "move-test-item",
		Method:      http.MethodPost,
		Path:        "/api/v1/test-items/{id}/move",
		Summary:     "移动测试项",
		Description: "拖拽落位：移到同类型文件夹或类型根目录，并重排容器内顺序。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *MoveItemInput) (*struct{}, error) {
		if err := handler.service.MoveItem(ctx, input.ID, input.Body.FolderID, input.Body.TargetIndex); err != nil {
			return nil, toAPIError(err, "移动测试项失败")
		}
		return &struct{}{}, nil
	})
}

type UpdateItemInput struct {
	ID   string `path:"id"`
	Body struct {
		TypeCode     *string `json:"typeCode,omitempty" doc:"修改类型：标识、用例编号与树分组随之更新；静态四类锁定不可改"`
		Name         *string `json:"name,omitempty"`
		Suffix       *string `json:"suffix,omitempty"`
		Priority     *string `json:"priority,omitempty"`
		FolderID     *string `json:"folderId,omitempty"`
		ClearFolder  bool    `json:"clearFolder,omitempty"`
		Description  *string `json:"description,omitempty"`
		Adequacy     *string `json:"adequacy,omitempty"`
		PassCriteria *string `json:"passCriteria,omitempty"`
		// ImplicitRequirement 隐含需求标记。
		ImplicitRequirement *bool `json:"implicitRequirement,omitempty"`
	}
}

type CreateFolderInput struct {
	Code string `path:"code"`
	Body struct {
		TypeCode string  `json:"typeCode"`
		Name     string  `json:"name"`
		ParentID *string `json:"parentId,omitempty"`
	}
}

type FolderOutput struct {
	Body testitemsservice.Folder
}

type MoveItemInput struct {
	ID   string `path:"id"`
	Body struct {
		FolderID    *string `json:"folderId" doc:"目标文件夹 id；null 表示移到类型根目录"`
		TargetIndex int     `json:"targetIndex" doc:"目标容器内的落点序号"`
	}
}

type FolderIDInput struct {
	ID string `path:"id" doc:"文件夹 id"`
}

type UpdateFolderInput struct {
	ID   string `path:"id"`
	Body struct {
		Name string `json:"name"`
	}
}

func registerFolders(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "create-test-item-folder",
		Method:      http.MethodPost,
		Path:        "/api/v1/projects/{code}/test-item-folders",
		Summary:     "新建测试项文件夹",
		Description: "文件夹限装同一类型测试项，可嵌套。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *CreateFolderInput) (*FolderOutput, error) {
		projectID, err := handler.projectID(ctx, input.Code)
		if err != nil {
			return nil, toAPIError(err, "项目不存在")
		}
		folder, err := handler.service.CreateFolder(ctx, testitemsservice.CreateFolderInput{
			ProjectID: projectID,
			TypeCode:  input.Body.TypeCode,
			Name:      input.Body.Name,
			ParentID:  input.Body.ParentID,
		})
		if err != nil {
			return nil, toAPIError(err, "新建文件夹失败")
		}
		return &FolderOutput{Body: folder}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "update-test-item-folder",
		Method:      http.MethodPatch,
		Path:        "/api/v1/test-item-folders/{id}",
		Summary:     "重命名文件夹",
		Description: "只改名称；类型归属与排序不变。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *UpdateFolderInput) (*FolderOutput, error) {
		folder, err := handler.service.UpdateFolder(ctx, input.ID, input.Body.Name)
		if err != nil {
			return nil, toAPIError(err, "重命名文件夹失败")
		}
		return &FolderOutput{Body: folder}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "delete-test-item-folder",
		Method:      http.MethodDelete,
		Path:        "/api/v1/test-item-folders/{id}",
		Summary:     "删除文件夹",
		Description: "文件夹内测试项移到同类型根目录，不删除测试项。",
		Tags:        []string{"测试项与执行"},
	}, func(ctx context.Context, input *FolderIDInput) (*struct{}, error) {
		if err := handler.service.DeleteFolder(ctx, input.ID); err != nil {
			return nil, toAPIError(err, "删除文件夹失败")
		}
		return &struct{}{}, nil
	})
}

func (h *Handler) projectID(ctx context.Context, projectCode string) (string, error) {
	return h.service.FindProjectID(ctx, projectCode)
}

func toAPIError(err error, fallback string) error {
	switch {
	case errors.Is(err, testitemsservice.ErrProjectNotFound):
		return huma.Error404NotFound("项目不存在")
	case errors.Is(err, testitemsservice.ErrNotFound):
		return huma.Error404NotFound("目标不存在")
	case errors.Is(err, testitemsservice.ErrNameRequired):
		return huma.Error400BadRequest("名称不能为空")
	case errors.Is(err, testitemsservice.ErrTypeNotFound):
		return huma.Error400BadRequest("测试项类型不存在或未启用")
	case errors.Is(err, testitemsservice.ErrTypePlatformMismatch):
		return huma.Error400BadRequest("当前项目平台不适用该测试项类型")
	case errors.Is(err, testitemsservice.ErrStaticNoRequirementLink):
		return huma.Error400BadRequest("静态测试项不建立需求关联")
	case errors.Is(err, testitemsservice.ErrRequirementIncomplete):
		return huma.Error400BadRequest("该需求描述待补全，暂不能建立关联")
	case errors.Is(err, testitemsservice.ErrSwitchToStaticWithLinks):
		return huma.Error400BadRequest("该测试项已关联需求，不能改为静态测试项（请先解除关联）")
	case errors.Is(err, testitemsservice.ErrStaticTypeLocked):
		return huma.Error400BadRequest("静态测试项的类型不可修改")
	case errors.Is(err, testitemsservice.ErrStaticTypeDuplicate):
		return huma.Error400BadRequest("静态测试项不支持复制新增，请用「新增测试项」按类型创建")
	case errors.Is(err, testitemsservice.ErrFolderMismatch):
		return huma.Error400BadRequest("目标文件夹与测试项类型不一致")
	case errors.Is(err, testitemsservice.ErrSuffixExhausted):
		return huma.Error400BadRequest("名称前缀相同的测试项过多，标识自动生成失败；请在「新增测试项」里手工指定标识后缀")
	case errors.Is(err, testitemsservice.ErrImplicitWithRequirement):
		return huma.Error400BadRequest("已关联需求的测试项不能标记为隐含需求（先解除关联）")
	case errors.Is(err, testitemsservice.ErrStaticTypeExists):
		return huma.Error400BadRequest("同一轮次只能创建一个该类型静态测试项（DC/SA/CR/CW 各一个）")
	case errors.Is(err, testitemsservice.ErrImportAcrossProjects):
		return huma.Error400BadRequest("只能在同一项目内的用例之间复制步骤")
	}
	// 步骤富文本块的内容校验失败（如「输入及操作」出现表格）按 422 返回。
	var validationErr *contentblocksservice.ValidationError
	if errors.As(err, &validationErr) {
		return huma.Error422UnprocessableEntity(validationErr.Error())
	}
	return huma.Error500InternalServerError(fallback)
}
