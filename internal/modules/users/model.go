package users

import "time"

type User struct {
	ID           string    `gorm:"column:id;primaryKey" json:"id"`
	Username     string    `gorm:"column:username;uniqueIndex" json:"username"`
	DisplayName  string    `gorm:"column:display_name" json:"displayName"`
	PasswordHash string    `gorm:"column:password_hash" json:"-"`
	CreatedAt    time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt    time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (User) TableName() string { return "users" }
