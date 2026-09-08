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
	"chenmeridian/internal/config"
	"chenmeridian/internal/database"
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

	server := &http.Server{
		Addr:              cfg.Addr,
		Handler:           api.New(db),
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
