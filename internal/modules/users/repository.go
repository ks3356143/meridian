package users

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

func (r *Repository) Count(ctx context.Context) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&User{}).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func (r *Repository) FindByUsername(ctx context.Context, username string) (User, error) {
	var user User
	if err := r.db.WithContext(ctx).Where("username = ?", username).First(&user).Error; err != nil {
		return User{}, err
	}
	return user, nil
}

func (r *Repository) FindByID(ctx context.Context, id string) (User, error) {
	var user User
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&user).Error; err != nil {
		return User{}, err
	}
	return user, nil
}

func (r *Repository) List(ctx context.Context) ([]User, error) {
	var users []User
	if err := r.db.WithContext(ctx).Order("created_at ASC").Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

func (r *Repository) Create(ctx context.Context, user User) error {
	return r.db.WithContext(ctx).Create(&user).Error
}

func (r *Repository) Update(ctx context.Context, user User) error {
	return r.db.WithContext(ctx).Save(&user).Error
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&User{}).Error
}
