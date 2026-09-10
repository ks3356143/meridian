package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRelatedPartyManagementFlow(t *testing.T) {
	handler := newTestHandler(t)
	token := loginForProjectTest(t, handler)

	createBody, err := json.Marshal(map[string]any{
		"category":  "developer",
		"name":      "XX研究所",
		"contact":   "张工",
		"phone":     "13800000000",
		"address":   "北京市海淀区",
		"sortOrder": 1,
		"isEnabled": true,
	})
	if err != nil {
		t.Fatalf("构造相关方请求失败: %v", err)
	}

	createRecorder := httptest.NewRecorder()
	createRequest := httptest.NewRequest(http.MethodPost, "/api/v1/related-parties", bytes.NewReader(createBody))
	createRequest.Header.Set("Content-Type", "application/json")
	createRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(createRecorder, createRequest)
	if createRecorder.Code != http.StatusOK {
		t.Fatalf("新增相关方状态码应为 200，实际为 %d，响应: %s", createRecorder.Code, createRecorder.Body.String())
	}

	var created struct {
		ID       string `json:"id"`
		Category string `json:"category"`
		Name     string `json:"name"`
		Contact  string `json:"contact"`
		Phone    string `json:"phone"`
		Address  string `json:"address"`
	}
	if err := json.Unmarshal(createRecorder.Body.Bytes(), &created); err != nil {
		t.Fatalf("解析相关方响应失败: %v", err)
	}
	if created.Category != "developer" || created.Name != "XX研究所" ||
		created.Contact != "张工" || created.Phone != "13800000000" ||
		created.Address != "北京市海淀区" {
		t.Fatalf("相关方字段不符: %+v", created)
	}

	duplicateRecorder := httptest.NewRecorder()
	duplicateRequest := httptest.NewRequest(http.MethodPost, "/api/v1/related-parties", bytes.NewReader(createBody))
	duplicateRequest.Header.Set("Content-Type", "application/json")
	duplicateRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(duplicateRecorder, duplicateRequest)
	if duplicateRecorder.Code != http.StatusConflict {
		t.Fatalf("同类重复相关方应返回 409，实际为 %d", duplicateRecorder.Code)
	}

	updateBody, err := json.Marshal(map[string]any{
		"category":  "developer",
		"name":      "XX研究院",
		"contact":   "李工",
		"phone":     "13900000000",
		"address":   "上海市浦东新区",
		"sortOrder": 2,
		"isEnabled": false,
	})
	if err != nil {
		t.Fatalf("构造相关方编辑请求失败: %v", err)
	}

	updateRecorder := httptest.NewRecorder()
	updateRequest := httptest.NewRequest(http.MethodPut, "/api/v1/related-parties/"+created.ID, bytes.NewReader(updateBody))
	updateRequest.Header.Set("Content-Type", "application/json")
	updateRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(updateRecorder, updateRequest)
	if updateRecorder.Code != http.StatusOK {
		t.Fatalf("编辑相关方状态码应为 200，实际为 %d，响应: %s", updateRecorder.Code, updateRecorder.Body.String())
	}

	var updated struct {
		Name      string `json:"name"`
		SortOrder int    `json:"sortOrder"`
		IsEnabled bool   `json:"isEnabled"`
	}
	if err := json.Unmarshal(updateRecorder.Body.Bytes(), &updated); err != nil {
		t.Fatalf("解析编辑响应失败: %v", err)
	}
	if updated.Name != "XX研究院" || updated.SortOrder != 2 || updated.IsEnabled {
		t.Fatalf("编辑结果不符: %+v", updated)
	}

	listRecorder := httptest.NewRecorder()
	listRequest := httptest.NewRequest(http.MethodGet, "/api/v1/related-parties", nil)
	listRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(listRecorder, listRequest)
	if listRecorder.Code != http.StatusOK {
		t.Fatalf("相关方列表状态码应为 200，实际为 %d", listRecorder.Code)
	}

	var list []struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(listRecorder.Body.Bytes(), &list); err != nil {
		t.Fatalf("解析相关方列表失败: %v", err)
	}
	if len(list) != 1 || list[0].Name != "XX研究院" {
		t.Fatalf("相关方列表不符: %+v", list)
	}

	invalidBody, err := json.Marshal(map[string]any{
		"category":  "unknown",
		"name":      "非法类别",
		"sortOrder": 1,
		"isEnabled": true,
	})
	if err != nil {
		t.Fatalf("构造非法请求失败: %v", err)
	}

	invalidRecorder := httptest.NewRecorder()
	invalidRequest := httptest.NewRequest(http.MethodPost, "/api/v1/related-parties", bytes.NewReader(invalidBody))
	invalidRequest.Header.Set("Content-Type", "application/json")
	invalidRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(invalidRecorder, invalidRequest)
	if invalidRecorder.Code < http.StatusBadRequest {
		t.Fatalf("非法类别应返回 4xx，实际为 %d", invalidRecorder.Code)
	}
}
