package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	authservice "chenmeridian/internal/auth"
	"chenmeridian/internal/database"
	"chenmeridian/internal/modules/settings"
	"chenmeridian/internal/modules/users"
	"chenmeridian/migrations"
)

func newTestHandler(t *testing.T) http.Handler {
	t.Helper()

	db, err := database.Open(filepath.Join(t.TempDir(), "meridian.db"))
	if err != nil {
		t.Fatalf("打开测试数据库失败: %v", err)
	}
	t.Cleanup(func() {
		if sqlDB, closeErr := db.DB(); closeErr == nil {
			_ = sqlDB.Close()
		}
	})

	if err := database.Migrate(db, migrations.FS); err != nil {
		t.Fatalf("执行迁移失败: %v", err)
	}

	userService := users.NewService(db)
	if err := userService.EnsureAdmin(context.Background()); err != nil {
		t.Fatalf("创建测试管理员失败: %v", err)
	}

	authService, err := authservice.NewService(db, userService, settings.NewService(db), time.Hour)
	if err != nil {
		t.Fatalf("初始化认证服务失败: %v", err)
	}

	return New(db, authService)
}

func TestHealthEndpoint(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	newTestHandler(t).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("状态码应为 200，实际为 %d，响应: %s", recorder.Code, recorder.Body.String())
	}

	var body struct {
		Status        string `json:"status"`
		Version       string `json:"version"`
		SQLiteVersion string `json:"sqliteVersion"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("解析响应失败: %v", err)
	}
	if body.Status != "ok" || body.Version != Version || body.SQLiteVersion == "" {
		t.Fatalf("健康检查响应异常: %+v", body)
	}
}

func TestOpenAPIAndDocs(t *testing.T) {
	handler := newTestHandler(t)

	openAPIRecorder := httptest.NewRecorder()
	openAPIRequest := httptest.NewRequest(http.MethodGet, "/openapi.json", nil)
	handler.ServeHTTP(openAPIRecorder, openAPIRequest)
	if openAPIRecorder.Code != http.StatusOK {
		t.Fatalf("OpenAPI 状态码应为 200，实际为 %d", openAPIRecorder.Code)
	}
	openAPIBody := openAPIRecorder.Body.String()
	if !strings.Contains(openAPIBody, "/api/v1/health") ||
		!strings.Contains(openAPIBody, "/api/v1/auth/login") ||
		!strings.Contains(openAPIBody, "/api/v1/auth/me") {
		t.Fatal("OpenAPI 中缺少认证接口")
	}

	docsRecorder := httptest.NewRecorder()
	docsRequest := httptest.NewRequest(http.MethodGet, "/docs", nil)
	handler.ServeHTTP(docsRecorder, docsRequest)
	if docsRecorder.Code != http.StatusOK {
		t.Fatalf("API 文档状态码应为 200，实际为 %d", docsRecorder.Code)
	}
}

func TestRootRedirectsToDocs(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	newTestHandler(t).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusTemporaryRedirect {
		t.Fatalf("根路径状态码应为 307，实际为 %d", recorder.Code)
	}
	if location := recorder.Header().Get("Location"); location != "/docs" {
		t.Fatalf("根路径应跳转到 /docs，实际为 %s", location)
	}
}

func TestAuthFlow(t *testing.T) {
	handler := newTestHandler(t)

	loginBody, err := json.Marshal(map[string]string{
		"username": "admin",
		"password": "admin123",
	})
	if err != nil {
		t.Fatalf("构造登录请求失败: %v", err)
	}

	loginRecorder := httptest.NewRecorder()
	loginRequest := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(loginBody))
	loginRequest.Header.Set("Content-Type", "application/json")
	handler.ServeHTTP(loginRecorder, loginRequest)

	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("登录状态码应为 200，实际为 %d，响应: %s", loginRecorder.Code, loginRecorder.Body.String())
	}

	var loginResponse struct {
		AccessToken string `json:"accessToken"`
		User        struct {
			Username string `json:"username"`
		} `json:"user"`
	}
	if err := json.Unmarshal(loginRecorder.Body.Bytes(), &loginResponse); err != nil {
		t.Fatalf("解析登录响应失败: %v", err)
	}
	if loginResponse.AccessToken == "" || loginResponse.User.Username != "admin" {
		t.Fatalf("登录响应异常: %+v", loginResponse)
	}

	unauthorizedRecorder := httptest.NewRecorder()
	unauthorizedRequest := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	handler.ServeHTTP(unauthorizedRecorder, unauthorizedRequest)
	if unauthorizedRecorder.Code != http.StatusUnauthorized {
		t.Fatalf("未登录状态码应为 401，实际为 %d", unauthorizedRecorder.Code)
	}

	meRecorder := httptest.NewRecorder()
	meRequest := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	meRequest.Header.Set("Authorization", "Bearer "+loginResponse.AccessToken)
	handler.ServeHTTP(meRecorder, meRequest)

	if meRecorder.Code != http.StatusOK {
		t.Fatalf("当前用户状态码应为 200，实际为 %d，响应: %s", meRecorder.Code, meRecorder.Body.String())
	}
	var meResponse struct {
		Username string `json:"username"`
	}
	if err := json.Unmarshal(meRecorder.Body.Bytes(), &meResponse); err != nil {
		t.Fatalf("解析当前用户响应失败: %v", err)
	}
	if meResponse.Username != "admin" {
		t.Fatalf("当前用户响应异常: %+v", meResponse)
	}
}

func TestLoginRejectsInvalidPassword(t *testing.T) {
	requestBody, _ := json.Marshal(map[string]string{
		"username": "admin",
		"password": "wrong-password",
	})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(requestBody))
	request.Header.Set("Content-Type", "application/json")
	newTestHandler(t).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("错误密码状态码应为 401，实际为 %d", recorder.Code)
	}
}
