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
	return newTestHandlerWithAssetRoot(t, filepath.Join(t.TempDir(), "file-assets"))
}

func newTestHandlerWithAssetRoot(t *testing.T, assetRoot string) http.Handler {
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

	return NewWithAssetRoot(db, authService, assetRoot)
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

func TestStepViewSchemaLinkIncludesEmbeddedFields(t *testing.T) {
	handler := newTestHandler(t)
	token := loginForProjectTest(t, handler)
	projectCode := createWorkObjectTestProject(t, handler, token)

	item := postJSONMap(t, handler, token, http.MethodPost,
		"/api/v1/projects/"+projectCode+"/test-items", map[string]string{
			"typeCode": "SU",
			"name":     "步骤视图 schema 回归",
		}, http.StatusOK)
	itemID, _ := item["id"].(string)
	if itemID == "" {
		t.Fatalf("创建测试项响应缺少 id: %+v", item)
	}

	itemCase := postJSONMap(t, handler, token, http.MethodPost,
		"/api/v1/test-items/"+itemID+"/cases", map[string]string{"name": "步骤视图用例"}, http.StatusOK)
	caseID, _ := itemCase["id"].(string)
	if caseID == "" {
		t.Fatalf("创建用例响应缺少 id: %+v", itemCase)
	}

	step := postJSONMap(t, handler, token, http.MethodPost,
		"/api/v1/test-cases/"+caseID+"/steps", map[string]string{"expectText": "预期结果"}, http.StatusOK)
	stepID, _ := step["id"].(string)
	if stepID == "" {
		t.Fatalf("创建步骤响应缺少 id: %+v", step)
	}

	recorder := postJSONRecorder(t, handler, token, http.MethodPut,
		"/api/v1/test-case-steps/"+stepID+"/blocks", map[string]any{
			"op": map[string]any{
				"type": "doc",
				"content": []any{map[string]any{
					"type":    "paragraph",
					"content": []any{map[string]any{"type": "text", "text": "步骤操作"}},
				}},
			},
		})
	if recorder.Code != http.StatusOK {
		t.Fatalf("保存步骤块状态码应为 200，实际 %d，响应: %s", recorder.Code, recorder.Body.String())
	}
	if link := recorder.Header().Get("Link"); !strings.Contains(link, "/schemas/StepView.json") {
		t.Fatalf("步骤响应缺少 schema 链接头: %q，响应: %s", link, recorder.Body.String())
	}

	var view map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &view); err != nil {
		t.Fatalf("解析步骤响应失败: %v", err)
	}
	expected := []string{
		"$schema", "id", "testCaseId", "seq", "expectText", "passed", "sortOrder",
		"createdAt", "updatedAt", "op", "act",
	}
	for _, key := range expected {
		if _, ok := view[key]; !ok {
			t.Fatalf("步骤视图缺少字段 %q: %+v", key, view)
		}
	}
	if view["id"] != stepID {
		t.Fatalf("步骤 id 不正确: %+v", view)
	}

	schemaRecorder := postJSONRecorder(t, handler, token, http.MethodGet, "/schemas/StepView.json", nil)
	if schemaRecorder.Code != http.StatusOK {
		t.Fatalf("步骤 schema 状态码应为 200，实际 %d", schemaRecorder.Code)
	}
	var schema struct {
		Properties map[string]any `json:"properties"`
	}
	if err := json.Unmarshal(schemaRecorder.Body.Bytes(), &schema); err != nil {
		t.Fatalf("解析步骤 schema 失败: %v", err)
	}
	for _, key := range []string{"id", "expectText", "op", "act"} {
		if _, ok := schema.Properties[key]; !ok {
			t.Fatalf("步骤 schema 缺少字段 %q", key)
		}
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
