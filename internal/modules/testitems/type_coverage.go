package testitems

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"gorm.io/gorm"

	"chenmeridian/internal/id"
)

var (
	ErrCoverageReasonRequired = errors.New("不测评说明不能为空")
	ErrCoverageRoundRequired  = errors.New("请选择具体轮次填写不测评说明")
	ErrCoverageNotApplicable  = errors.New("静态测试项只保留首轮，当前轮次不需要填写不测评说明")
	ErrCoverageTypeCovered    = errors.New("该类型当前轮次已有测试项，不需要填写不测评说明")
)

const (
	coverageStatusCovered       = "covered"
	coverageStatusExplained     = "explained"
	coverageStatusMissing       = "missing"
	coverageStatusNotApplicable = "not_applicable"
)

type TypeCoverageRoundSlice struct {
	RoundID      string            `json:"roundId"`
	RoundNumber  int               `json:"roundNumber"`
	RoundName    string            `json:"roundName"`
	Applicable   bool              `json:"applicable"`
	Status       string            `json:"status"`
	ItemCount    int               `json:"itemCount"`
	CaseCount    int               `json:"caseCount"`
	PassedCount  int               `json:"passedCount"`
	FailedCount  int               `json:"failedCount"`
	PendingCount int               `json:"pendingCount"`
	PassRate     *float64          `json:"passRate"`
	Note         *TypeCoverageNote `json:"note"`
}

type TypeCoverageCard struct {
	Code         string                   `json:"code"`
	Name         string                   `json:"name"`
	Category     string                   `json:"category"`
	IsStatic     bool                     `json:"isStatic"`
	OutputOrder  int                      `json:"outputOrder"`
	Applicable   bool                     `json:"applicable"`
	Status       string                   `json:"status"`
	ItemCount    int                      `json:"itemCount"`
	CaseCount    int                      `json:"caseCount"`
	PassedCount  int                      `json:"passedCount"`
	FailedCount  int                      `json:"failedCount"`
	PendingCount int                      `json:"pendingCount"`
	PassRate     *float64                 `json:"passRate"`
	Note         *TypeCoverageNote        `json:"note"`
	Rounds       []TypeCoverageRoundSlice `json:"rounds"`
}

type TypeCoverageSummary struct {
	Applicable    int `json:"applicable"`
	Covered       int `json:"covered"`
	Explained     int `json:"explained"`
	Missing       int `json:"missing"`
	NotApplicable int `json:"notApplicable"`
	TestItemCount int `json:"testItemCount"`
	CaseCount     int `json:"caseCount"`
}

type TypeCoverageResult struct {
	AllRounds bool                `json:"allRounds"`
	Round     *Round              `json:"round"`
	Rounds    []Round             `json:"rounds"`
	Summary   TypeCoverageSummary `json:"summary"`
	Types     []TypeCoverageCard  `json:"types"`
}

type typeCoverageCountRow struct {
	RoundID      string `gorm:"column:round_id"`
	TypeCode     string `gorm:"column:type_code"`
	ItemCount    int    `gorm:"column:item_count"`
	CaseCount    int    `gorm:"column:case_count"`
	PassedCount  int    `gorm:"column:passed_count"`
	FailedCount  int    `gorm:"column:failed_count"`
	PendingCount int    `gorm:"column:pending_count"`
}

type typeCoverageNoteRow struct {
	ID            string    `gorm:"column:id"`
	ProjectID     string    `gorm:"column:project_id"`
	RoundID       string    `gorm:"column:round_id"`
	TypeCode      string    `gorm:"column:type_code"`
	ReasonText    string    `gorm:"column:reason_text"`
	UpdatedBy     string    `gorm:"column:updated_by"`
	UpdatedByName string    `gorm:"column:updated_by_name"`
	CreatedAt     time.Time `gorm:"column:created_at"`
	UpdatedAt     time.Time `gorm:"column:updated_at"`
}

// TypeCoverage 返回 24 类测试项的轮次覆盖情况；roundID=all 时按轮聚合且只读。
func (s *Service) TypeCoverage(ctx context.Context, projectID, roundID string) (TypeCoverageResult, error) {
	allRounds := strings.EqualFold(strings.TrimSpace(roundID), "all")
	var rounds []Round
	var current *Round
	var err error
	if allRounds {
		rounds, err = s.ListRounds(ctx, projectID)
		if err != nil {
			return TypeCoverageResult{}, err
		}
	} else {
		round, resolveErr := s.ResolveRound(ctx, projectID, roundID)
		if resolveErr != nil {
			return TypeCoverageResult{}, resolveErr
		}
		current = &round
		rounds = []Round{round}
	}
	types, err := s.ListTypes(ctx)
	if err != nil {
		return TypeCoverageResult{}, err
	}

	countQuery := s.db.WithContext(ctx).Table("test_items AS item").
		Select(`item.round_id AS round_id, item.type_code AS type_code,
			COUNT(DISTINCT item.id) AS item_count,
			COUNT(c.id) AS case_count,
			SUM(CASE WHEN c.status = 'passed' THEN 1 ELSE 0 END) AS passed_count,
			SUM(CASE WHEN c.status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
			SUM(CASE WHEN c.status = 'pending' THEN 1 ELSE 0 END) AS pending_count`).
		Joins("LEFT JOIN test_cases AS c ON c.test_item_id = item.id").
		Where("item.project_id = ?", projectID)
	if !allRounds {
		countQuery = countQuery.Where("item.round_id = ?", rounds[0].ID)
	}
	var countRows []typeCoverageCountRow
	if err := countQuery.Group("item.round_id, item.type_code").Scan(&countRows).Error; err != nil {
		return TypeCoverageResult{}, fmt.Errorf("查询类型覆盖统计失败: %w", err)
	}
	counts := make(map[string]typeCoverageCountRow, len(countRows))
	for _, row := range countRows {
		counts[coverageKey(row.RoundID, row.TypeCode)] = row
	}

	noteQuery := s.db.WithContext(ctx).Table("test_item_type_coverage_notes AS note").
		Select(`note.id, note.project_id, note.round_id, note.type_code, note.reason_text,
			note.updated_by, COALESCE(users.display_name, '') AS updated_by_name,
			note.created_at, note.updated_at`).
		Joins("LEFT JOIN users ON users.id = note.updated_by").
		Where("note.project_id = ?", projectID)
	if !allRounds {
		noteQuery = noteQuery.Where("note.round_id = ?", rounds[0].ID)
	}
	var noteRows []typeCoverageNoteRow
	if err := noteQuery.Scan(&noteRows).Error; err != nil {
		return TypeCoverageResult{}, fmt.Errorf("查询不测评说明失败: %w", err)
	}
	notes := make(map[string]TypeCoverageNote, len(noteRows))
	for _, row := range noteRows {
		notes[coverageKey(row.RoundID, row.TypeCode)] = TypeCoverageNote{
			ID: row.ID, ProjectID: row.ProjectID, RoundID: row.RoundID, TypeCode: row.TypeCode,
			ReasonText: row.ReasonText, UpdatedBy: row.UpdatedBy, UpdatedByName: row.UpdatedByName,
			CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
		}
	}

	if rounds == nil {
		rounds = []Round{}
	}
	result := TypeCoverageResult{AllRounds: allRounds, Round: current, Rounds: rounds}
	for _, itemType := range types {
		card := TypeCoverageCard{
			Code: itemType.Code, Name: itemType.Name, Category: itemType.Category,
			IsStatic: itemType.IsStatic, OutputOrder: itemType.OutputOrder,
			Rounds: []TypeCoverageRoundSlice{},
		}
		hasMissing := false
		hasCovered := false
		hasExplained := false
		for _, round := range rounds {
			applicable := !itemType.IsStatic || round.RoundNumber == 1
			row := counts[coverageKey(round.ID, itemType.Code)]
			note, hasNote := notes[coverageKey(round.ID, itemType.Code)]
			entry := TypeCoverageRoundSlice{
				RoundID: round.ID, RoundNumber: round.RoundNumber, RoundName: round.Name,
				Applicable: applicable, ItemCount: row.ItemCount, CaseCount: row.CaseCount,
				PassedCount: row.PassedCount, FailedCount: row.FailedCount,
				PendingCount: row.PendingCount,
				PassRate:     passRate(row.PassedCount, row.FailedCount),
			}
			if hasNote {
				noteCopy := note
				entry.Note = &noteCopy
			}
			switch {
			case !applicable:
				entry.Status = coverageStatusNotApplicable
				result.Summary.NotApplicable++
			case row.ItemCount > 0:
				entry.Status = coverageStatusCovered
				hasCovered = true
				result.Summary.Covered++
			case hasNote:
				entry.Status = coverageStatusExplained
				hasExplained = true
				result.Summary.Explained++
			default:
				entry.Status = coverageStatusMissing
				hasMissing = true
				result.Summary.Missing++
			}
			if applicable {
				result.Summary.Applicable++
				card.Applicable = true
			}
			card.ItemCount += row.ItemCount
			card.CaseCount += row.CaseCount
			card.PassedCount += row.PassedCount
			card.FailedCount += row.FailedCount
			card.PendingCount += row.PendingCount
			card.Rounds = append(card.Rounds, entry)
		}
		card.PassRate = passRate(card.PassedCount, card.FailedCount)
		if !allRounds && len(card.Rounds) == 1 && card.Rounds[0].Note != nil {
			noteCopy := *card.Rounds[0].Note
			card.Note = &noteCopy
		}
		switch {
		case hasMissing:
			card.Status = coverageStatusMissing
		case hasCovered:
			card.Status = coverageStatusCovered
		case hasExplained:
			card.Status = coverageStatusExplained
		default:
			card.Status = coverageStatusNotApplicable
		}
		result.Summary.TestItemCount += card.ItemCount
		result.Summary.CaseCount += card.CaseCount
		result.Types = append(result.Types, card)
	}
	return result, nil
}

// SaveTypeCoverageNote 保存某轮某类型的"不测评说明"。
func (s *Service) SaveTypeCoverageNote(
	ctx context.Context,
	projectID, roundID, typeCode, reasonText, userID string,
) (TypeCoverageNote, error) {
	if strings.EqualFold(strings.TrimSpace(roundID), "all") {
		return TypeCoverageNote{}, ErrCoverageRoundRequired
	}
	reasonText = strings.TrimSpace(reasonText)
	if reasonText == "" {
		return TypeCoverageNote{}, ErrCoverageReasonRequired
	}
	round, err := s.ResolveRound(ctx, projectID, roundID)
	if err != nil {
		return TypeCoverageNote{}, err
	}
	itemType, err := findItemType(s.db.WithContext(ctx), typeCode)
	if err != nil {
		return TypeCoverageNote{}, err
	}
	if itemType.IsStatic && round.RoundNumber > 1 {
		return TypeCoverageNote{}, ErrCoverageNotApplicable
	}
	var itemCount int64
	if err := s.db.WithContext(ctx).Model(&TestItem{}).
		Where("project_id = ? AND round_id = ? AND type_code = ?", projectID, round.ID, itemType.Code).
		Count(&itemCount).Error; err != nil {
		return TypeCoverageNote{}, fmt.Errorf("查询类型覆盖状态失败: %w", err)
	}
	if itemCount > 0 {
		return TypeCoverageNote{}, ErrCoverageTypeCovered
	}

	now := timeNow()
	var existing TypeCoverageNote
	findErr := s.db.WithContext(ctx).
		Where("round_id = ? AND type_code = ?", round.ID, itemType.Code).
		First(&existing).Error
	switch {
	case findErr == nil:
		if err := s.db.WithContext(ctx).Model(&existing).Updates(map[string]any{
			"reason_text": reasonText, "updated_by": userID, "updated_at": now,
		}).Error; err != nil {
			return TypeCoverageNote{}, fmt.Errorf("更新不测评说明失败: %w", err)
		}
		existing.ReasonText = reasonText
		existing.UpdatedBy = userID
		existing.UpdatedAt = now
	case errors.Is(findErr, gorm.ErrRecordNotFound):
		recordID, idErr := id.New()
		if idErr != nil {
			return TypeCoverageNote{}, idErr
		}
		existing = TypeCoverageNote{
			ID: recordID, ProjectID: projectID, RoundID: round.ID, TypeCode: itemType.Code,
			ReasonText: reasonText, UpdatedBy: userID, CreatedAt: now, UpdatedAt: now,
		}
		if err := s.db.WithContext(ctx).Create(&existing).Error; err != nil {
			return TypeCoverageNote{}, fmt.Errorf("保存不测评说明失败: %w", err)
		}
	default:
		return TypeCoverageNote{}, fmt.Errorf("查询不测评说明失败: %w", findErr)
	}
	var updatedByName string
	if strings.TrimSpace(userID) != "" {
		_ = s.db.WithContext(ctx).Table("users").Select("display_name").
			Where("id = ?", userID).Scan(&updatedByName).Error
	}
	existing.UpdatedByName = updatedByName
	return existing, nil
}

func coverageKey(roundID, typeCode string) string { return roundID + "\x00" + typeCode }

func passRate(passed, failed int) *float64 {
	total := passed + failed
	if total == 0 {
		return nil
	}
	value := math.Round(float64(passed)/float64(total)*1000) / 10
	return &value
}
