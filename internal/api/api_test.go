package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"chenmeridian/internal/database"
)

func TestHealthEndpoint(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "meridian.db"))
	if err != nil {
		t.Fatalf("打开测试数据库失败: %v", err)
	}
	defer func() {
		if sqlDB, closeErr := db.DB(); closeErr == nil {
			_ = sqlDB.Close()
		}
	}()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	New(db).ServeHTTP(recorder, request)

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
	if body.Status != "ok" || body.Version != version || body.SQLiteVersion == "" {
		t.Fatalf("健康检查响应异常: %+v", body)
	}
}

func TestOpenAPIAndDocs(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "meridian.db"))
	if err != nil {
		t.Fatalf("打开测试数据库失败: %v", err)
	}
	defer func() {
		if sqlDB, closeErr := db.DB(); closeErr == nil {
			_ = sqlDB.Close()
		}
	}()

	handler := New(db)

	openAPIRecorder := httptest.NewRecorder()
	openAPIRequest := httptest.NewRequest(http.MethodGet, "/openapi.json", nil)
	handler.ServeHTTP(openAPIRecorder, openAPIRequest)
	if openAPIRecorder.Code != http.StatusOK {
		t.Fatalf("OpenAPI 状态码应为 200，实际为 %d", openAPIRecorder.Code)
	}
	if !strings.Contains(openAPIRecorder.Body.String(), "/api/v1/health") {
		t.Fatal("OpenAPI 中缺少 /api/v1/health 接口")
	}

	docsRecorder := httptest.NewRecorder()
	docsRequest := httptest.NewRequest(http.MethodGet, "/docs", nil)
	handler.ServeHTTP(docsRecorder, docsRequest)
	if docsRecorder.Code != http.StatusOK {
		t.Fatalf("API 文档状态码应为 200，实际为 %d", docsRecorder.Code)
	}
}

func TestRootRedirectsToDocs(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "meridian.db"))
	if err != nil {
		t.Fatalf("打开测试数据库失败: %v", err)
	}
	defer func() {
		if sqlDB, closeErr := db.DB(); closeErr == nil {
			_ = sqlDB.Close()
		}
	}()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	New(db).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusTemporaryRedirect {
		t.Fatalf("根路径状态码应为 307，实际为 %d", recorder.Code)
	}
	if location := recorder.Header().Get("Location"); location != "/docs" {
		t.Fatalf("根路径应跳转到 /docs，实际为 %s", location)
	}
}
