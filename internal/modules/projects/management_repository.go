package projects

import (
	"context"
	"time"
)

func (r *Repository) FindDictionaryByID(ctx context.Context, id string) (DictionaryItem, error) {
	var item DictionaryItem
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&item).Error; err != nil {
		return DictionaryItem{}, err
	}
	return item, nil
}

func (r *Repository) FindDictionaryByName(
	ctx context.Context,
	category string,
	name string,
	excludeID string,
) (DictionaryItem, error) {
	query := r.db.WithContext(ctx).
		Where("category = ? AND lower(name) = lower(?)", category, name)
	if excludeID != "" {
		query = query.Where("id <> ?", excludeID)
	}
	var item DictionaryItem
	if err := query.First(&item).Error; err != nil {
		return DictionaryItem{}, err
	}
	return item, nil
}

func (r *Repository) CreateDictionaryItem(ctx context.Context, item DictionaryItem) error {
	return r.db.WithContext(ctx).Create(&item).Error
}

func (r *Repository) UpdateDictionaryItem(
	ctx context.Context,
	id string,
	updates map[string]any,
) error {
	return r.db.WithContext(ctx).Model(&DictionaryItem{}).Where("id = ?", id).Updates(updates).Error
}

func (r *Repository) FindStandardByID(ctx context.Context, id string) (ReferenceStandard, error) {
	var standard ReferenceStandard
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&standard).Error; err != nil {
		return ReferenceStandard{}, err
	}
	return standard, nil
}

func (r *Repository) FindStandardByName(
	ctx context.Context,
	name string,
	excludeID string,
) (ReferenceStandard, error) {
	query := r.db.WithContext(ctx).Where("lower(name) = lower(?)", name)
	if excludeID != "" {
		query = query.Where("id <> ?", excludeID)
	}
	var standard ReferenceStandard
	if err := query.First(&standard).Error; err != nil {
		return ReferenceStandard{}, err
	}
	return standard, nil
}

func (r *Repository) CreateReferenceStandard(
	ctx context.Context,
	standard ReferenceStandard,
) error {
	return r.db.WithContext(ctx).Create(&standard).Error
}

func (r *Repository) UpdateReferenceStandard(
	ctx context.Context,
	id string,
	updates map[string]any,
) error {
	return r.db.WithContext(ctx).Model(&ReferenceStandard{}).Where("id = ?", id).Updates(updates).Error
}

func (r *Repository) NextDictionarySortOrder(ctx context.Context, category string) (int, error) {
	var sortOrder int
	err := r.db.WithContext(ctx).Model(&DictionaryItem{}).
		Select("COALESCE(MAX(sort_order), 0)").
		Where("category = ?", category).
		Scan(&sortOrder).Error
	return sortOrder + 1, err
}

func (r *Repository) NextStandardSortOrder(ctx context.Context) (int, error) {
	var sortOrder int
	err := r.db.WithContext(ctx).Model(&ReferenceStandard{}).
		Select("COALESCE(MAX(sort_order), 0)").
		Scan(&sortOrder).Error
	return sortOrder + 1, err
}

func dictionaryUpdates(item DictionaryItem) map[string]any {
	return map[string]any{
		"category":   item.Category,
		"name":       item.Name,
		"sort_order": item.SortOrder,
		"is_enabled": item.IsEnabled,
		"updated_at": time.Now().UTC(),
	}
}

func standardUpdates(standard ReferenceStandard) map[string]any {
	return map[string]any{
		"name":           standard.Name,
		"code":           standard.Code,
		"published_date": standard.PublishedDate,
		"source":         standard.Source,
		"sort_order":     standard.SortOrder,
		"is_enabled":     standard.IsEnabled,
		"is_default":     standard.IsDefault,
		"updated_at":     time.Now().UTC(),
	}
}

func (r *Repository) ListRelatedParties(ctx context.Context, enabledOnly bool) ([]RelatedParty, error) {
	query := r.db.WithContext(ctx).Model(&RelatedParty{})
	if enabledOnly {
		query = query.Where("is_enabled = ?", true)
	}
	var parties []RelatedParty
	if err := query.Order("category ASC, sort_order ASC, name ASC").Find(&parties).Error; err != nil {
		return nil, err
	}
	return parties, nil
}

func (r *Repository) FindRelatedPartyByID(ctx context.Context, id string) (RelatedParty, error) {
	var party RelatedParty
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&party).Error; err != nil {
		return RelatedParty{}, err
	}
	return party, nil
}

func (r *Repository) FindRelatedPartyByName(
	ctx context.Context,
	category string,
	name string,
	excludeID string,
) (RelatedParty, error) {
	query := r.db.WithContext(ctx).
		Where("category = ?", category).
		Where("lower(name) = lower(?)", name)
	if excludeID != "" {
		query = query.Where("id <> ?", excludeID)
	}
	var party RelatedParty
	if err := query.First(&party).Error; err != nil {
		return RelatedParty{}, err
	}
	return party, nil
}

func (r *Repository) CreateRelatedParty(ctx context.Context, party RelatedParty) error {
	return r.db.WithContext(ctx).Create(&party).Error
}

func (r *Repository) UpdateRelatedParty(ctx context.Context, id string, updates map[string]any) error {
	return r.db.WithContext(ctx).Model(&RelatedParty{}).Where("id = ?", id).Updates(updates).Error
}

func relatedPartyUpdates(party RelatedParty) map[string]any {
	return map[string]any{
		"name":       party.Name,
		"contact":    party.Contact,
		"phone":      party.Phone,
		"address":    party.Address,
		"sort_order": party.SortOrder,
		"is_enabled": party.IsEnabled,
		"updated_at": time.Now().UTC(),
	}
}
