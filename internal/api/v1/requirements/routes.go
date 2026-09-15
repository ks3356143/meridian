package requirements

import (
	"context"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	authservice "chenmeridian/internal/auth"
	requirementsservice "chenmeridian/internal/modules/requirements"
)

type Handler struct {
	service *requirementsservice.Service
}

func Register(api huma.API, service *requirementsservice.Service) {
	handler := &Handler{service: service}

	huma.Register(api, huma.Operation{
		OperationID: "list-requirements-workbench",
		Method:      http.MethodGet,
		Path:        "/api/v1/projects/{code}/requirements",
		Summary:     "需求工作台数据",
		Description: "返回项目当前已确认主 SRS、需求章节树和软件需求。",
		Tags:        []string{"需求与追踪"},
	}, func(ctx context.Context, input *WorkbenchInput) (*WorkbenchOutput, error) {
		body, err := handler.service.Workbench(ctx, input.Code, input.SourceVersionID)
		if err != nil {
			return nil, toAPIError(err, "查询需求工作台失败")
		}
		return &WorkbenchOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "create-requirement-section",
		Method:      http.MethodPost,
		Path:        "/api/v1/projects/{code}/requirement-sections",
		Summary:     "新增需求章节",
		Description: "按 SRS 实际章节号手工建立章节节点；章节不进入追踪矩阵。",
		Tags:        []string{"需求与追踪"},
	}, func(ctx context.Context, input *CreateSectionInput) (*SectionOutput, error) {
		body, err := handler.service.CreateSection(ctx, requirementsservice.CreateSectionInput{
			ProjectCode: input.Code, SourceVersionID: input.Body.SourceVersionID,
			ParentID: input.Body.ParentID, ChapterNumber: input.Body.ChapterNumber,
			Title: input.Body.Title, OperatedBy: currentUserID(ctx),
		})
		if err != nil {
			return nil, toAPIError(err, "新增需求章节失败")
		}
		return &SectionOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "create-software-requirement",
		Method:      http.MethodPost,
		Path:        "/api/v1/projects/{code}/requirements",
		Summary:     "新增软件需求",
		Description: "手工保存正式软件需求，并记录待创建关联测试项契约。",
		Tags:        []string{"需求与追踪"},
	}, func(ctx context.Context, input *CreateRequirementInput) (*RequirementOutput, error) {
		body, err := handler.service.CreateRequirement(ctx, requirementsservice.CreateRequirementInput{
			ProjectCode: input.Code, SourceVersionID: input.Body.SourceVersionID,
			SectionID: input.Body.SectionID, ChapterNumber: input.Body.ChapterNumber,
			ExternalIdentifier: input.Body.ExternalIdentifier, Name: input.Body.Name,
			Description: input.Body.Description, PrimaryKind: input.Body.PrimaryKind,
			Tags: input.Body.Tags, OperatedBy: currentUserID(ctx),
		})
		if err != nil {
			return nil, toAPIError(err, "新增软件需求失败")
		}
		return &RequirementOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "bulk-create-requirements",
		Method:      http.MethodPost,
		Path:        "/api/v1/projects/{code}/requirements/bulk",
		Summary:     "批量录入需求结构",
		Description: "批量粘贴预览确认后，一次性保存章节和正式需求。",
		Tags:        []string{"需求与追踪"},
	}, func(ctx context.Context, input *BulkCreateInput) (*BulkCreateOutput, error) {
		body, err := handler.service.BulkCreate(ctx, requirementsservice.BulkCreateInput{
			ProjectCode: input.Code, SourceVersionID: input.Body.SourceVersionID,
			Items: input.Body.Items, OperatedBy: currentUserID(ctx),
		})
		if err != nil {
			return nil, toAPIError(err, "批量录入需求失败")
		}
		return &BulkCreateOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "parse-srs-requirements",
		Method:      http.MethodPost,
		Path:        "/api/v1/projects/{code}/requirements/parse",
		Summary:     "解析主 SRS",
		Description: "解析当前已确认软件需求规格说明的 DOCX，生成章节和候选需求。",
		Tags:        []string{"需求与追踪"},
	}, func(ctx context.Context, input *ParseInput) (*ParseOutput, error) {
		body, err := handler.service.Parse(ctx, input.Code, input.Body.SourceVersionID, currentUserID(ctx))
		if err != nil {
			return nil, toAPIError(err, "解析主 SRS 失败")
		}
		return &ParseOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "update-software-requirement",
		Method:      http.MethodPut,
		Path:        "/api/v1/software-requirements/{id}",
		Summary:     "修改软件需求",
		Description: "修改候选或正式需求的登记信息，并写入审计事件。",
		Tags:        []string{"需求与追踪"},
	}, func(ctx context.Context, input *UpdateRequirementInput) (*RequirementOutput, error) {
		body, err := handler.service.UpdateRequirement(ctx, requirementsservice.UpdateRequirementInput{
			ID: input.ID, SectionID: input.Body.SectionID,
			ChapterNumber:      input.Body.ChapterNumber,
			ExternalIdentifier: input.Body.ExternalIdentifier, Name: input.Body.Name,
			Description: input.Body.Description, PrimaryKind: input.Body.PrimaryKind,
			Tags: input.Body.Tags, OperatedBy: currentUserID(ctx),
		})
		if err != nil {
			return nil, toAPIError(err, "修改软件需求失败")
		}
		return &RequirementOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "change-requirement-status",
		Method:      http.MethodPost,
		Path:        "/api/v1/projects/{code}/requirements/status",
		Summary:     "确认或排除需求",
		Description: "批量确认候选需求为正式需求，或按原因排除需求。",
		Tags:        []string{"需求与追踪"},
	}, func(ctx context.Context, input *StatusActionInput) (*StatusActionOutput, error) {
		body, err := handler.service.ChangeStatus(ctx, requirementsservice.StatusActionInput{
			ProjectCode: input.Code, IDs: input.Body.IDs, Action: input.Body.Action,
			Reason: input.Body.Reason, OperatedBy: currentUserID(ctx),
		})
		if err != nil {
			return nil, toAPIError(err, "更新需求状态失败")
		}
		return &StatusActionOutput{Body: body}, nil
	})
}

func currentUserID(ctx context.Context) string {
	claims, ok := authservice.ClaimsFromContext(ctx)
	if !ok {
		return ""
	}
	return claims.UserID
}

func toAPIError(err error, fallback string) error {
	switch {
	case errors.Is(err, requirementsservice.ErrProjectNotFound):
		return huma.Error404NotFound("项目不存在")
	case errors.Is(err, requirementsservice.ErrSourceNotFound):
		return huma.Error404NotFound("当前已确认的软件需求规格说明不存在")
	case errors.Is(err, requirementsservice.ErrNoSourceFile):
		return huma.Error400BadRequest("该 SRS 没有电子文件，可先使用树状手动录入")
	case errors.Is(err, requirementsservice.ErrNeedsDocx):
		return huma.Error415UnsupportedMediaType("当前 SRS 为 .doc，需要先转换为 .docx 后解析")
	case errors.Is(err, requirementsservice.ErrSectionNotFound):
		return huma.Error404NotFound("需求章节不存在")
	case errors.Is(err, requirementsservice.ErrParentMissing):
		return huma.Error400BadRequest("父章节不存在，请先按 SRS 实际目录录入父章节")
	case errors.Is(err, requirementsservice.ErrChapterInvalid):
		return huma.Error400BadRequest("章节号必须使用数字层级，例如 3.1.1")
	case errors.Is(err, requirementsservice.ErrSectionExists):
		return huma.Error409Conflict("同一 SRS 版本中章节号已存在")
	case errors.Is(err, requirementsservice.ErrRequirementExists):
		return huma.Error409Conflict("同一 SRS 版本中有效需求章节号已存在")
	case errors.Is(err, requirementsservice.ErrRequirementNotFound):
		return huma.Error404NotFound("软件需求不存在")
	case errors.Is(err, requirementsservice.ErrRequirementNotActive):
		return huma.Error409Conflict("候选或正式需求才允许修改")
	case errors.Is(err, requirementsservice.ErrNoChanges):
		return huma.Error400BadRequest("没有需要修改的需求信息")
	case errors.Is(err, requirementsservice.ErrNoRequirements):
		return huma.Error400BadRequest("没有可操作的需求")
	case errors.Is(err, requirementsservice.ErrReasonRequired):
		return huma.Error400BadRequest("排除需求必须填写原因")
	case errors.Is(err, requirementsservice.ErrInvalidKind):
		return huma.Error400BadRequest("主需求性质不正确")
	default:
		return huma.Error500InternalServerError(fallback)
	}
}
