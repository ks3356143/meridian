package users

import (
	"context"
	"path/filepath"
	"testing"

	"chenmeridian/internal/database"
	"chenmeridian/migrations"
)

func TestEnsureAdminResetsFixedPassword(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "meridian.db"))
	if err != nil {
		t.Fatalf("打开测试数据库失败: %v", err)
	}
	defer func() {
		if sqlDB, closeErr := db.DB(); closeErr == nil {
			_ = sqlDB.Close()
		}
	}()
	if err := database.Migrate(db, migrations.FS); err != nil {
		t.Fatalf("执行迁移失败: %v", err)
	}

	service := NewService(db)
	if err := service.EnsureAdmin(context.Background()); err != nil {
		t.Fatalf("初始化管理员失败: %v", err)
	}
	if err := db.Exec(
		"UPDATE users SET password_hash = ? WHERE username = ?",
		"$2a$10$invalid-fixed-password-hash-for-test",
		AdminUsername,
	).Error; err != nil {
		t.Fatalf("修改管理员密码哈希失败: %v", err)
	}
	if err := service.EnsureAdmin(context.Background()); err != nil {
		t.Fatalf("校正管理员失败: %v", err)
	}

	user, err := service.Authenticate(context.Background(), AdminUsername, AdminPassword)
	if err != nil {
		t.Fatalf("固定管理员登录失败: %v", err)
	}
	if user.Username != AdminUsername || user.DisplayName != "系统管理员" {
		t.Fatalf("固定管理员信息异常: %+v", user)
	}
}
