package settings

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type Service struct {
	repository *Repository
}

func NewService(db *gorm.DB) *Service {
	return &Service{repository: NewRepository(db)}
}

// GetOrCreate 返回配置值；不存在时写入 fallback。
func (s *Service) GetOrCreate(ctx context.Context, key string, fallback func() (string, error)) (string, error) {
	setting, err := s.repository.Get(ctx, key)
	if err == nil {
		return setting.Value, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", fmt.Errorf("读取配置失败: %w", err)
	}

	value, err := fallback()
	if err != nil {
		return "", err
	}

	now := time.Now()
	if err := s.repository.Create(ctx, Setting{
		Key:       key,
		Value:     value,
		UpdatedAt: now,
	}); err != nil {
		setting, getErr := s.repository.Get(ctx, key)
		if getErr == nil {
			return setting.Value, nil
		}
		return "", fmt.Errorf("写入配置失败: %w", err)
	}
	return value, nil
}
