package requirements

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"chenmeridian/internal/id"
)

// 章节解析与父级定位：章节号归属、按章节建树、重解析后的章节清理。
func resolveParentID(tx *gorm.DB, source SourceRow, parentID string, chapter string) (*string, error) {
	expectedParentChapter := parentChapter(chapter)
	if expectedParentChapter == "" {
		return nil, nil
	}
	if strings.TrimSpace(parentID) != "" {
		var parent Section
		if err := tx.Where("id = ? AND source_version_id = ?", parentID, source.ID).
			First(&parent).Error; err != nil {
			return nil, ErrParentMissing
		}
		if parent.ChapterNumber != expectedParentChapter {
			return nil, ErrParentMissing
		}
		return &parent.ID, nil
	}

	return findOptionalParentID(tx, source.ID, expectedParentChapter)
}

func findOptionalParentID(tx *gorm.DB, sourceVersionID string, chapter string) (*string, error) {
	parent, err := findSectionByChapter(tx, sourceVersionID, chapter)
	if errors.Is(err, ErrParentMissing) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &parent.ID, nil
}

func findSectionByChapter(tx *gorm.DB, sourceVersionID string, chapter string) (Section, error) {
	var section Section
	err := tx.Where("source_version_id = ? AND chapter_number = ?", sourceVersionID, chapter).
		First(&section).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Section{}, ErrParentMissing
	}
	if err != nil {
		return Section{}, fmt.Errorf("查询父章节失败: %w", err)
	}
	return section, nil
}

func createSectionInTx(
	tx *gorm.DB,
	projectID string,
	sourceVersionID string,
	parentID *string,
	chapter string,
	title string,
	origin string,
	sourceAnchor string,
	operatedBy string,
) (Section, error) {
	var count int64
	if err := tx.Model(&Section{}).
		Where("source_version_id = ? AND chapter_number = ?", sourceVersionID, chapter).
		Count(&count).Error; err != nil {
		return Section{}, fmt.Errorf("检查章节冲突失败: %w", err)
	}
	if count > 0 {
		return Section{}, ErrSectionExists
	}
	sectionID, err := id.New()
	if err != nil {
		return Section{}, err
	}
	now := time.Now()
	section := Section{
		ID: sectionID, ProjectID: projectID, SourceVersionID: sourceVersionID, ParentID: parentID,
		ChapterNumber: chapter, Title: title, Origin: origin, SourceAnchor: sourceAnchor,
		CreatedBy: operatedBy, CreatedAt: now, UpdatedAt: now,
	}
	if err := tx.Create(&section).Error; err != nil {
		return Section{}, fmt.Errorf("保存需求章节失败: %w", err)
	}
	return section, nil
}

func resolveOrCreateRequirementSection(
	tx *gorm.DB,
	source SourceRow,
	requestSectionID string,
	chapter string,
	name string,
	origin string,
	sourceAnchor string,
	operatedBy string,
) (Section, error) {
	expectedParent := parentChapter(chapter)
	var parentID *string

	if strings.TrimSpace(requestSectionID) != "" {
		var requested Section
		if err := tx.Where("id = ? AND source_version_id = ?", requestSectionID, source.ID).
			First(&requested).Error; err != nil {
			return Section{}, ErrSectionNotFound
		}
		if requested.ChapterNumber == chapter {
			return requested, nil
		}
		if expectedParent == "" || requested.ChapterNumber != expectedParent {
			return Section{}, ErrSectionNotFound
		}
		parentID = &requested.ID
	} else if expectedParent != "" {
		parent, parentErr := findOptionalParentID(tx, source.ID, expectedParent)
		if parentErr != nil {
			return Section{}, parentErr
		}
		parentID = parent
	}

	if existing, err := findSectionByChapter(tx, source.ID, chapter); err == nil {
		return existing, nil
	} else if !errors.Is(err, ErrParentMissing) {
		return Section{}, err
	}
	return createSectionInTx(
		tx, source.ProjectID, source.ID, parentID, chapter, name, origin, sourceAnchor, operatedBy,
	)
}

func cleanupParsedSections(tx *gorm.DB, sourceVersionID string, parsedChapters map[string]bool) error {
	var stale []Section
	if err := tx.Where("source_version_id = ? AND origin = ?", sourceVersionID, OriginParsed).
		Find(&stale).Error; err != nil {
		return fmt.Errorf("查询待清理解析章节失败: %w", err)
	}
	removable := make(map[string]bool)
	for _, section := range stale {
		if !parsedChapters[section.ChapterNumber] {
			removable[section.ID] = true
		}
	}

	for len(removable) > 0 {
		deleted := false
		for sectionID := range removable {
			var childCount, requirementCount int64
			if err := tx.Model(&Section{}).Where("parent_id = ?", sectionID).Count(&childCount).Error; err != nil {
				return fmt.Errorf("检查解析章节子级失败: %w", err)
			}
			if err := tx.Model(&Requirement{}).Where("section_id = ?", sectionID).
				Count(&requirementCount).Error; err != nil {
				return fmt.Errorf("检查解析章节需求失败: %w", err)
			}
			if childCount > 0 || requirementCount > 0 {
				continue
			}
			if err := tx.Delete(&Section{}, "id = ?", sectionID).Error; err != nil {
				return fmt.Errorf("清理已移除章节失败: %w", err)
			}
			delete(removable, sectionID)
			deleted = true
		}
		if !deleted {
			return nil
		}
	}
	return nil
}
