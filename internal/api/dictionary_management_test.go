package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDictionaryManagementAndProjectCreation(t *testing.T) {
	handler := newTestHandler(t)
	token := loginForProjectTest(t, handler)
	authorization := "Bearer " + token

	dictionary := createDictionaryForTest(t, handler, authorization, map[string]any{
		"category":  "language",
		"name":      "Rust",
		"sortOrder": 20,
		"isEnabled": true,
	})

	updateRecorder := httptest.NewRecorder()
	updateBody, _ := json.Marshal(map[string]any{
		"category":  "language",
		"name":      "Rust",
		"sortOrder": 21,
		"isEnabled": false,
	})
	updateRequest := httptest.NewRequest(
		http.MethodPut,
		"/api/v1/dictionaries/"+dictionary.ID,
		bytes.NewReader(updateBody),
	)
	updateRequest.Header.Set("Content-Type", "application/json")
	updateRequest.Header.Set("Authorization", authorization)
	handler.ServeHTTP(updateRecorder, updateRequest)
	if updateRecorder.Code != http.StatusOK {
		t.Fatalf("编辑技术字典状态码应为 200，实际为 %d，响应: %s", updateRecorder.Code, updateRecorder.Body.String())
	}

	optionsRecorder := httptest.NewRecorder()
	optionsRequest := httptest.NewRequest(http.MethodGet, "/api/v1/project-options", nil)
	optionsRequest.Header.Set("Authorization", authorization)
	handler.ServeHTTP(optionsRecorder, optionsRequest)
	if optionsRecorder.Code != http.StatusOK {
		t.Fatalf("项目选项状态码应为 200，实际为 %d", optionsRecorder.Code)
	}
	var options struct {
		Dictionaries []struct {
			Name string `json:"name"`
		} `json:"dictionaries"`
		Users []struct {
			ID string `json:"id"`
		} `json:"users"`
	}
	if err := json.Unmarshal(optionsRecorder.Body.Bytes(), &options); err != nil {
		t.Fatalf("解析项目选项失败: %v", err)
	}
	for _, item := range options.Dictionaries {
		if item.Name == "Rust" {
			t.Fatal("停用后的技术字典不应出现在新建项目选项中")
		}
	}

	standard := createStandardForTest(t, handler, authorization, map[string]any{
		"name":          "自定义测评管理文件",
		"code":          "CM-TM-001",
		"publishedDate": "2026-01-01",
		"source":        "ChenMeridian",
		"sortOrder":     20,
		"isEnabled":     true,
	})

	usableDictionary := createDictionaryForTest(t, handler, authorization, map[string]any{
		"category":  "development_environment",
		"name":      "Neovim",
		"sortOrder": 20,
		"isEnabled": true,
	})
	_ = usableDictionary

	createBody, _ := json.Marshal(map[string]any{
		"identifierSuffix":        "2610",
		"name":                    "字典管理联动验证项目",
		"nature":                  "第三方测评",
		"platform":                "FPGA",
		"softwareType":            "改造",
		"classification":          "秘密",
		"securityLevel":           "B",
		"organization":            "XX研究院",
		"ownerId":                 options.Users[0].ID,
		"memberIds":               []string{options.Users[0].ID},
		"languages":               []string{"C"},
		"runtimeEnvironments":     []string{"Linux"},
		"developmentEnvironments": []string{"Neovim"},
		"referenceStandardIds":    []string{standard.ID},
	})
	projectRecorder := httptest.NewRecorder()
	projectRequest := httptest.NewRequest(http.MethodPost, "/api/v1/projects", bytes.NewReader(createBody))
	projectRequest.Header.Set("Content-Type", "application/json")
	projectRequest.Header.Set("Authorization", authorization)
	handler.ServeHTTP(projectRecorder, projectRequest)
	if projectRecorder.Code != http.StatusOK {
		t.Fatalf("使用管理页字典创建项目状态码应为 200，实际为 %d，响应: %s", projectRecorder.Code, projectRecorder.Body.String())
	}

	var project struct {
		Status                  string   `json:"status"`
		DevelopmentEnvironments []string `json:"developmentEnvironments"`
	}
	if err := json.Unmarshal(projectRecorder.Body.Bytes(), &project); err != nil {
		t.Fatalf("解析项目响应失败: %v", err)
	}
	if project.Status != "编制大纲中" || len(project.DevelopmentEnvironments) != 1 {
		t.Fatalf("项目初始状态或技术字典异常: %+v", project)
	}
}

func createDictionaryForTest(
	t *testing.T,
	handler http.Handler,
	authorization string,
	payload map[string]any,
) struct{ ID string } {
	t.Helper()

	body, _ := json.Marshal(payload)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/dictionaries", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", authorization)
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("新增技术字典状态码应为 200，实际为 %d，响应: %s", recorder.Code, recorder.Body.String())
	}

	var item struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &item); err != nil {
		t.Fatalf("解析技术字典响应失败: %v", err)
	}
	return struct{ ID string }{ID: item.ID}
}

func createStandardForTest(
	t *testing.T,
	handler http.Handler,
	authorization string,
	payload map[string]any,
) struct{ ID string } {
	t.Helper()

	body, _ := json.Marshal(payload)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/reference-standards", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", authorization)
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("新增依据标准状态码应为 200，实际为 %d，响应: %s", recorder.Code, recorder.Body.String())
	}

	var item struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &item); err != nil {
		t.Fatalf("解析依据标准响应失败: %v", err)
	}
	return struct{ ID string }{ID: item.ID}
}
