package testitems

import (
	"context"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"chenmeridian/internal/id"
	"chenmeridian/internal/modules/contentblocks"
)

// ListSteps 返回用例步骤（按序号）。
func (s *Service) ListSteps(ctx context.Context, caseID string) ([]CaseStep, error) {
	var steps []CaseStep
	if err := s.db.WithContext(ctx).Where("test_case_id = ?", caseID).
		Order("sort_order asc, created_at asc").Find(&steps).Error; err != nil {
		return nil, fmt.Errorf("查询用例步骤失败: %w", err)
	}
	return steps, nil
}

// StepView 用例步骤视图：步骤行 + 「输入及操作 / 实测结果」两块富文本（切片 5b）。
type StepView struct {
	CaseStep
	Op  contentblocks.BlockView `json:"op"`
	Act contentblocks.BlockView `json:"act"`
}

// ListStepsWithBlocks 返回步骤及其富文本块；无块记录的步骤带空视图。
func (s *Service) ListStepsWithBlocks(ctx context.Context, caseID string) ([]StepView, error) {
	steps, err := s.ListSteps(ctx, caseID)
	if err != nil {
		return nil, err
	}
	views := make([]StepView, 0, len(steps))
	if len(steps) == 0 {
		return views, nil
	}
	blocks := map[string]contentblocks.BlockView{}
	if s.blocks != nil {
		itemCase, err := s.GetCase(ctx, caseID)
		if err != nil {
			return nil, err
		}
		loaded, err := s.blocks.LoadBlocks(ctx, itemCase.ProjectID, contentblocks.OwnerTypeTestCase, caseID, "step.")
		if err != nil {
			return nil, err
		}
		blocks = loaded
	}
	for _, step := range steps {
		views = append(views, assembleStepView(step, blocks))
	}
	return views, nil
}

func assembleStepView(step CaseStep, blocks map[string]contentblocks.BlockView) StepView {
	view := StepView{CaseStep: step, Op: contentblocks.EmptyBlockView(), Act: contentblocks.EmptyBlockView()}
	if block, ok := blocks[contentblocks.StepBlockKey(step.ID, contentblocks.StepKindOp)]; ok {
		view.Op = block
	}
	if block, ok := blocks[contentblocks.StepBlockKey(step.ID, contentblocks.StepKindAct)]; ok {
		view.Act = block
	}
	return view
}

// SaveStepBlock 保存步骤富文本块，并按步骤改动口径刷新执行时间。
func (s *Service) SaveStepBlock(ctx context.Context, stepID, kind string, doc contentblocks.Node, operator string) (StepView, error) {
	if kind != contentblocks.StepKindOp && kind != contentblocks.StepKindAct {
		return StepView{}, fmt.Errorf("步骤内容块类型 %q 不受支持", kind)
	}
	if s.blocks == nil {
		return StepView{}, fmt.Errorf("内容块服务未接线")
	}
	var step CaseStep
	if err := s.db.WithContext(ctx).Where("id = ?", stepID).First(&step).Error; err != nil {
		return StepView{}, ErrNotFound
	}
	itemCase, err := findCase(s.db.WithContext(ctx), step.TestCaseID)
	if err != nil {
		return StepView{}, err
	}
	if _, err := s.blocks.SaveBlock(ctx, itemCase.ProjectID, contentblocks.OwnerTypeTestCase, step.TestCaseID,
		contentblocks.StepBlockKey(stepID, kind), doc, contentblocks.SaveBlockOptions{}, operator); err != nil {
		return StepView{}, err
	}
	if err := touchCaseExecDate(s.db.WithContext(ctx), step.TestCaseID, false); err != nil {
		return StepView{}, err
	}
	blocks, err := s.blocks.LoadBlocks(ctx, itemCase.ProjectID, contentblocks.OwnerTypeTestCase, step.TestCaseID, contentblocks.StepBlockPrefix(stepID))
	if err != nil {
		return StepView{}, err
	}
	return assembleStepView(step, blocks), nil
}

// CreateStep 在用例末尾追加步骤。
func (s *Service) CreateStep(ctx context.Context, caseID string, expectText string) (CaseStep, error) {
	var created CaseStep
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if _, err := findCase(tx, caseID); err != nil {
			return err
		}
		step, innerErr := insertStep(tx, caseID, expectText)
		if innerErr != nil {
			return innerErr
		}
		created = step
		return nil
	})
	if err != nil {
		return CaseStep{}, err
	}
	return created, nil
}

func insertStep(tx *gorm.DB, caseID string, expectText string) (CaseStep, error) {
	var maxOrder *int
	if err := tx.Model(&CaseStep{}).Where("test_case_id = ?", caseID).
		Select("MAX(sort_order)").Scan(&maxOrder).Error; err != nil {
		return CaseStep{}, fmt.Errorf("查询步骤排序失败: %w", err)
	}
	nextOrder := 0
	if maxOrder != nil {
		nextOrder = *maxOrder + 1
	}

	stepID, err := id.New()
	if err != nil {
		return CaseStep{}, err
	}
	now := time.Now()
	created := CaseStep{
		ID:         stepID,
		TestCaseID: caseID,
		Seq:        nextOrder + 1,
		ExpectText: strings.TrimSpace(expectText),
		Passed:     "none",
		SortOrder:  nextOrder,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := tx.Create(&created).Error; err != nil {
		return CaseStep{}, fmt.Errorf("创建用例步骤失败: %w", err)
	}
	if err := recomputeCaseStatus(tx, caseID); err != nil {
		return CaseStep{}, err
	}
	return created, nil
}

func listStepsTx(tx *gorm.DB, caseID string) ([]CaseStep, error) {
	var steps []CaseStep
	if err := tx.Where("test_case_id = ?", caseID).
		Order("sort_order asc, created_at asc").Find(&steps).Error; err != nil {
		return nil, fmt.Errorf("查询用例步骤失败: %w", err)
	}
	return steps, nil
}

// insertStepAt 在步骤序列的 position 位置插入一行。
// 先写负数占位再两阶段重排：seq 上有 UNIQUE(test_case_id, seq)，直接写正数会和目标位置之后的行撞。
func insertStepAt(tx *gorm.DB, caseID string, position int, template CaseStep) (CaseStep, error) {
	steps, err := listStepsTx(tx, caseID)
	if err != nil {
		return CaseStep{}, err
	}
	if position < 0 {
		position = 0
	}
	if position > len(steps) {
		position = len(steps)
	}
	stepIDNew, err := id.New()
	if err != nil {
		return CaseStep{}, err
	}
	now := time.Now()
	created := CaseStep{
		ID:         stepIDNew,
		TestCaseID: caseID,
		Seq:        -(len(steps) + 1),
		ExpectText: template.ExpectText,
		Passed:     "none",
		SortOrder:  len(steps),
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := tx.Create(&created).Error; err != nil {
		return CaseStep{}, fmt.Errorf("插入用例步骤失败: %w", err)
	}

	ordered := make([]string, 0, len(steps)+1)
	for _, step := range steps {
		ordered = append(ordered, step.ID)
	}
	ordered = append(ordered[:position], append([]string{created.ID}, ordered[position:]...)...)
	for index, idValue := range ordered {
		if err := tx.Model(&CaseStep{}).Where("id = ?", idValue).Updates(map[string]any{
			"sort_order": index,
			"seq":        -(index + 1),
			"updated_at": now,
		}).Error; err != nil {
			return CaseStep{}, fmt.Errorf("重排用例步骤失败: %w", err)
		}
	}
	for index, idValue := range ordered {
		if err := tx.Model(&CaseStep{}).Where("id = ?", idValue).Updates(map[string]any{
			"seq":        index + 1,
			"updated_at": now,
		}).Error; err != nil {
			return CaseStep{}, fmt.Errorf("重排用例步骤失败: %w", err)
		}
	}
	return created, nil
}

// UpdateStepInput 步骤更新入参；nil 表示不修改。
type UpdateStepInput struct {
	ExpectText *string
	Passed     *string
}

// UpdateStep 更新步骤预期结果或通过状态；状态变化会联动用例状态与执行时间。
func (s *Service) UpdateStep(ctx context.Context, stepID string, input UpdateStepInput) (CaseStep, error) {
	var updated CaseStep
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var step CaseStep
		if err := tx.Where("id = ?", stepID).First(&step).Error; err != nil {
			return ErrNotFound
		}

		updates := map[string]any{"updated_at": timeNow()}
		if input.ExpectText != nil {
			updates["expect_text"] = strings.TrimSpace(*input.ExpectText)
		}
		if input.Passed != nil {
			passed := strings.TrimSpace(*input.Passed)
			if passed != "none" && passed != "pass" && passed != "fail" {
				return fmt.Errorf("通过状态取值不合法")
			}
			updates["passed"] = passed
		}
		if err := tx.Model(&CaseStep{}).Where("id = ?", stepID).Updates(updates).Error; err != nil {
			return fmt.Errorf("更新用例步骤失败: %w", err)
		}

		if input.Passed != nil || input.ExpectText != nil {
			if err := touchCaseExecDate(tx, step.TestCaseID, input.Passed != nil); err != nil {
				return err
			}
			if err := recomputeCaseStatus(tx, step.TestCaseID); err != nil {
				return err
			}
		}

		if err := tx.Where("id = ?", stepID).First(&updated).Error; err != nil {
			return ErrNotFound
		}
		return nil
	})
	if err != nil {
		return CaseStep{}, err
	}
	return updated, nil
}

// ToggleStepPass 三态循环：none -> pass -> fail -> none。
func (s *Service) ToggleStepPass(ctx context.Context, stepID string) (CaseStep, error) {
	var step CaseStep
	if err := s.db.WithContext(ctx).Where("id = ?", stepID).First(&step).Error; err != nil {
		return CaseStep{}, ErrNotFound
	}
	next := "pass"
	switch step.Passed {
	case "pass":
		next = "fail"
	case "fail":
		next = "none"
	}
	return s.UpdateStep(ctx, stepID, UpdateStepInput{Passed: &next})
}

// DeleteStep 删除步骤；至少保留 1 行，删除后重排序号。
func (s *Service) DeleteStep(ctx context.Context, stepID string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var step CaseStep
		if err := tx.Where("id = ?", stepID).First(&step).Error; err != nil {
			return ErrNotFound
		}
		var count int64
		if err := tx.Model(&CaseStep{}).Where("test_case_id = ?", step.TestCaseID).
			Count(&count).Error; err != nil {
			return fmt.Errorf("查询步骤数量失败: %w", err)
		}
		if count <= 1 {
			return fmt.Errorf("用例至少保留 1 个步骤")
		}
		if err := tx.Where("id = ?", stepID).Delete(&CaseStep{}).Error; err != nil {
			return fmt.Errorf("删除用例步骤失败: %w", err)
		}
		if err := contentblocks.DeleteBlocksTx(tx, contentblocks.OwnerTypeTestCase, step.TestCaseID, contentblocks.StepBlockPrefix(step.ID)); err != nil {
			return err
		}
		if err := renumberSteps(tx, step.TestCaseID); err != nil {
			return err
		}
		return recomputeCaseStatus(tx, step.TestCaseID)
	})
}

// DuplicateStep 复制步骤到其下方（带 op 设计内容，执行数据重置）。
func (s *Service) DuplicateStep(ctx context.Context, stepID string) (CaseStep, error) {
	var created CaseStep
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var source CaseStep
		if err := tx.Where("id = ?", stepID).First(&source).Error; err != nil {
			return ErrNotFound
		}
		steps, err := listStepsTx(tx, source.TestCaseID)
		if err != nil {
			return err
		}
		position := -1
		for index, step := range steps {
			if step.ID == stepID {
				position = index + 1
				break
			}
		}
		if position < 0 {
			return ErrNotFound
		}
		created, err = insertStepAt(tx, source.TestCaseID, position, source)
		if err != nil {
			return err
		}
		// 「输入及操作」是设计内容随行复制；「实测结果 / 通过状态」是执行数据，不复制（Passed 已重置）。
		if err := contentblocks.CopyStepBlockTx(tx, source.ID, source.TestCaseID, created.ID, contentblocks.StepKindOp); err != nil {
			return err
		}
		return recomputeCaseStatus(tx, source.TestCaseID)
	})
	if err != nil {
		return CaseStep{}, err
	}
	return created, nil
}

// InsertStepBefore 在目标步骤上方插入一个空步骤（步骤表 Ctrl+Shift+Enter）。
func (s *Service) InsertStepBefore(ctx context.Context, stepID string) (CaseStep, error) {
	var created CaseStep
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var target CaseStep
		if err := tx.Where("id = ?", stepID).First(&target).Error; err != nil {
			return ErrNotFound
		}
		steps, err := listStepsTx(tx, target.TestCaseID)
		if err != nil {
			return err
		}
		position := -1
		for index, step := range steps {
			if step.ID == stepID {
				position = index
				break
			}
		}
		if position < 0 {
			return ErrNotFound
		}
		created, err = insertStepAt(tx, target.TestCaseID, position, CaseStep{})
		if err != nil {
			return err
		}
		return recomputeCaseStatus(tx, target.TestCaseID)
	})
	if err != nil {
		return CaseStep{}, err
	}
	return created, nil
}

// ImportStep 把源步骤的设计内容（expectText + op 块）复制到目标用例末尾（跨用例复制步骤）。
func (s *Service) ImportStep(ctx context.Context, targetCaseID, sourceStepID string) (CaseStep, error) {
	var created CaseStep
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var source CaseStep
		if err := tx.Where("id = ?", sourceStepID).First(&source).Error; err != nil {
			return ErrNotFound
		}
		target, err := findCase(tx, targetCaseID)
		if err != nil {
			return err
		}
		sourceCase, err := findCase(tx, source.TestCaseID)
		if err != nil {
			return err
		}
		if sourceCase.ProjectID != target.ProjectID {
			return ErrImportAcrossProjects
		}
		steps, err := listStepsTx(tx, targetCaseID)
		if err != nil {
			return err
		}
		created, err = insertStepAt(tx, targetCaseID, len(steps), CaseStep{ExpectText: source.ExpectText})
		if err != nil {
			return err
		}
		if err := contentblocks.CopyStepBlockTx(tx, sourceStepID, targetCaseID, created.ID, contentblocks.StepKindOp); err != nil {
			return err
		}
		return recomputeCaseStatus(tx, targetCaseID)
	})
	if err != nil {
		return CaseStep{}, err
	}
	return created, nil
}

// MoveStep 移动步骤到目标位置（0 起）。
func (s *Service) MoveStep(ctx context.Context, stepID string, targetIndex int) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var step CaseStep
		if err := tx.Where("id = ?", stepID).First(&step).Error; err != nil {
			return ErrNotFound
		}
		steps, err := listStepsTx(tx, step.TestCaseID)
		if err != nil {
			return err
		}

		from := -1
		for index, item := range steps {
			if item.ID == stepID {
				from = index
				break
			}
		}
		if from < 0 {
			return ErrNotFound
		}
		if targetIndex < 0 {
			targetIndex = 0
		}
		if targetIndex > len(steps)-1 {
			targetIndex = len(steps) - 1
		}
		if from == targetIndex {
			return nil
		}

		moved := steps[from]
		rest := append(append([]CaseStep{}, steps[:from]...), steps[from+1:]...)
		ordered := append(append([]CaseStep{}, rest[:targetIndex]...), moved)
		ordered = append(ordered, rest[targetIndex:]...)

		now := timeNow()
		for index, item := range ordered {
			if err := tx.Model(&CaseStep{}).Where("id = ?", item.ID).Updates(map[string]any{
				"sort_order": index,
				"seq":        -(index + 1),
				"updated_at": now,
			}).Error; err != nil {
				return fmt.Errorf("重排用例步骤失败: %w", err)
			}
		}
		for index, item := range ordered {
			if err := tx.Model(&CaseStep{}).Where("id = ?", item.ID).Updates(map[string]any{
				"seq":        index + 1,
				"updated_at": now,
			}).Error; err != nil {
				return fmt.Errorf("重排用例步骤失败: %w", err)
			}
		}
		return nil
	})
}

// recomputeCaseStatus 用例状态联动：任一 fail -> failed；全部 pass -> passed；否则 pending。
func recomputeCaseStatus(tx *gorm.DB, caseID string) error {
	var steps []CaseStep
	if err := tx.Where("test_case_id = ?", caseID).Find(&steps).Error; err != nil {
		return fmt.Errorf("查询用例步骤失败: %w", err)
	}

	status := "pending"
	if len(steps) > 0 {
		allPass := true
		anyFail := false
		for _, step := range steps {
			if step.Passed == "fail" {
				anyFail = true
				allPass = false
				break
			}
			if step.Passed != "pass" {
				allPass = false
			}
		}
		switch {
		case anyFail:
			status = "failed"
		case allPass:
			status = "passed"
		}
	}

	if err := tx.Model(&Case{}).Where("id = ?", caseID).
		Updates(map[string]any{"status": status, "updated_at": timeNow()}).Error; err != nil {
		return fmt.Errorf("更新用例状态失败: %w", err)
	}
	return nil
}

// touchCaseExecDate 步骤变化时自动写执行时间（用户手工改过的时间不覆盖）。
func touchCaseExecDate(tx *gorm.DB, caseID string, fromPassedChange bool) error {
	var itemCase Case
	if err := tx.Where("id = ?", caseID).First(&itemCase).Error; err != nil {
		return ErrNotFound
	}
	if itemCase.ExecDate != nil && !fromPassedChange {
		return nil
	}
	return tx.Model(&Case{}).Where("id = ?", caseID).
		Updates(map[string]any{"exec_date": time.Now(), "updated_at": timeNow()}).Error
}
