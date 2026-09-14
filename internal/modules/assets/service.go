package assets

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"gorm.io/gorm"

	"chenmeridian/internal/id"
	"chenmeridian/internal/modules/projects"
)

var (
	ErrProjectNotFound     = errors.New("项目不存在")
	ErrVersionNotFound     = errors.New("工作对象版本不存在")
	ErrVersionExists       = errors.New("同名工作对象版本已存在")
	ErrObjectExists        = errors.New("目标工作对象已存在")
	ErrVersionNotDraft     = errors.New("只有待确认版本允许执行此操作")
	ErrVersionNotCurrent   = errors.New("只有当前已确认版本允许执行此操作")
	ErrReasonRequired      = errors.New("操作原因不能为空")
	ErrVersionNotDeletable = errors.New("只有待确认版本允许删除")
)

const maxFileSize = 2 << 30

var (
	versionPattern       = regexp.MustCompile(`[Vv]\d{1,2}(?:\.\d{1,2}){1,2}`)
	trailingVersion      = regexp.MustCompile(`[\s_-]*[Vv]\d{1,2}(?:\.\d{1,2}){1,2}[\s_-]*$`)
	fileExtensionPattern = regexp.MustCompile(`^[A-Za-z0-9]{1,12}$`)
)

type Service struct {
	db   *gorm.DB
	root string
}

func NewService(db *gorm.DB, storageRoot string) *Service {
	return &Service{db: db, root: storageRoot}
}

type UploadFile struct {
	Reader       io.Reader
	OriginalName string
	MimeType     string
	Size         int64
}

type UploadInput struct {
	ProjectCode string
	Source      string
	ReceivedAt  string
	ReceiveMode string
	CreatedBy   string
	Files       []UploadFile
}

type ManualInput struct {
	ProjectCode string
	ObjectKind  string
	ObjectName  string
	Version     string
	Platform    string
	Source      string
	ReceivedAt  string
	ReceiveMode string
	CreatedBy   string
}

type UpdateInput struct {
	ID          string
	ObjectKind  string
	ObjectName  string
	Version     string
	Platform    string
	Source      string
	ReceivedAt  string
	ReceiveMode string
}

type LifecycleInput struct {
	VersionID  string
	Reason     string
	OperatedBy string
}

type WorkObjectResponse struct {
	ID           string `json:"id"`
	ProjectID    string `json:"projectId"`
	WorkObjectID string `json:"workObjectId"`
	ObjectKind   string `json:"objectKind"`
	ObjectName   string `json:"objectName"`
	OriginalName string `json:"originalName"`
	Version      string `json:"version"`
	Platform     string `json:"platform"`
	Status       string `json:"status"`
	SupersededBy string `json:"supersededBy"`
	Source       string `json:"source"`
	ReceivedAt   string `json:"receivedAt"`
	ReceiveMode  string `json:"receiveMode"`
	FileSize     int64  `json:"fileSize"`
	FileType     string `json:"fileType"`
	MimeType     string `json:"mimeType"`
	SHA256       string `json:"sha256"`
	AssetID      string `json:"assetId"`
	HasLocalFile bool   `json:"hasLocalFile"`
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt"`
}

type LifecycleEventResponse struct {
	ID                   string `json:"id"`
	WorkObjectVersionID  string `json:"workObjectVersionId"`
	Action               string `json:"action"`
	FromStatus           string `json:"fromStatus"`
	ToStatus             string `json:"toStatus"`
	ReplacementVersionID string `json:"replacementVersionId"`
	Reason               string `json:"reason"`
	OperatedBy           string `json:"operatedBy"`
	OperatedAt           string `json:"operatedAt"`
}

func (s *Service) List(ctx context.Context, projectCode string) ([]WorkObjectResponse, error) {
	project, err := s.findProject(ctx, projectCode)
	if err != nil {
		return nil, err
	}
	rows, err := s.listRows(ctx, project.ID)
	if err != nil {
		return nil, err
	}
	return toResponses(rows), nil
}

func (s *Service) Upload(ctx context.Context, input UploadInput) ([]WorkObjectResponse, error) {
	if len(input.Files) == 0 {
		return nil, fmt.Errorf("上传文件不能为空")
	}
	if err := validateReceiveInfo(input.Source, input.ReceivedAt, input.ReceiveMode); err != nil {
		return nil, err
	}

	project, err := s.findProject(ctx, input.ProjectCode)
	if err != nil {
		return nil, err
	}

	type plannedObject struct {
		object WorkObject
		isNew  bool
	}
	type plannedVersion struct {
		version WorkObjectVersion
		asset   ReceivedAsset
	}

	objects := make(map[string]plannedObject)
	versions := make(map[string]plannedVersion)
	savedFiles := make([]string, 0)

	for _, file := range input.Files {
		originalName := sanitizeOriginalName(file.OriginalName)
		if originalName == "" {
			return nil, fmt.Errorf("上传文件名不能为空")
		}
		if file.Size > maxFileSize {
			return nil, fmt.Errorf("文件 %s 超过 2GB 大小限制", originalName)
		}

		objectKind := inferObjectKind(originalName)
		objectName := inferObjectName(originalName)
		if err := validateObject(objectKind, objectName); err != nil {
			return nil, err
		}

		objectKey := strings.ToLower(objectKind + "\x00" + objectName)
		objectPlan, ok := objects[objectKey]
		if !ok {
			var existing WorkObject
			err := s.db.WithContext(ctx).
				Where("project_id = ? AND object_kind = ? AND name = ?", project.ID, objectKind, objectName).
				First(&existing).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				objectID, newErr := id.New()
				if newErr != nil {
					return nil, newErr
				}
				objectPlan = plannedObject{
					object: WorkObject{ID: objectID, ProjectID: project.ID, ObjectKind: objectKind, Name: objectName},
					isNew:  true,
				}
			} else if err != nil {
				return nil, fmt.Errorf("查询工作对象失败: %w", err)
			} else {
				objectPlan = plannedObject{object: existing}
			}
			objects[objectKey] = objectPlan
		}

		versionValue := inferVersion(originalName)
		versionKey := objectPlan.object.ID + "\x00" + strings.ToLower(versionValue)
		if _, exists := versions[versionKey]; exists {
			return nil, fmt.Errorf("上传批次中 %s V%s 重复", objectName, versionValue)
		}

		var count int64
		if err := s.db.WithContext(ctx).Model(&WorkObjectVersion{}).
			Where("work_object_id = ? AND version = ?", objectPlan.object.ID, versionValue).
			Count(&count).Error; err != nil {
			return nil, fmt.Errorf("查询工作对象版本失败: %w", err)
		}
		if count > 0 {
			return nil, ErrVersionExists
		}

		versionID, err := id.New()
		if err != nil {
			return nil, err
		}
		assetID, err := id.New()
		if err != nil {
			return nil, err
		}

		extension := fileExtension(originalName)
		relativePath := path.Join(
			"projects", project.Code, objectPlan.object.ID, versionID,
			assetID+".original."+extension,
		)
		hash, size, err := s.saveFile(relativePath, file.Reader)
		if err != nil {
			return nil, err
		}
		savedFiles = append(savedFiles, relativePath)

		now := time.Now()
		versions[versionKey] = plannedVersion{
			version: WorkObjectVersion{
				ID:           versionID,
				ProjectID:    project.ID,
				WorkObjectID: objectPlan.object.ID,
				Version:      versionValue,
				Platform:     inferPlatform(originalName),
				Status:       "draft",
				Source:       strings.TrimSpace(input.Source),
				ReceivedAt:   input.ReceivedAt,
				ReceiveMode:  input.ReceiveMode,
				CreatedBy:    input.CreatedBy,
				CreatedAt:    now,
				UpdatedAt:    now,
			},
			asset: ReceivedAsset{
				ID:                  assetID,
				ProjectID:           project.ID,
				WorkObjectVersionID: versionID,
				OriginalName:        originalName,
				StoragePath:         filepath.ToSlash(relativePath),
				FileSize:            size,
				FileType:            extension,
				MimeType:            strings.TrimSpace(file.MimeType),
				SHA256:              hash,
				CreatedBy:           input.CreatedBy,
				CreatedAt:           now,
				UpdatedAt:           now,
			},
		}
	}

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		for _, objectPlan := range objects {
			if !objectPlan.isNew {
				continue
			}
			object := objectPlan.object
			object.CreatedAt = now
			object.UpdatedAt = now
			if err := tx.Create(&object).Error; err != nil {
				return fmt.Errorf("保存工作对象失败: %w", err)
			}
		}
		for _, versionPlan := range versions {
			if err := tx.Create(&versionPlan.version).Error; err != nil {
				return fmt.Errorf("保存工作对象版本失败: %w", err)
			}
			if versionPlan.asset.ID != "" {
				if err := tx.Create(&versionPlan.asset).Error; err != nil {
					return fmt.Errorf("保存接收资产失败: %w", err)
				}
			}
		}
		return nil
	})
	if err != nil {
		s.removeFiles(savedFiles)
		return nil, err
	}

	rows, err := s.listRows(ctx, project.ID)
	if err != nil {
		return nil, err
	}
	versionIDs := make(map[string]bool, len(versions))
	for _, versionPlan := range versions {
		versionIDs[versionPlan.version.ID] = true
	}
	result := make([]WorkObjectResponse, 0, len(versionIDs))
	for _, row := range rows {
		if versionIDs[row.ID] {
			result = append(result, toResponse(row))
		}
	}
	return result, nil
}

func (s *Service) CreateManual(ctx context.Context, input ManualInput) (WorkObjectResponse, error) {
	if err := validateObject(input.ObjectKind, input.ObjectName); err != nil {
		return WorkObjectResponse{}, err
	}
	if err := validateReceiveInfo(input.Source, input.ReceivedAt, input.ReceiveMode); err != nil {
		return WorkObjectResponse{}, err
	}
	if strings.TrimSpace(input.Version) == "" {
		return WorkObjectResponse{}, fmt.Errorf("版本不能为空")
	}

	project, err := s.findProject(ctx, input.ProjectCode)
	if err != nil {
		return WorkObjectResponse{}, err
	}

	var object WorkObject
	err = s.db.WithContext(ctx).
		Where("project_id = ? AND object_kind = ? AND name = ?", project.ID, input.ObjectKind, input.ObjectName).
		First(&object).Error
	createdVersionID := ""

	now := time.Now()
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			objectID, idErr := id.New()
			if idErr != nil {
				return idErr
			}
			object = WorkObject{
				ID: objectID, ProjectID: project.ID, ObjectKind: input.ObjectKind,
				Name: strings.TrimSpace(input.ObjectName), CreatedAt: now, UpdatedAt: now,
			}
			if createErr := tx.Create(&object).Error; createErr != nil {
				return fmt.Errorf("保存工作对象失败: %w", createErr)
			}
		} else if err != nil {
			return fmt.Errorf("查询工作对象失败: %w", err)
		}

		var count int64
		if countErr := tx.Model(&WorkObjectVersion{}).
			Where("work_object_id = ? AND version = ?", object.ID, input.Version).
			Count(&count).Error; countErr != nil {
			return fmt.Errorf("查询工作对象版本失败: %w", countErr)
		}
		if count > 0 {
			return ErrVersionExists
		}

		versionID, idErr := id.New()
		if idErr != nil {
			return idErr
		}
		createdVersionID = versionID
		version := WorkObjectVersion{
			ID: versionID, ProjectID: project.ID, WorkObjectID: object.ID,
			Version: strings.TrimSpace(input.Version), Platform: normalizePlatform(input.Platform),
			Status: "draft", Source: strings.TrimSpace(input.Source), ReceivedAt: input.ReceivedAt,
			ReceiveMode: input.ReceiveMode, CreatedBy: input.CreatedBy, CreatedAt: now, UpdatedAt: now,
		}
		return tx.Create(&version).Error
	})
	if err != nil {
		return WorkObjectResponse{}, err
	}
	return s.findResponseByVersionID(ctx, createdVersionID)
}

func (s *Service) Update(ctx context.Context, input UpdateInput) (WorkObjectResponse, error) {
	if err := validateObject(input.ObjectKind, input.ObjectName); err != nil {
		return WorkObjectResponse{}, err
	}
	if err := validateReceiveInfo(input.Source, input.ReceivedAt, input.ReceiveMode); err != nil {
		return WorkObjectResponse{}, err
	}
	if strings.TrimSpace(input.Version) == "" {
		return WorkObjectResponse{}, fmt.Errorf("版本不能为空")
	}

	var current WorkObjectVersion
	if err := s.db.WithContext(ctx).Where("id = ?", input.ID).First(&current).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return WorkObjectResponse{}, ErrVersionNotFound
		}
		return WorkObjectResponse{}, fmt.Errorf("查询工作对象版本失败: %w", err)
	}
	if current.Status != "draft" {
		return WorkObjectResponse{}, ErrVersionNotDraft
	}

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var conflictCount int64
		if err := tx.Model(&WorkObject{}).
			Where(
				"project_id = ? AND object_kind = ? AND name = ? AND id <> ?",
				current.ProjectID, input.ObjectKind, input.ObjectName, current.WorkObjectID,
			).Count(&conflictCount).Error; err != nil {
			return fmt.Errorf("检查工作对象冲突失败: %w", err)
		}
		if conflictCount > 0 {
			return ErrObjectExists
		}

		now := time.Now()
		if err := tx.Model(&WorkObject{}).Where("id = ?", current.WorkObjectID).Updates(map[string]any{
			"object_kind": input.ObjectKind,
			"name":        strings.TrimSpace(input.ObjectName),
			"updated_at":  now,
		}).Error; err != nil {
			return fmt.Errorf("更新工作对象失败: %w", err)
		}

		var versionCount int64
		if err := tx.Model(&WorkObjectVersion{}).
			Where("work_object_id = ? AND version = ? AND id <> ?", current.WorkObjectID, input.Version, current.ID).
			Count(&versionCount).Error; err != nil {
			return fmt.Errorf("检查版本冲突失败: %w", err)
		}
		if versionCount > 0 {
			return ErrVersionExists
		}

		return tx.Model(&WorkObjectVersion{}).Where("id = ?", current.ID).Updates(map[string]any{
			"version":      strings.TrimSpace(input.Version),
			"platform":     normalizePlatform(input.Platform),
			"source":       strings.TrimSpace(input.Source),
			"received_at":  input.ReceivedAt,
			"receive_mode": input.ReceiveMode,
			"updated_at":   now,
		}).Error
	})
	if err != nil {
		return WorkObjectResponse{}, err
	}
	return s.findResponseByVersionID(ctx, current.ID)
}

func (s *Service) Confirm(
	ctx context.Context,
	versionID string,
	operatedBy string,
) (WorkObjectResponse, error) {
	var current WorkObjectVersion
	if err := s.db.WithContext(ctx).Where("id = ?", versionID).First(&current).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return WorkObjectResponse{}, ErrVersionNotFound
		}
		return WorkObjectResponse{}, fmt.Errorf("查询工作对象版本失败: %w", err)
	}
	if current.Status != "draft" {
		return WorkObjectResponse{}, ErrVersionNotDraft
	}

	var object WorkObject
	if err := s.db.WithContext(ctx).Where("id = ?", current.WorkObjectID).First(&object).Error; err != nil {
		return WorkObjectResponse{}, fmt.Errorf("查询工作对象失败: %w", err)
	}
	if err := validateObject(object.ObjectKind, object.Name); err != nil {
		return WorkObjectResponse{}, err
	}
	if err := validateReceiveInfo(current.Source, current.ReceivedAt, current.ReceiveMode); err != nil {
		return WorkObjectResponse{}, err
	}
	if strings.TrimSpace(current.Version) == "" {
		return WorkObjectResponse{}, fmt.Errorf("版本不能为空")
	}

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		var activeVersions []WorkObjectVersion
		if err := tx.
			Where("work_object_id = ? AND status = ? AND id <> ?", current.WorkObjectID, "confirmed", current.ID).
			Find(&activeVersions).Error; err != nil {
			return fmt.Errorf("查询当前有效版本失败: %w", err)
		}

		for _, previous := range activeVersions {
			if err := tx.Model(&WorkObjectVersion{}).Where("id = ?", previous.ID).Updates(map[string]any{
				"status":                   "superseded",
				"superseded_by_version_id": current.ID,
				"updated_at":               now,
			}).Error; err != nil {
				return fmt.Errorf("标记旧版本为已替代失败: %w", err)
			}
			if err := createLifecycleEvent(
				tx, previous.ProjectID, previous.ID, "supersede", "confirmed", "superseded",
				current.ID, "新版本 "+current.Version+" 确认后自动替代", operatedBy, now,
			); err != nil {
				return err
			}
		}

		if err := tx.Model(&WorkObjectVersion{}).Where("id = ?", current.ID).Updates(map[string]any{
			"status":                   "confirmed",
			"superseded_by_version_id": nil,
			"updated_at":               now,
		}).Error; err != nil {
			return fmt.Errorf("确认工作对象失败: %w", err)
		}
		return createLifecycleEvent(
			tx, current.ProjectID, current.ID, "confirm", "draft", "confirmed",
			"", "确认工作对象版本", operatedBy, now,
		)
	})
	if err != nil {
		return WorkObjectResponse{}, err
	}
	return s.findResponseByVersionID(ctx, versionID)
}

func (s *Service) Withdraw(ctx context.Context, input LifecycleInput) (WorkObjectResponse, error) {
	reason := strings.TrimSpace(input.Reason)
	if reason == "" {
		return WorkObjectResponse{}, ErrReasonRequired
	}
	if err := validateReason(reason); err != nil {
		return WorkObjectResponse{}, err
	}

	var current WorkObjectVersion
	if err := s.db.WithContext(ctx).Where("id = ?", input.VersionID).First(&current).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return WorkObjectResponse{}, ErrVersionNotFound
		}
		return WorkObjectResponse{}, fmt.Errorf("查询工作对象版本失败: %w", err)
	}
	if current.Status != "confirmed" {
		return WorkObjectResponse{}, ErrVersionNotCurrent
	}

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		if err := tx.Model(&WorkObjectVersion{}).Where("id = ?", current.ID).Updates(map[string]any{
			"status":                   "draft",
			"superseded_by_version_id": nil,
			"updated_at":               now,
		}).Error; err != nil {
			return fmt.Errorf("撤回确认失败: %w", err)
		}
		if err := createLifecycleEvent(
			tx, current.ProjectID, current.ID, "withdraw", "confirmed", "draft",
			"", reason, input.OperatedBy, now,
		); err != nil {
			return err
		}

		var supersedeEvent LifecycleEvent
		err := tx.
			Where("action = ? AND replacement_version_id = ?", "supersede", current.ID).
			Order("operated_at DESC").
			First(&supersedeEvent).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("查询被替代版本失败: %w", err)
		}

		var previous WorkObjectVersion
		if err := tx.
			Where("id = ? AND status = ?", supersedeEvent.WorkObjectVersionID, "superseded").
			First(&previous).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return fmt.Errorf("查询待恢复版本失败: %w", err)
		}

		if err := tx.Model(&WorkObjectVersion{}).Where("id = ?", previous.ID).Updates(map[string]any{
			"status":                   "confirmed",
			"superseded_by_version_id": nil,
			"updated_at":               now,
		}).Error; err != nil {
			return fmt.Errorf("恢复上一版本失败: %w", err)
		}
		return createLifecycleEvent(
			tx, previous.ProjectID, previous.ID, "restore", "superseded", "confirmed",
			"", "撤回 "+current.Version+" 后恢复为当前版本", input.OperatedBy, now,
		)
	})
	if err != nil {
		return WorkObjectResponse{}, err
	}
	return s.findResponseByVersionID(ctx, current.ID)
}

func (s *Service) Revoke(ctx context.Context, input LifecycleInput) (WorkObjectResponse, error) {
	reason := strings.TrimSpace(input.Reason)
	if reason == "" {
		return WorkObjectResponse{}, ErrReasonRequired
	}
	if err := validateReason(reason); err != nil {
		return WorkObjectResponse{}, err
	}

	var current WorkObjectVersion
	if err := s.db.WithContext(ctx).Where("id = ?", input.VersionID).First(&current).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return WorkObjectResponse{}, ErrVersionNotFound
		}
		return WorkObjectResponse{}, fmt.Errorf("查询工作对象版本失败: %w", err)
	}
	if current.Status != "confirmed" {
		return WorkObjectResponse{}, ErrVersionNotCurrent
	}

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		if err := tx.Model(&WorkObjectVersion{}).Where("id = ?", current.ID).Updates(map[string]any{
			"status":                   "revoked",
			"superseded_by_version_id": nil,
			"updated_at":               now,
		}).Error; err != nil {
			return fmt.Errorf("作废工作对象失败: %w", err)
		}
		return createLifecycleEvent(
			tx, current.ProjectID, current.ID, "revoke", "confirmed", "revoked",
			"", reason, input.OperatedBy, now,
		)
	})
	if err != nil {
		return WorkObjectResponse{}, err
	}
	return s.findResponseByVersionID(ctx, current.ID)
}

func (s *Service) Lifecycle(ctx context.Context, versionID string) ([]LifecycleEventResponse, error) {
	var current WorkObjectVersion
	if err := s.db.WithContext(ctx).Where("id = ?", versionID).First(&current).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrVersionNotFound
		}
		return nil, fmt.Errorf("查询工作对象版本失败: %w", err)
	}

	var events []LifecycleEvent
	if err := s.db.WithContext(ctx).
		Where("work_object_version_id = ?", versionID).
		Order("operated_at DESC, created_at DESC").
		Find(&events).Error; err != nil {
		return nil, fmt.Errorf("查询生命周期记录失败: %w", err)
	}

	result := make([]LifecycleEventResponse, 0, len(events))
	for _, event := range events {
		result = append(result, LifecycleEventResponse{
			ID:                   event.ID,
			WorkObjectVersionID:  event.WorkObjectVersionID,
			Action:               event.Action,
			FromStatus:           event.FromStatus,
			ToStatus:             event.ToStatus,
			ReplacementVersionID: dereference(event.ReplacementVersionID),
			Reason:               event.Reason,
			OperatedBy:           event.OperatedBy,
			OperatedAt:           event.OperatedAt.Format(time.RFC3339),
		})
	}
	return result, nil
}

func (s *Service) Delete(ctx context.Context, versionID string) error {
	row, err := s.findRowByVersionID(ctx, versionID)
	if err != nil {
		return err
	}
	if row.Status != "draft" {
		return ErrVersionNotDeletable
	}

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("work_object_version_id = ?", versionID).Delete(&ReceivedAsset{}).Error; err != nil {
			return fmt.Errorf("删除接收资产失败: %w", err)
		}
		if err := tx.Where("id = ?", versionID).Delete(&WorkObjectVersion{}).Error; err != nil {
			return fmt.Errorf("删除工作对象版本失败: %w", err)
		}
		var count int64
		if err := tx.Model(&WorkObjectVersion{}).Where("work_object_id = ?", row.WorkObjectID).Count(&count).Error; err != nil {
			return fmt.Errorf("检查工作对象版本失败: %w", err)
		}
		if count == 0 {
			if err := tx.Where("id = ?", row.WorkObjectID).Delete(&WorkObject{}).Error; err != nil {
				return fmt.Errorf("删除工作对象失败: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	if row.StoragePath != "" {
		s.removeFiles([]string{row.StoragePath})
	}
	return nil
}

func (s *Service) findProject(ctx context.Context, projectCode string) (projects.Project, error) {
	var project projects.Project
	if err := s.db.WithContext(ctx).
		Where("code = ?", strings.ToUpper(strings.TrimSpace(projectCode))).
		First(&project).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return projects.Project{}, ErrProjectNotFound
		}
		return projects.Project{}, fmt.Errorf("查询项目失败: %w", err)
	}
	return project, nil
}

func (s *Service) listRows(ctx context.Context, projectID string) ([]WorkObjectVersionRow, error) {
	var rows []WorkObjectVersionRow
	err := s.db.WithContext(ctx).
		Table("work_object_versions AS v").
		Select(`
			v.id, v.project_id, v.work_object_id, v.version, v.platform, v.status,
			COALESCE(v.superseded_by_version_id, '') AS superseded_by_version, v.source,
			v.received_at, v.receive_mode, v.created_at, v.updated_at,
			w.object_kind, w.name AS object_name,
			COALESCE(a.id, '') AS asset_id,
			COALESCE(a.original_name, '') AS original_name,
			COALESCE(a.file_size, 0) AS file_size,
			COALESCE(a.file_type, '') AS file_type,
			COALESCE(a.mime_type, '') AS mime_type,
			COALESCE(a.sha256, '') AS sha256,
			COALESCE(a.storage_path, '') AS storage_path
		`).
		Joins("JOIN work_objects AS w ON w.id = v.work_object_id").
		Joins("LEFT JOIN received_assets AS a ON a.work_object_version_id = v.id").
		Where("v.project_id = ?", projectID).
		Order("v.updated_at DESC, w.object_kind ASC, w.name ASC").
		Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("查询工作对象列表失败: %w", err)
	}
	return rows, nil
}

func (s *Service) findRowByVersionID(ctx context.Context, versionID string) (WorkObjectVersionRow, error) {
	var current WorkObjectVersion
	if err := s.db.WithContext(ctx).Where("id = ?", versionID).First(&current).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return WorkObjectVersionRow{}, ErrVersionNotFound
		}
		return WorkObjectVersionRow{}, fmt.Errorf("查询工作对象版本失败: %w", err)
	}

	allRows, err := s.listRows(ctx, current.ProjectID)
	if err != nil {
		return WorkObjectVersionRow{}, err
	}
	for _, row := range allRows {
		if row.ID == versionID {
			return row, nil
		}
	}
	return WorkObjectVersionRow{}, ErrVersionNotFound
}

func (s *Service) findResponseByVersionID(ctx context.Context, versionID string) (WorkObjectResponse, error) {
	row, err := s.findRowByVersionID(ctx, versionID)
	if err != nil {
		return WorkObjectResponse{}, err
	}
	return toResponse(row), nil
}

func (s *Service) saveFile(relativePath string, reader io.Reader) (string, int64, error) {
	absolutePath := filepath.Join(s.root, filepath.FromSlash(relativePath))
	if err := os.MkdirAll(filepath.Dir(absolutePath), 0o750); err != nil {
		return "", 0, fmt.Errorf("创建文件存储目录失败: %w", err)
	}

	file, err := os.OpenFile(absolutePath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o640)
	if err != nil {
		return "", 0, fmt.Errorf("保存接收文件失败: %w", err)
	}
	defer file.Close()

	hash := sha256.New()
	size, err := io.Copy(io.MultiWriter(file, hash), reader)
	if err != nil {
		_ = os.Remove(absolutePath)
		return "", 0, fmt.Errorf("写入接收文件失败: %w", err)
	}
	if size > maxFileSize {
		_ = os.Remove(absolutePath)
		return "", 0, fmt.Errorf("文件超过 2GB 大小限制")
	}
	return hex.EncodeToString(hash.Sum(nil)), size, nil
}

func (s *Service) removeFiles(relativePaths []string) {
	for _, relativePath := range relativePaths {
		if relativePath == "" {
			continue
		}
		absolutePath := filepath.Join(s.root, filepath.FromSlash(relativePath))
		_ = os.Remove(absolutePath)
		_ = os.Remove(filepath.Dir(absolutePath))
		_ = os.Remove(filepath.Dir(filepath.Dir(absolutePath)))
		_ = os.Remove(filepath.Dir(filepath.Dir(filepath.Dir(absolutePath))))
	}
}

func sanitizeOriginalName(value string) string {
	normalized := strings.ReplaceAll(strings.TrimSpace(value), `\`, "/")
	return path.Base(normalized)
}

func inferObjectKind(fileName string) string {
	name := strings.ToLower(fileName)
	switch {
	case strings.Contains(name, ".zip"), strings.Contains(name, ".rar"), strings.Contains(name, ".7z"),
		strings.Contains(name, ".tar"), strings.Contains(name, ".gz"):
		return "code_package"
	case strings.Contains(name, "需求规格说明"), strings.Contains(name, "软件需求"):
		return "srs"
	case strings.Contains(name, "系统规格"):
		return "system_spec"
	case strings.Contains(name, "研制总要求"):
		return "development_requirement"
	case strings.Contains(name, "研制任务书"), strings.Contains(name, "任务书"):
		return "task_book"
	case strings.Contains(name, "技术要求"):
		return "technical_requirement"
	default:
		return "other_reference"
	}
}

func inferObjectName(fileName string) string {
	name := strings.TrimSuffix(strings.TrimSpace(fileName), path.Ext(fileName))
	name = trailingVersion.ReplaceAllString(name, "")
	return strings.NewReplacer("_", " ", "-", " ").Replace(strings.TrimSpace(name))
}

func inferVersion(fileName string) string {
	match := versionPattern.FindString(fileName)
	if match == "" {
		return "V1.00"
	}
	return "V" + match[1:]
}

func inferPlatform(fileName string) string {
	name := strings.ToLower(fileName)
	if strings.Contains(name, "fpga") {
		return "fpga"
	}
	if strings.Contains(name, "cpu") {
		return "cpu"
	}
	return "common"
}

func fileExtension(fileName string) string {
	extension := strings.ToLower(strings.TrimPrefix(path.Ext(fileName), "."))
	if !fileExtensionPattern.MatchString(extension) {
		return "bin"
	}
	return extension
}

func normalizePlatform(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "cpu":
		return "cpu"
	case "fpga":
		return "fpga"
	default:
		return "common"
	}
}

func validateObject(objectKind string, objectName string) error {
	switch objectKind {
	case "srs", "system_spec", "development_requirement", "task_book", "technical_requirement",
		"code_package", "other_reference":
	default:
		return fmt.Errorf("工作对象类型不支持")
	}
	if strings.TrimSpace(objectName) == "" {
		return fmt.Errorf("对象名称不能为空")
	}
	return nil
}

func validateReceiveInfo(source string, receivedAt string, receiveMode string) error {
	if strings.TrimSpace(source) == "" {
		return fmt.Errorf("提供方不能为空")
	}
	if _, err := time.Parse("2006-01-02", receivedAt); err != nil {
		return fmt.Errorf("接收日期格式应为 YYYY-MM-DD")
	}
	switch receiveMode {
	case "email", "onsite", "platform", "other":
	default:
		return fmt.Errorf("接收方式不支持")
	}
	return nil
}

func validateReason(reason string) error {
	if len([]rune(reason)) > 2000 {
		return fmt.Errorf("操作原因不能超过 2000 字")
	}
	return nil
}

func dereference(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func createLifecycleEvent(
	tx *gorm.DB,
	projectID string,
	versionID string,
	action string,
	fromStatus string,
	toStatus string,
	replacementVersionID string,
	reason string,
	operatedBy string,
	now time.Time,
) error {
	eventID, err := id.New()
	if err != nil {
		return err
	}
	var replacementID *string
	if replacementVersionID != "" {
		replacementID = &replacementVersionID
	}
	return tx.Create(&LifecycleEvent{
		ID:                   eventID,
		ProjectID:            projectID,
		WorkObjectVersionID:  versionID,
		Action:               action,
		FromStatus:           fromStatus,
		ToStatus:             toStatus,
		ReplacementVersionID: replacementID,
		Reason:               reason,
		OperatedBy:           operatedBy,
		OperatedAt:           now,
		CreatedAt:            now,
		UpdatedAt:            now,
	}).Error
}

func toResponses(rows []WorkObjectVersionRow) []WorkObjectResponse {
	result := make([]WorkObjectResponse, 0, len(rows))
	for _, row := range rows {
		result = append(result, toResponse(row))
	}
	return result
}

func toResponse(row WorkObjectVersionRow) WorkObjectResponse {
	return WorkObjectResponse{
		ID: row.ID, ProjectID: row.ProjectID, WorkObjectID: row.WorkObjectID,
		ObjectKind: row.ObjectKind, ObjectName: row.ObjectName, OriginalName: row.OriginalName,
		Version: row.Version, Platform: row.Platform, Status: row.Status, Source: row.Source,
		SupersededBy: row.SupersededByVersion,
		ReceivedAt:   row.ReceivedAt, ReceiveMode: row.ReceiveMode, FileSize: row.FileSize,
		FileType: row.FileType, MimeType: row.MimeType, SHA256: row.SHA256, AssetID: row.AssetID,
		HasLocalFile: row.AssetID != "", CreatedAt: row.CreatedAt.Format(time.RFC3339),
		UpdatedAt: row.UpdatedAt.Format(time.RFC3339),
	}
}
