package id

import (
	"fmt"

	"github.com/google/uuid"
)

// New 返回统一生成的 UUIDv7 字符串。
func New() (string, error) {
	value, err := uuid.NewV7()
	if err != nil {
		return "", fmt.Errorf("生成 UUIDv7 失败: %w", err)
	}
	return value.String(), nil
}
