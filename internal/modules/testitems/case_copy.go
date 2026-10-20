package testitems

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"chenmeridian/internal/id"
	"chenmeridian/internal/modules/contentblocks"
)

// CopyCaseTo 复制用例及其设计内容到目标测试项的目标位置；执行状态与实测结果重置。
func (s *Service) CopyCaseTo(ctx context.Context, sourceID, targetItemID string, targetIndex int) (Case, error) {
	var created Case
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var source Case
		if err := tx.Where("id = ?", sourceID).First(&source).Error; err != nil {
			return ErrNotFound
		}
		targetItem, err := findTestItem(tx, targetItemID)
		if err != nil {
			return err
		}
		if targetItem.ProjectID != source.ProjectID {
			return ErrImportAcrossProjects
		}

		var targetCases []Case
		if err := tx.Where("test_item_id = ?", targetItemID).
			Order("sort_order asc, created_at asc").Find(&targetCases).Error; err != nil {
			return fmt.Errorf("查询目标用例失败: %w", err)
		}
		if targetIndex < 0 {
			targetIndex = 0
		}
		if targetIndex > len(targetCases) {
			targetIndex = len(targetCases)
		}

		caseID, err := id.New()
		if err != nil {
			return err
		}
		now := timeNow()
		created = Case{
			ID:              caseID,
			ProjectID:       targetItem.ProjectID,
			TestItemID:      targetItem.ID,
			Identifier:      "TMP_" + caseID,
			Seq:             -(len(targetCases) + 1),
			Name:            source.Name + "-副本",
			Summary:         source.Summary,
			InitText:        source.InitText,
			Prerequisites:   source.Prerequisites,
			TerminationText: source.TerminationText,
			PassCriteria:    source.PassCriteria,
			DesignerID:      source.DesignerID,
			MonitorID:       source.MonitorID,
			Status:          "pending",
			SortOrder:       targetIndex,
			CreatedAt:       now,
			UpdatedAt:       now,
		}
		if err := tx.Create(&created).Error; err != nil {
			return fmt.Errorf("创建用例副本失败: %w", err)
		}

		ordered := make([]string, 0, len(targetCases)+1)
		for _, candidate := range targetCases {
			ordered = append(ordered, candidate.ID)
		}
		ordered = append(ordered[:targetIndex], append([]string{created.ID}, ordered[targetIndex:]...)...)
		if err := writeCaseOrder(tx, targetItem, ordered); err != nil {
			return err
		}

		var steps []CaseStep
		if err := tx.Where("test_case_id = ?", source.ID).
			Order("sort_order asc, created_at asc").Find(&steps).Error; err != nil {
			return fmt.Errorf("查询源用例步骤失败: %w", err)
		}
		for _, step := range steps {
			newStep, err := insertStep(tx, created.ID, step.ExpectText)
			if err != nil {
				return err
			}
			if err := contentblocks.CopyStepBlockTx(tx, step.ID, created.ID, newStep.ID, contentblocks.StepKindOp); err != nil {
				return err
			}
		}
		created, err = findCase(tx, created.ID)
		return err
	})
	if err != nil {
		return Case{}, err
	}
	return created, nil
}
