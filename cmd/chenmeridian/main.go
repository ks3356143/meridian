package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"chenmeridian/internal/api"
	authservice "chenmeridian/internal/auth"
	"chenmeridian/internal/config"
	"chenmeridian/internal/database"
	"chenmeridian/internal/modules/settings"
	"chenmeridian/internal/modules/users"
	"chenmeridian/migrations"
)

func main() {
	cfg := config.Load()

	if err := run(cfg); err != nil {
		log.Fatal(err)
	}
}

func run(cfg config.Config) error {
	db, err := database.Open(cfg.DBPath)
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}
	defer func() {
		if sqlDB, dbErr := db.DB(); dbErr == nil {
			_ = sqlDB.Close()
		}
	}()

	if err := database.Migrate(db, migrations.FS); err != nil {
		return fmt.Errorf("执行数据库迁移失败: %w", err)
	}

	userService := users.NewService(db)
	settingService := settings.NewService(db)
	if err := userService.EnsureAdmin(context.Background()); err != nil {
		return fmt.Errorf("初始化管理员失败: %w", err)
	}

	authService, err := authservice.NewService(db, userService, settingService, cfg.TokenTTL)
	if err != nil {
		return fmt.Errorf("初始化认证服务失败: %w", err)
	}

	server := &http.Server{
		Addr:              cfg.Addr,
		Handler:           api.NewWithAssetRoot(db, authService, cfg.AssetRoot),
		ReadHeaderTimeout: 5 * time.Second,
	}

	serverErrors := make(chan error, 1)
	go func() {
		serverErrors <- server.ListenAndServe()
	}()

	log.Printf("ChenMeridian 已启动: http://%s", cfg.Addr)
	log.Printf("API 文档: http://%s/docs", cfg.Addr)
	log.Printf("健康检查: http://%s/api/v1/health", cfg.Addr)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	select {
	case err := <-serverErrors:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return fmt.Errorf("HTTP 服务异常退出: %w", err)
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := server.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("HTTP 服务关闭失败: %w", err)
		}
		return nil
	}
}
