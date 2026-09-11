package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func loginTestUser(t *testing.T, handler http.Handler, username string, password string) (string, string) {
	t.Helper()

	body, err := json.Marshal(map[string]string{"username": username, "password": password})
	if err != nil {
		t.Fatalf("构造登录请求失败: %v", err)
	}
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("登录 %s 状态码应为 200，实际为 %d，响应: %s", username, recorder.Code, recorder.Body.String())
	}

	var response struct {
		AccessToken string `json:"accessToken"`
		User        struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("解析登录响应失败: %v", err)
	}
	if response.AccessToken == "" || response.User.ID == "" {
		t.Fatalf("登录响应缺少令牌或用户 ID: %s", recorder.Body.String())
	}
	return response.AccessToken, response.User.ID
}

func TestAdminProtectionAndCurrentUser(t *testing.T) {
	handler := newTestHandler(t)
	adminToken, adminID := loginTestUser(t, handler, "admin", "admin123")

	createBody, _ := json.Marshal(map[string]string{
		"username":    "operator",
		"displayName": "普通用户",
		"password":    "operator123",
	})
	createRecorder := httptest.NewRecorder()
	createRequest := httptest.NewRequest(http.MethodPost, "/api/v1/users", bytes.NewReader(createBody))
	createRequest.Header.Set("Content-Type", "application/json")
	createRequest.Header.Set("Authorization", "Bearer "+adminToken)
	handler.ServeHTTP(createRecorder, createRequest)
	if createRecorder.Code != http.StatusOK {
		t.Fatalf("创建用户状态码应为 200，实际为 %d，响应: %s", createRecorder.Code, createRecorder.Body.String())
	}

	operatorToken, _ := loginTestUser(t, handler, "operator", "operator123")
	meRecorder := httptest.NewRecorder()
	meRequest := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	meRequest.Header.Set("Authorization", "Bearer "+operatorToken)
	handler.ServeHTTP(meRecorder, meRequest)
	if meRecorder.Code != http.StatusOK {
		t.Fatalf("当前用户状态码应为 200，实际为 %d，响应: %s", meRecorder.Code, meRecorder.Body.String())
	}
	var meResponse struct {
		Username    string `json:"username"`
		DisplayName string `json:"displayName"`
	}
	if err := json.Unmarshal(meRecorder.Body.Bytes(), &meResponse); err != nil {
		t.Fatalf("解析当前用户失败: %v", err)
	}
	if meResponse.Username != "operator" || meResponse.DisplayName != "普通用户" {
		t.Fatalf("当前用户应返回 operator，实际: %+v", meResponse)
	}

	deleteRecorder := httptest.NewRecorder()
	deleteRequest := httptest.NewRequest(http.MethodDelete, "/api/v1/users/"+adminID, nil)
	deleteRequest.Header.Set("Authorization", "Bearer "+operatorToken)
	handler.ServeHTTP(deleteRecorder, deleteRequest)
	if deleteRecorder.Code != http.StatusBadRequest {
		t.Fatalf("删除管理员状态码应为 400，实际为 %d，响应: %s", deleteRecorder.Code, deleteRecorder.Body.String())
	}
	if !strings.Contains(deleteRecorder.Body.String(), "系统管理员账号不允许删除") {
		t.Fatalf("删除管理员应返回固定中文错误，响应: %s", deleteRecorder.Body.String())
	}

	updateBody, _ := json.Marshal(map[string]string{
		"displayName": "系统管理员",
		"password":    "changed123",
	})
	updateRecorder := httptest.NewRecorder()
	updateRequest := httptest.NewRequest(http.MethodPut, "/api/v1/users/"+adminID, bytes.NewReader(updateBody))
	updateRequest.Header.Set("Content-Type", "application/json")
	updateRequest.Header.Set("Authorization", "Bearer "+adminToken)
	handler.ServeHTTP(updateRecorder, updateRequest)
	if updateRecorder.Code != http.StatusBadRequest {
		t.Fatalf("修改管理员密码状态码应为 400，实际为 %d，响应: %s", updateRecorder.Code, updateRecorder.Body.String())
	}
	if !strings.Contains(updateRecorder.Body.String(), "系统管理员密码固定") {
		t.Fatalf("修改管理员密码应返回固定中文错误，响应: %s", updateRecorder.Body.String())
	}

	loginRecorder := httptest.NewRecorder()
	loginRequest := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/auth/login",
		strings.NewReader(`{"username":"admin","password":"admin123"}`),
	)
	loginRequest.Header.Set("Content-Type", "application/json")
	handler.ServeHTTP(loginRecorder, loginRequest)
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("固定管理员登录状态码应为 200，实际为 %d，响应: %s", loginRecorder.Code, loginRecorder.Body.String())
	}
}
