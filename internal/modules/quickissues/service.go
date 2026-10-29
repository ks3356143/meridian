package quickissues

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"

	"chenmeridian/internal/id"
)

var (
	ErrCaseNotFound    = errors.New("用例不存在")
	ErrNoteNotFound    = errors.New("问题草稿不存在")
	ErrForbidden       = errors.New("没有权限操作该问题草稿")
	ErrNoteRequired    = errors.New("问题内容不能为空")
	ErrNoteTooLong     = errors.New("问题内容不能超过 500 个字符")
	ErrStepMismatch    = errors.New("步骤不属于当前用例")
	ErrAssetMismatch   = errors.New("截图不属于当前项目")
	ErrNoUpdate        = errors.New("没有需要修改的内容")
	MaxNoteLengthRunes = 500
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

type CreateInput struct {
	CaseID            string
	TestCaseStepID    *string
	NoteText          string
	ScreenshotAssetID *string
	CreatedBy         string
}

type UpdateInput struct {
	NoteText          *string
	ScreenshotAssetID *string
	ClearScreenshot   bool
	UpdatedBy         string
}

type caseContext struct {
	ProjectID string `gorm:"column:project_id"`
	RoundID   string `gorm:"column:round_id"`
}

func (s *Service) List(ctx context.Context, caseID, userID string) ([]NoteView, error) {
	itemCase, err := s.loadCaseContext(ctx, caseID)
	if err != nil {
		return nil, err
	}
	if err := ensureProjectMember(s.db.WithContext(ctx), itemCase.ProjectID, userID); err != nil {
		return nil, err
	}
	views, err := listViews(s.db.WithContext(ctx), caseID)
	if err != nil {
		return nil, err
	}
	for index := range views {
		views[index].CanEdit = views[index].CreatedBy == userID
	}
	return views, nil
}

func (s *Service) Create(ctx context.Context, input CreateInput) (NoteView, error) {
	itemCase, err := s.loadCaseContext(ctx, input.CaseID)
	if err != nil {
		return NoteView{}, err
	}
	if err := ensureProjectMember(s.db.WithContext(ctx), itemCase.ProjectID, input.CreatedBy); err != nil {
		return NoteView{}, err
	}
	noteText, err := normalizeNoteText(input.NoteText)
	if err != nil {
		return NoteView{}, err
	}
	stepID, err := normalizeStepID(s.db.WithContext(ctx), input.CaseID, input.TestCaseStepID)
	if err != nil {
		return NoteView{}, err
	}
	assetID, err := normalizeAssetID(s.db.WithContext(ctx), itemCase.ProjectID, input.ScreenshotAssetID)
	if err != nil {
		return NoteView{}, err
	}
	noteID, err := id.New()
	if err != nil {
		return NoteView{}, err
	}
	now := time.Now().UTC()
	note := Note{
		ID:                noteID,
		ProjectID:         itemCase.ProjectID,
		RoundID:           itemCase.RoundID,
		TestCaseID:        input.CaseID,
		TestCaseStepID:    stepID,
		NoteText:          noteText,
		ScreenshotAssetID: assetID,
		CreatedBy:         input.CreatedBy,
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	if err := s.db.WithContext(ctx).Create(&note).Error; err != nil {
		return NoteView{}, fmt.Errorf("保存问题草稿失败: %w", err)
	}
	return s.view(ctx, note.ID, input.CreatedBy)
}

func (s *Service) Update(ctx context.Context, noteID string, input UpdateInput) (NoteView, error) {
	note, err := s.findNote(ctx, noteID)
	if err != nil {
		return NoteView{}, err
	}
	if note.CreatedBy != input.UpdatedBy {
		return NoteView{}, ErrForbidden
	}
	if err := ensureProjectMember(s.db.WithContext(ctx), note.ProjectID, input.UpdatedBy); err != nil {
		return NoteView{}, err
	}
	updates := map[string]any{"updated_at": time.Now().UTC()}
	if input.NoteText != nil {
		noteText, err := normalizeNoteText(*input.NoteText)
		if err != nil {
			return NoteView{}, err
		}
		updates["note_text"] = noteText
	}
	if input.ClearScreenshot {
		updates["screenshot_asset_id"] = nil
	} else if input.ScreenshotAssetID != nil {
		assetID, err := normalizeAssetID(s.db.WithContext(ctx), note.ProjectID, input.ScreenshotAssetID)
		if err != nil {
			return NoteView{}, err
		}
		updates["screenshot_asset_id"] = assetID
	}
	if len(updates) == 1 {
		return NoteView{}, ErrNoUpdate
	}
	if err := s.db.WithContext(ctx).Model(&Note{}).Where("id = ?", noteID).Updates(updates).Error; err != nil {
		return NoteView{}, fmt.Errorf("更新问题草稿失败: %w", err)
	}
	return s.view(ctx, noteID, input.UpdatedBy)
}

func (s *Service) Delete(ctx context.Context, noteID, userID string) error {
	note, err := s.findNote(ctx, noteID)
	if err != nil {
		return err
	}
	if note.CreatedBy != userID {
		return ErrForbidden
	}
	if err := ensureProjectMember(s.db.WithContext(ctx), note.ProjectID, userID); err != nil {
		return err
	}
	if err := s.db.WithContext(ctx).Where("id = ?", noteID).Delete(&Note{}).Error; err != nil {
		return fmt.Errorf("删除问题草稿失败: %w", err)
	}
	return nil
}

func (s *Service) view(ctx context.Context, noteID, userID string) (NoteView, error) {
	var view NoteView
	err := s.db.WithContext(ctx).Table("quick_issue_notes AS note").
		Select(baseViewSelect()).
		Joins("LEFT JOIN users AS creator ON creator.id = note.created_by").
		Joins("LEFT JOIN test_case_steps AS step ON step.id = note.test_case_step_id").
		Where("note.id = ?", noteID).Scan(&view).Error
	if err != nil {
		return NoteView{}, fmt.Errorf("读取问题草稿失败: %w", err)
	}
	if view.ID == "" {
		return NoteView{}, ErrNoteNotFound
	}
	view.CanEdit = view.CreatedBy == userID
	return view, nil
}

func (s *Service) findNote(ctx context.Context, noteID string) (Note, error) {
	var note Note
	err := s.db.WithContext(ctx).Where("id = ?", noteID).First(&note).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Note{}, ErrNoteNotFound
	}
	if err != nil {
		return Note{}, fmt.Errorf("查询问题草稿失败: %w", err)
	}
	return note, nil
}

func (s *Service) loadCaseContext(ctx context.Context, caseID string) (caseContext, error) {
	var itemCase caseContext
	err := s.db.WithContext(ctx).Table("test_cases AS item_case").
		Select("item_case.project_id, item.round_id").
		Joins("JOIN test_items AS item ON item.id = item_case.test_item_id").
		Where("item_case.id = ?", caseID).Scan(&itemCase).Error
	if err != nil {
		return caseContext{}, fmt.Errorf("查询用例轮次失败: %w", err)
	}
	if itemCase.ProjectID == "" || itemCase.RoundID == "" {
		return caseContext{}, ErrCaseNotFound
	}
	return itemCase, nil
}

func ensureProjectMember(db *gorm.DB, projectID, userID string) error {
	if strings.TrimSpace(userID) == "" {
		return ErrForbidden
	}
	var count int64
	if err := db.Table("projects AS project").
		Where(`project.id = ? AND (project.owner_id = ? OR EXISTS (
            SELECT 1 FROM project_members member
            WHERE member.project_id = project.id AND member.user_id = ?
        ))`, projectID, userID, userID).Count(&count).Error; err != nil {
		return fmt.Errorf("校验项目成员失败: %w", err)
	}
	if count == 0 {
		return ErrForbidden
	}
	return nil
}

func normalizeNoteText(raw string) (string, error) {
	text := strings.TrimSpace(raw)
	if text == "" {
		return "", ErrNoteRequired
	}
	if utf8.RuneCountInString(text) > MaxNoteLengthRunes {
		return "", ErrNoteTooLong
	}
	return text, nil
}

func normalizeStepID(db *gorm.DB, caseID string, raw *string) (*string, error) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return nil, nil
	}
	stepID := strings.TrimSpace(*raw)
	var count int64
	if err := db.Table("test_case_steps").
		Where("id = ? AND test_case_id = ?", stepID, caseID).Count(&count).Error; err != nil {
		return nil, fmt.Errorf("校验问题步骤失败: %w", err)
	}
	if count == 0 {
		return nil, ErrStepMismatch
	}
	return &stepID, nil
}

func normalizeAssetID(db *gorm.DB, projectID string, raw *string) (*string, error) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return nil, nil
	}
	assetID := strings.TrimSpace(*raw)
	var count int64
	if err := db.Table("assets").Where("id = ? AND project_id = ?", assetID, projectID).Count(&count).Error; err != nil {
		return nil, fmt.Errorf("校验问题截图失败: %w", err)
	}
	if count == 0 {
		return nil, ErrAssetMismatch
	}
	return &assetID, nil
}

func listViews(db *gorm.DB, caseID string) ([]NoteView, error) {
	var views []NoteView
	err := db.Table("quick_issue_notes AS note").
		Select(baseViewSelect()).
		Joins("LEFT JOIN users AS creator ON creator.id = note.created_by").
		Joins("LEFT JOIN test_case_steps AS step ON step.id = note.test_case_step_id").
		Where("note.test_case_id = ?", caseID).
		Order("note.created_at DESC, note.id DESC").Scan(&views).Error
	if err != nil {
		return nil, fmt.Errorf("读取问题草稿列表失败: %w", err)
	}
	return views, nil
}

func baseViewSelect() string {
	return `note.*, COALESCE(creator.display_name, '') AS created_by_name, step.seq AS step_seq`
}
