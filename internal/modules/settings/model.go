package settings

import "time"

type Setting struct {
	Key       string    `gorm:"column:key;primaryKey" json:"key"`
	Value     string    `gorm:"column:value;not null" json:"value"`
	UpdatedAt time.Time `gorm:"column:updated_at;not null" json:"updatedAt"`
}

func (Setting) TableName() string { return "settings" }
