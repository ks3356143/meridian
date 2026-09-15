package assets

import (
	"context"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	authservice "chenmeridian/internal/auth"
	assetservice "chenmeridian/internal/modules/assets"
)

type Handler struct {
	service *assetservice.Service
}

func Register(api huma.API, service *assetservice.Service) {
	handler := &Handler{service: service}

	huma.Register(api, huma.Operation{
		OperationID: "list-work-objects",
		Method:      http.MethodGet,
		Path:        "/api/v1/projects/{code}/work-objects",
		Summary:     "工作对象版本列表",
		Description: "返回项目全部接收文件、手工登记对象及其版本状态。",
		Tags:        []string{"资料与对象"},
	}, func(ctx context.Context, input *WorkObjectListInput) (*WorkObjectListOutput, error) {
		items, err := handler.service.List(ctx, input.Code)
		if err != nil {
			if errors.Is(err, assetservice.ErrProjectNotFound) {
				return nil, huma.Error404NotFound("项目不存在")
			}
			return nil, huma.Error500InternalServerError("查询工作对象失败")
		}
		return &WorkObjectListOutput{Body: items}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "upload-work-objects",
		Method:      http.MethodPost,
		Path:        "/api/v1/projects/{code}/work-objects/upload",
		Summary:     "批量上传接收文件",
		Description: "上传接收文件并生成待确认的工作对象版本；服务端按文件名预识别类型、版本和平台。",
		Tags:        []string{"资料与对象"},
	}, func(ctx context.Context, input *WorkObjectUploadInput) (*WorkObjectUploadOutput, error) {
		form := input.RawBody.Data()
		files := make([]assetservice.UploadFile, 0, len(form.Files))
		for _, file := range form.Files {
			uploadFile := file
			defer uploadFile.Close()
			files = append(files, assetservice.UploadFile{
				Reader:       uploadFile,
				OriginalName: uploadFile.Filename,
				MimeType:     uploadFile.ContentType,
				Size:         uploadFile.Size,
			})
		}

		items, err := handler.service.Upload(ctx, assetservice.UploadInput{
			ProjectCode: input.Code,
			Source:      form.Source,
			ReceivedAt:  form.ReceivedAt,
			ReceiveMode: form.ReceiveMode,
			CreatedBy:   currentUserID(ctx),
			Files:       files,
		})
		if err != nil {
			return nil, toAPIError(err, "上传接收文件失败")
		}
		return &WorkObjectUploadOutput{Body: items}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "create-manual-work-object",
		Method:      http.MethodPost,
		Path:        "/api/v1/projects/{code}/work-objects/manual",
		Summary:     "手工登记工作对象",
		Description: "登记尚未取得电子文件的工作对象版本。",
		Tags:        []string{"资料与对象"},
	}, func(ctx context.Context, input *ManualWorkObjectInput) (*WorkObjectOutput, error) {
		item, err := handler.service.CreateManual(ctx, assetservice.ManualInput{
			ProjectCode: input.Code,
			ObjectKind:  input.Body.ObjectKind,
			ObjectName:  input.Body.ObjectName,
			Version:     input.Body.Version,
			Source:      input.Body.Source,
			ReceivedAt:  input.Body.ReceivedAt,
			ReceiveMode: input.Body.ReceiveMode,
			CreatedBy:   currentUserID(ctx),
		})
		if err != nil {
			return nil, toAPIError(err, "手工登记工作对象失败")
		}
		return &WorkObjectOutput{Body: item}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "update-work-object-version",
		Method:      http.MethodPut,
		Path:        "/api/v1/work-object-versions/{id}",
		Summary:     "修改工作对象版本",
		Description: "修改对象类型、名称、版本和接收信息；已确认版本必须填写纠错原因，原始文件信息保持不变。",
		Tags:        []string{"资料与对象"},
	}, func(ctx context.Context, input *UpdateWorkObjectInput) (*WorkObjectOutput, error) {
		item, err := handler.service.Update(ctx, assetservice.UpdateInput{
			ID:               input.ID,
			ObjectKind:       input.Body.ObjectKind,
			ObjectName:       input.Body.ObjectName,
			Version:          input.Body.Version,
			Source:           input.Body.Source,
			ReceivedAt:       input.Body.ReceivedAt,
			ReceiveMode:      input.Body.ReceiveMode,
			CorrectionReason: input.Body.CorrectionReason,
			OperatedBy:       currentUserID(ctx),
		})
		if err != nil {
			return nil, toAPIError(err, "修改工作对象失败")
		}
		return &WorkObjectOutput{Body: item}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "confirm-work-object-version",
		Method:      http.MethodPost,
		Path:        "/api/v1/work-object-versions/{id}/confirm",
		Summary:     "确认工作对象版本",
		Description: "把待确认版本确认成正式工作对象版本。",
		Tags:        []string{"资料与对象"},
	}, func(ctx context.Context, input *VersionIDInput) (*WorkObjectOutput, error) {
		item, err := handler.service.Confirm(ctx, input.ID, currentUserID(ctx))
		if err != nil {
			return nil, toAPIError(err, "确认工作对象失败")
		}
		return &WorkObjectOutput{Body: item}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "withdraw-work-object-version",
		Method:      http.MethodPost,
		Path:        "/api/v1/work-object-versions/{id}/withdraw",
		Summary:     "撤回工作对象确认",
		Description: "把当前已确认版本撤回为待确认；如它替代过旧版本，则自动恢复旧版本为当前有效版本。",
		Tags:        []string{"资料与对象"},
	}, func(ctx context.Context, input *LifecycleActionInput) (*WorkObjectOutput, error) {
		item, err := handler.service.Withdraw(ctx, assetservice.LifecycleInput{
			VersionID:  input.ID,
			Reason:     input.Body.Reason,
			OperatedBy: currentUserID(ctx),
		})
		if err != nil {
			return nil, toAPIError(err, "撤回确认失败")
		}
		return &WorkObjectOutput{Body: item}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "revoke-work-object-version",
		Method:      http.MethodPost,
		Path:        "/api/v1/work-object-versions/{id}/revoke",
		Summary:     "作废工作对象版本",
		Description: "把当前已确认版本标记为已作废，保留数据库记录和接收文件，并记录原因与操作人。",
		Tags:        []string{"资料与对象"},
	}, func(ctx context.Context, input *LifecycleActionInput) (*WorkObjectOutput, error) {
		item, err := handler.service.Revoke(ctx, assetservice.LifecycleInput{
			VersionID:  input.ID,
			Reason:     input.Body.Reason,
			OperatedBy: currentUserID(ctx),
		})
		if err != nil {
			return nil, toAPIError(err, "作废工作对象失败")
		}
		return &WorkObjectOutput{Body: item}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "list-work-object-lifecycle",
		Method:      http.MethodGet,
		Path:        "/api/v1/work-object-versions/{id}/lifecycle",
		Summary:     "工作对象生命周期记录",
		Description: "返回确认、替代、撤回、恢复和作废的操作审计记录。",
		Tags:        []string{"资料与对象"},
	}, func(ctx context.Context, input *VersionIDInput) (*WorkObjectLifecycleOutput, error) {
		items, err := handler.service.Lifecycle(ctx, input.ID)
		if err != nil {
			return nil, toAPIError(err, "查询生命周期失败")
		}
		return &WorkObjectLifecycleOutput{Body: items}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "delete-work-object-version",
		Method:      http.MethodDelete,
		Path:        "/api/v1/work-object-versions/{id}",
		Summary:     "删除工作对象版本",
		Description: "删除未使用的工作对象版本，并同步删除对应接收文件。",
		Tags:        []string{"资料与对象"},
	}, func(ctx context.Context, input *VersionIDInput) (*struct{}, error) {
		if err := handler.service.Delete(ctx, input.ID); err != nil {
			return nil, toAPIError(err, "删除工作对象失败")
		}
		return nil, nil
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
	case errors.Is(err, assetservice.ErrProjectNotFound):
		return huma.Error404NotFound("项目不存在")
	case errors.Is(err, assetservice.ErrVersionNotFound):
		return huma.Error404NotFound("工作对象版本不存在")
	case errors.Is(err, assetservice.ErrVersionExists):
		return huma.Error409Conflict("同名工作对象同版本已存在，不会覆盖；请提升版本号，或先删除待确认版本")
	case errors.Is(err, assetservice.ErrObjectExists):
		return huma.Error409Conflict("目标工作对象已存在")
	case errors.Is(err, assetservice.ErrVersionNotDraft):
		return huma.Error409Conflict("只有待确认版本允许执行此操作")
	case errors.Is(err, assetservice.ErrVersionNotEditable):
		return huma.Error409Conflict("只有待确认或当前已确认版本允许修改")
	case errors.Is(err, assetservice.ErrVersionNotCurrent):
		return huma.Error409Conflict("只有当前已确认版本允许执行此操作")
	case errors.Is(err, assetservice.ErrReasonRequired):
		return huma.Error400BadRequest("操作原因不能为空")
	case errors.Is(err, assetservice.ErrCorrectionNoChanges):
		return huma.Error400BadRequest("没有需要修正的登记信息")
	case errors.Is(err, assetservice.ErrVersionNotDeletable):
		return huma.Error409Conflict("只有待确认版本允许删除")
	case errors.Is(err, assetservice.ErrInvalidVersion):
		return huma.Error400BadRequest("版本号格式应为 V1.00")
	default:
		return huma.Error500InternalServerError(fallback)
	}
}
