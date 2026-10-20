package testitems

import (
	"context"
	"errors"
	"fmt"
	"sort"
)

type projectStaticProfile struct {
	SecurityLevel string `gorm:"column:security_level"`
	Platform      string `gorm:"column:platform"`
}

// recommendedStaticCodes 返回按安全等级与平台应存在的静态测试项。
func recommendedStaticCodes(level, platform string) []string {
	codes := []string{"DC"}
	if platform != "FPGA" {
		codes = append(codes, "SA")
	}
	if level == "A" || level == "B" || level == "C" {
		codes = append(codes, "CR")
	}
	if level == "A" {
		codes = append(codes, "CW")
	}
	return codes
}

// EnsureRecommendedStaticItems 首次进入或显式生成时按项目安全等级补齐静态测试项。
// 已生成过的项目不会被自动回填用户主动删除的项；显式 force=true 才补齐。
func (s *Service) EnsureRecommendedStaticItems(ctx context.Context, projectID string, force bool) ([]TestItem, error) {
	var profile projectStaticProfile
	if err := s.db.WithContext(ctx).Table("projects").
		Select("security_level, platform").Where("id = ?", projectID).Scan(&profile).Error; err != nil {
		return nil, fmt.Errorf("查询项目静态测试配置失败: %w", err)
	}
	if profile.SecurityLevel == "" {
		return nil, ErrProjectNotFound
	}

	var seededLevel, seededPlatform string
	_ = s.db.WithContext(ctx).Table("project_static_seeds").
		Select("security_level, platform").Where("project_id = ?", projectID).
		Row().Scan(&seededLevel, &seededPlatform)
	if !force && seededLevel == profile.SecurityLevel && seededPlatform == profile.Platform {
		return []TestItem{}, nil
	}

	var existing []TestItem
	if err := s.db.WithContext(ctx).
		Where("project_id = ? AND type_code IN ?", projectID, recommendedStaticCodes(profile.SecurityLevel, profile.Platform)).
		Find(&existing).Error; err != nil {
		return nil, fmt.Errorf("查询现有静态测试项失败: %w", err)
	}
	existingByType := make(map[string]TestItem, len(existing))
	for _, item := range existing {
		existingByType[item.TypeCode] = item
	}

	created := make([]TestItem, 0, 4)
	for _, code := range recommendedStaticCodes(profile.SecurityLevel, profile.Platform) {
		if _, exists := existingByType[code]; exists {
			continue
		}
		itemType, err := findItemType(s.db, code)
		if err != nil {
			return nil, err
		}
		item, err := s.CreateTestItem(ctx, CreateTestItemInput{
			ProjectID: projectID,
			TypeCode:  code,
			Name:      itemType.Name,
			Priority:  "中",
		})
		if errors.Is(err, ErrStaticTypeExists) {
			continue
		}
		if err != nil {
			return nil, err
		}
		created = append(created, item)
	}

	if err := s.db.WithContext(ctx).Exec(`
INSERT INTO project_static_seeds (project_id, security_level, platform, seeded_at)
VALUES (?, ?, ?, datetime('now'))
ON CONFLICT(project_id) DO UPDATE SET
  security_level = excluded.security_level,
  platform = excluded.platform,
  seeded_at = excluded.seeded_at`,
		projectID, profile.SecurityLevel, profile.Platform).Error; err != nil {
		return nil, fmt.Errorf("记录静态测试生成状态失败: %w", err)
	}
	sort.Slice(created, func(i, j int) bool { return created[i].TypeCode < created[j].TypeCode })
	return created, nil
}

// DeleteAllStaticItems 删除项目内全部静态测试项；用户主动删除后不再自动回填。
func (s *Service) DeleteAllStaticItems(ctx context.Context, projectID string) (int64, error) {
	result := s.db.WithContext(ctx).Exec(`
DELETE FROM test_items
WHERE project_id = ? AND type_code IN (SELECT code FROM test_item_types WHERE is_static = 1)`, projectID)
	if result.Error != nil {
		return 0, fmt.Errorf("删除静态测试项失败: %w", result.Error)
	}
	return result.RowsAffected, nil
}
