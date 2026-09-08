package settings

import (
	"context"

	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Get(ctx context.Context, key string) (Setting, error) {
	var setting Setting
	if err := r.db.WithContext(ctx).Where("key = ?", key).First(&setting).Error; err != nil {
		return Setting{}, err
	}
	return setting, nil
}

func (r *Repository) Create(ctx context.Context, setting Setting) error {
	return r.db.WithContext(ctx).Create(&setting).Error
}
