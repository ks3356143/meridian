package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestProjectCreateFlow(t *testing.T) {
	handler := newTestHandler(t)
	token := loginForProjectTest(t, handler)

	optionsRecorder := httptest.NewRecorder()
	optionsRequest := httptest.NewRequest(http.MethodGet, "/api/v1/project-options", nil)
	optionsRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(optionsRecorder, optionsRequest)
	if optionsRecorder.Code != http.StatusOK {
		t.Fatalf("项目选项状态码应为 200，实际为 %d，响应: %s", optionsRecorder.Code, optionsRecorder.Body.String())
	}

	var options struct {
		Dictionaries []struct {
			ID       string `json:"id"`
			Category string `json:"category"`
			Name     string `json:"name"`
		} `json:"dictionaries"`
		Standards []struct {
			ID string `json:"id"`
		} `json:"standards"`
		Users []struct {
			ID string `json:"id"`
		} `json:"users"`
	}
	if err := json.Unmarshal(optionsRecorder.Body.Bytes(), &options); err != nil {
		t.Fatalf("解析项目选项失败: %v", err)
	}
	if len(options.Users) == 0 || len(options.Standards) == 0 || len(options.Dictionaries) == 0 {
		t.Fatalf("项目选项不完整: %+v", options)
	}

	createBody, err := json.Marshal(map[string]any{
		"identifierSuffix":        "2607",
		"name":                    "XX03 探测单元鉴定测评",
		"nature":                  "鉴定测评",
		"platform":                "CPU/非嵌",
		"softwareType":            "新研",
		"classification":          "内部",
		"securityLevel":           "C",
		"organization":            "XX研究所",
		"ownerId":                 options.Users[0].ID,
		"memberIds":               []string{options.Users[0].ID},
		"languages":               []string{"C", "Rust"},
		"runtimeEnvironments":     []string{"VxWorks", "自定义运行环境"},
		"developmentEnvironments": []string{"Keil"},
		"referenceStandardIds":    []string{options.Standards[0].ID},
	})
	if err != nil {
		t.Fatalf("构造创建项目请求失败: %v", err)
	}

	createRecorder := httptest.NewRecorder()
	createRequest := httptest.NewRequest(http.MethodPost, "/api/v1/projects", bytes.NewReader(createBody))
	createRequest.Header.Set("Content-Type", "application/json")
	createRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(createRecorder, createRequest)
	if createRecorder.Code != http.StatusOK {
		t.Fatalf("创建项目状态码应为 200，实际为 %d，响应: %s", createRecorder.Code, createRecorder.Body.String())
	}

	var project struct {
		ID                      string   `json:"id"`
		Status                  string   `json:"status"`
		Languages               []string `json:"languages"`
		RuntimeEnvironments     []string `json:"runtimeEnvironments"`
		DevelopmentEnvironments []string `json:"developmentEnvironments"`
		Members                 []struct {
			ID      string `json:"id"`
			IsOwner bool   `json:"isOwner"`
		} `json:"members"`
		ReferenceStandards []struct {
			Name string `json:"name"`
		} `json:"referenceStandards"`
	}
	if err := json.Unmarshal(createRecorder.Body.Bytes(), &project); err != nil {
		t.Fatalf("解析创建项目响应失败: %v", err)
	}
	if project.ID != "R2607" || project.Status != "编制大纲中" {
		t.Fatalf("项目标识或初始状态错误: %+v", project)
	}
	if len(project.Languages) != 2 || len(project.RuntimeEnvironments) != 2 || len(project.DevelopmentEnvironments) != 1 {
		t.Fatalf("项目技术字典保存不完整: %+v", project)
	}
	if len(project.Members) != 1 || !project.Members[0].IsOwner {
		t.Fatalf("项目负责人成员关系错误: %+v", project)
	}
	if len(project.ReferenceStandards) != 1 {
		t.Fatalf("项目依据标准保存不完整: %+v", project)
	}

	listRecorder := httptest.NewRecorder()
	listRequest := httptest.NewRequest(http.MethodGet, "/api/v1/projects", nil)
	listRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(listRecorder, listRequest)
	if listRecorder.Code != http.StatusOK {
		t.Fatalf("项目列表状态码应为 200，实际为 %d", listRecorder.Code)
	}

	detailRecorder := httptest.NewRecorder()
	detailRequest := httptest.NewRequest(http.MethodGet, "/api/v1/projects/R2607", nil)
	detailRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(detailRecorder, detailRequest)
	if detailRecorder.Code != http.StatusOK {
		t.Fatalf("项目详情状态码应为 200，实际为 %d，响应: %s", detailRecorder.Code, detailRecorder.Body.String())
	}

	duplicateRecorder := httptest.NewRecorder()
	duplicateRequest := httptest.NewRequest(http.MethodPost, "/api/v1/projects", bytes.NewReader(createBody))
	duplicateRequest.Header.Set("Content-Type", "application/json")
	duplicateRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(duplicateRecorder, duplicateRequest)
	if duplicateRecorder.Code != http.StatusConflict {
		t.Fatalf("重复项目标识状态码应为 409，实际为 %d", duplicateRecorder.Code)
	}
}

func loginForProjectTest(t *testing.T, handler http.Handler) string {
	t.Helper()

	body, err := json.Marshal(map[string]string{
		"username": "admin",
		"password": "admin123",
	})
	if err != nil {
		t.Fatalf("构造登录请求失败: %v", err)
	}
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("登录状态码应为 200，实际为 %d，响应: %s", recorder.Code, recorder.Body.String())
	}

	var response struct {
		AccessToken string `json:"accessToken"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("解析登录响应失败: %v", err)
	}
	return response.AccessToken
}
func TestProjectCreateRequiresAllBusinessSelections(t *testing.T) {
	handler := newTestHandler(t)
	token := loginForProjectTest(t, handler)

	body, err := json.Marshal(map[string]any{
		"identifierSuffix":        "2608",
		"name":                    "XX04 探测单元鉴定测评",
		"nature":                  "鉴定测评",
		"platform":                "CPU/非嵌",
		"softwareType":            "新研",
		"classification":          "内部",
		"securityLevel":           "C",
		"organization":            "XX研究所",
		"ownerId":                 "user-id",
		"memberIds":               []string{},
		"languages":               []string{" "},
		"runtimeEnvironments":     []string{" "},
		"developmentEnvironments": []string{" "},
		"referenceStandardIds":    []string{" "},
	})
	if err != nil {
		t.Fatalf("构造缺少选择的创建项目请求失败: %v", err)
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/projects", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(recorder, request)

	if recorder.Code < http.StatusBadRequest {
		t.Fatalf("缺少必选项目内容应返回 4xx，实际为 %d，响应: %s", recorder.Code, recorder.Body.String())
	}
}
func TestProjectCreateSupportsFiveDigitIdentifier(t *testing.T) {
	handler := newTestHandler(t)
	token := loginForProjectTest(t, handler)

	optionsRecorder := httptest.NewRecorder()
	optionsRequest := httptest.NewRequest(http.MethodGet, "/api/v1/project-options", nil)
	optionsRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(optionsRecorder, optionsRequest)
	if optionsRecorder.Code != http.StatusOK {
		t.Fatalf("项目选项状态码应为 200，实际为 %d", optionsRecorder.Code)
	}

	var options struct {
		Users []struct {
			ID string `json:"id"`
		} `json:"users"`
		Standards []struct {
			ID string `json:"id"`
		} `json:"standards"`
	}
	if err := json.Unmarshal(optionsRecorder.Body.Bytes(), &options); err != nil {
		t.Fatalf("解析项目选项失败: %v", err)
	}

	body, err := json.Marshal(map[string]any{
		"identifierSuffix":        "26107",
		"name":                    "五位标识验证项目",
		"nature":                  "鉴定测评",
		"platform":                "CPU/非嵌",
		"softwareType":            "新研",
		"classification":          "内部",
		"securityLevel":           "C",
		"ownerId":                 options.Users[0].ID,
		"memberIds":               []string{},
		"languages":               []string{"C"},
		"runtimeEnvironments":     []string{"Linux"},
		"developmentEnvironments": []string{"Keil"},
		"referenceStandardIds":    []string{options.Standards[0].ID},
	})
	if err != nil {
		t.Fatalf("构造五位标识项目请求失败: %v", err)
	}

	createRecorder := httptest.NewRecorder()
	createRequest := httptest.NewRequest(http.MethodPost, "/api/v1/projects", bytes.NewReader(body))
	createRequest.Header.Set("Content-Type", "application/json")
	createRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(createRecorder, createRequest)
	if createRecorder.Code != http.StatusOK {
		t.Fatalf("创建五位标识项目状态码应为 200，实际为 %d，响应: %s", createRecorder.Code, createRecorder.Body.String())
	}

	var project struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(createRecorder.Body.Bytes(), &project); err != nil {
		t.Fatalf("解析创建项目响应失败: %v", err)
	}
	if project.ID != "R26107" {
		t.Fatalf("项目标识应为 R26107，实际为 %s", project.ID)
	}

	detailRecorder := httptest.NewRecorder()
	detailRequest := httptest.NewRequest(http.MethodGet, "/api/v1/projects/R26107", nil)
	detailRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(detailRecorder, detailRequest)
	if detailRecorder.Code != http.StatusOK {
		t.Fatalf("查询五位标识项目详情状态码应为 200，实际为 %d，响应: %s", detailRecorder.Code, detailRecorder.Body.String())
	}
}
