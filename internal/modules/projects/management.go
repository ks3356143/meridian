package projects

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"chenmeridian/internal/id"
)

var (
	ErrDictionaryNotFound = errors.New("技术字典不存在")
	ErrDictionaryExists   = errors.New("技术字典已存在")
	ErrStandardExists     = errors.New("依据标准已存在")
)

var dictionaryCategories = map[string]struct{}{
	"language":                {},
	"runtime_environment":     {},
	"development_environment": {},
}

type DictionaryItemResponse struct {
	ID        string `json:"id"`
	Category  string `json:"category"`
	Name      string `json:"name"`
	SortOrder int    `json:"sortOrder"`
	IsEnabled bool   `json:"isEnabled"`
	IsPreset  bool   `json:"isPreset"`
}

type SaveDictionaryInput struct {
	Category  string
	Name      string
	SortOrder int
	IsEnabled bool
}

type SaveReferenceStandardInput struct {
	Name          string
	Code          string
	PublishedDate string
	Source        string
	SortOrder     int
	IsEnabled     bool
}

func (s *Service) ListDictionaryManagement(ctx context.Context) ([]DictionaryItemResponse, error) {
	items, err := s.repository.ListDictionaryItems(ctx, false)
	if err != nil {
		return nil, fmt.Errorf("查询技术字典失败: %w", err)
	}
	responses := make([]DictionaryItemResponse, 0, len(items))
	for _, item := range items {
		responses = append(responses, toDictionaryItemResponse(item))
	}
	return responses, nil
}

func (s *Service) CreateDictionary(ctx context.Context, input SaveDictionaryInput) (DictionaryItemResponse, error) {
	item, err := s.saveDictionary(ctx, "", input)
	if err != nil {
		return DictionaryItemResponse{}, err
	}
	return toDictionaryItemResponse(item), nil
}

func (s *Service) UpdateDictionary(
	ctx context.Context,
	dictionaryID string,
	input SaveDictionaryInput,
) (DictionaryItemResponse, error) {
	item, err := s.saveDictionary(ctx, dictionaryID, input)
	if err != nil {
		return DictionaryItemResponse{}, err
	}
	return toDictionaryItemResponse(item), nil
}

func (s *Service) ListStandardManagement(ctx context.Context) ([]ReferenceStandardResponse, error) {
	standards, err := s.repository.ListReferenceStandards(ctx, false)
	if err != nil {
		return nil, fmt.Errorf("查询依据标准失败: %w", err)
	}
	responses := make([]ReferenceStandardResponse, 0, len(standards))
	for _, standard := range standards {
		responses = append(responses, toStandardResponse(standard))
	}
	return responses, nil
}

func (s *Service) CreateStandard(
	ctx context.Context,
	input SaveReferenceStandardInput,
) (ReferenceStandardResponse, error) {
	standard, err := s.saveStandard(ctx, "", input)
	if err != nil {
		return ReferenceStandardResponse{}, err
	}
	return toStandardResponse(standard), nil
}

func (s *Service) UpdateStandard(
	ctx context.Context,
	standardID string,
	input SaveReferenceStandardInput,
) (ReferenceStandardResponse, error) {
	standard, err := s.saveStandard(ctx, standardID, input)
	if err != nil {
		return ReferenceStandardResponse{}, err
	}
	return toStandardResponse(standard), nil
}

func (s *Service) saveDictionary(
	ctx context.Context,
	dictionaryID string,
	input SaveDictionaryInput,
) (DictionaryItem, error) {
	category := strings.TrimSpace(input.Category)
	name := strings.TrimSpace(input.Name)
	if _, valid := dictionaryCategories[category]; !valid {
		return DictionaryItem{}, fmt.Errorf("技术字典类型不合法")
	}
	if name == "" {
		return DictionaryItem{}, fmt.Errorf("技术字典名称不能为空")
	}
	if input.SortOrder < 0 {
		return DictionaryItem{}, fmt.Errorf("技术字典排序不能小于 0")
	}

	item := DictionaryItem{
		Category:  category,
		Name:      name,
		SortOrder: input.SortOrder,
		IsEnabled: input.IsEnabled,
	}

	if dictionaryID == "" {
		if _, err := s.repository.FindDictionaryByName(ctx, category, name, ""); err == nil {
			return DictionaryItem{}, ErrDictionaryExists
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return DictionaryItem{}, fmt.Errorf("检查技术字典失败: %w", err)
		}

		newID, err := id.New()
		if err != nil {
			return DictionaryItem{}, err
		}
		item.ID = newID
		item.IsPreset = false
		item.CreatedAt = time.Now()
		item.UpdatedAt = item.CreatedAt
		if err := s.repository.CreateDictionaryItem(ctx, item); err != nil {
			return DictionaryItem{}, fmt.Errorf("保存技术字典失败: %w", err)
		}
		return item, nil
	}

	existing, err := s.repository.FindDictionaryByID(ctx, dictionaryID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return DictionaryItem{}, ErrDictionaryNotFound
		}
		return DictionaryItem{}, fmt.Errorf("查询技术字典失败: %w", err)
	}
	if _, err := s.repository.FindDictionaryByName(ctx, category, name, dictionaryID); err == nil {
		return DictionaryItem{}, ErrDictionaryExists
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return DictionaryItem{}, fmt.Errorf("检查技术字典失败: %w", err)
	}

	item.ID = existing.ID
	item.IsPreset = existing.IsPreset
	item.CreatedAt = existing.CreatedAt
	item.UpdatedAt = time.Now()
	if err := s.repository.UpdateDictionaryItem(ctx, dictionaryID, dictionaryUpdates(item)); err != nil {
		return DictionaryItem{}, fmt.Errorf("保存技术字典失败: %w", err)
	}
	return item, nil
}

func (s *Service) saveStandard(
	ctx context.Context,
	standardID string,
	input SaveReferenceStandardInput,
) (ReferenceStandard, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return ReferenceStandard{}, fmt.Errorf("依据标准名称不能为空")
	}
	if input.SortOrder < 0 {
		return ReferenceStandard{}, fmt.Errorf("依据标准排序不能小于 0")
	}

	standard := ReferenceStandard{
		Name:          name,
		Code:          strings.TrimSpace(input.Code),
		PublishedDate: strings.TrimSpace(input.PublishedDate),
		Source:        strings.TrimSpace(input.Source),
		SortOrder:     input.SortOrder,
		IsEnabled:     input.IsEnabled,
	}

	if standardID == "" {
		if _, err := s.repository.FindStandardByName(ctx, name, ""); err == nil {
			return ReferenceStandard{}, ErrStandardExists
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return ReferenceStandard{}, fmt.Errorf("检查依据标准失败: %w", err)
		}

		newID, err := id.New()
		if err != nil {
			return ReferenceStandard{}, err
		}
		standard.ID = newID
		standard.CreatedAt = time.Now()
		standard.UpdatedAt = standard.CreatedAt
		if err := s.repository.CreateReferenceStandard(ctx, standard); err != nil {
			return ReferenceStandard{}, fmt.Errorf("保存依据标准失败: %w", err)
		}
		return standard, nil
	}

	existing, err := s.repository.FindStandardByID(ctx, standardID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ReferenceStandard{}, ErrStandardNotFound
		}
		return ReferenceStandard{}, fmt.Errorf("查询依据标准失败: %w", err)
	}
	if _, err := s.repository.FindStandardByName(ctx, name, standardID); err == nil {
		return ReferenceStandard{}, ErrStandardExists
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return ReferenceStandard{}, fmt.Errorf("检查依据标准失败: %w", err)
	}

	standard.ID = existing.ID
	standard.CreatedAt = existing.CreatedAt
	standard.UpdatedAt = time.Now()
	if err := s.repository.UpdateReferenceStandard(ctx, standardID, standardUpdates(standard)); err != nil {
		return ReferenceStandard{}, fmt.Errorf("保存依据标准失败: %w", err)
	}
	return standard, nil
}

func toDictionaryItemResponse(item DictionaryItem) DictionaryItemResponse {
	return DictionaryItemResponse{
		ID:        item.ID,
		Category:  item.Category,
		Name:      item.Name,
		SortOrder: item.SortOrder,
		IsEnabled: item.IsEnabled,
		IsPreset:  item.IsPreset,
	}
}
