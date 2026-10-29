package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

func TestRoundCopyHTTPEndpoints(t *testing.T) {
	handler := newTestHandler(t)
	token := loginForProjectTest(t, handler)
	projectCode := createWorkObjectTestProject(t, handler, token)

	dynamic := postJSONMap(t, handler, token, http.MethodPost,
		"/api/v1/projects/"+projectCode+"/test-items", map[string]any{
			"typeCode": "SU", "name": "动态测试项",
		}, http.StatusOK)
	dynamicID, _ := dynamic["id"].(string)
	if dynamicID == "" {
		t.Fatalf("动态测试项响应缺少 id: %+v", dynamic)
	}
	static := postJSONMap(t, handler, token, http.MethodPost,
		"/api/v1/projects/"+projectCode+"/test-items", map[string]any{
			"typeCode": "DC", "name": "文档审查",
		}, http.StatusOK)
	staticID, _ := static["id"].(string)
	if staticID == "" {
		t.Fatalf("静态测试项响应缺少 id: %+v", static)
	}
	itemCase := postJSONMap(t, handler, token, http.MethodPost,
		"/api/v1/test-items/"+dynamicID+"/cases", map[string]string{"name": "失败用例"}, http.StatusOK)
	caseID, _ := itemCase["id"].(string)
	if caseID == "" {
		t.Fatalf("用例响应缺少 id: %+v", itemCase)
	}
	postJSON(t, handler, token, http.MethodPost,
		"/api/v1/test-items/"+dynamicID+"/cases/batch-assign", map[string]any{
			"caseIds": []string{caseID}, "status": "failed",
		}, http.StatusOK)

	workspace := postJSONMap(t, handler, token, http.MethodGet,
		"/api/v1/projects/"+projectCode+"/test-items", nil, http.StatusOK)
	round, ok := workspace["round"].(map[string]any)
	if !ok {
		t.Fatalf("工作台响应缺少轮次: %+v", workspace)
	}
	sourceRoundID, _ := round["id"].(string)
	if sourceRoundID == "" {
		t.Fatalf("工作台轮次缺少 id: %+v", round)
	}

	preview := postJSONMap(t, handler, token, http.MethodGet,
		"/api/v1/projects/"+projectCode+"/test-rounds/"+sourceRoundID+"/copy-preview", nil, http.StatusOK)
	previewItems, ok := preview["testItems"].([]any)
	if !ok {
		t.Fatalf("预览响应缺少 testItems: %+v", preview)
	}
	var dynamicPreview map[string]any
	foundStatic := false
	for _, raw := range previewItems {
		item, _ := raw.(map[string]any)
		if item["testItemId"] == dynamicID {
			dynamicPreview = item
		}
		if item["testItemId"] == staticID {
			foundStatic = true
		}
	}
	if dynamicPreview == nil || dynamicPreview["defaultSelected"] != true || dynamicPreview["failedCount"] != float64(1) {
		t.Fatalf("动态项默认勾选或统计不正确: %+v", dynamicPreview)
	}
	if foundStatic {
		t.Fatal("静态项不应出现在复制预览")
	}

	createRecorder := postJSONRecorder(t, handler, token, http.MethodPost,
		"/api/v1/projects/"+projectCode+"/test-rounds", map[string]any{
			"sourceRoundId": sourceRoundID,
			"testItemIds":   []string{dynamicID},
			"name":          "第二轮验证",
			"dutVersion":    "V2.0",
		})
	if createRecorder.Code != http.StatusOK {
		t.Fatalf("创建后续轮状态码应为 200，实际 %d，响应: %s", createRecorder.Code, createRecorder.Body.String())
	}
	var created map[string]any
	if err := json.Unmarshal(createRecorder.Body.Bytes(), &created); err != nil {
		t.Fatalf("解析创建轮次响应失败: %v", err)
	}
	if created["testItemCount"] != float64(1) || created["caseCount"] != float64(1) || created["stepCount"] != float64(0) {
		t.Fatalf("创建轮次复制计数不正确: %+v", created)
	}
	createdRound, _ := created["round"].(map[string]any)
	if createdRound["roundNumber"] != float64(2) || createdRound["sourceRoundId"] != sourceRoundID {
		t.Fatalf("新轮次元数据不正确: %+v", createdRound)
	}
	workspaceAfter := postJSONMap(t, handler, token, http.MethodGet,
		"/api/v1/projects/"+projectCode+"/test-items", nil, http.StatusOK)
	beforeIDs := workspaceItemIDs(workspace)
	afterIDs := workspaceItemIDs(workspaceAfter)
	if strings.Join(beforeIDs, ",") != strings.Join(afterIDs, ",") {
		t.Fatalf("复制后首个工作台不应混入后续轮测试项: before=%v after=%v", beforeIDs, afterIDs)
	}

	staticRecorder := postJSONRecorder(t, handler, token, http.MethodPost,
		"/api/v1/projects/"+projectCode+"/test-rounds", map[string]any{
			"sourceRoundId": sourceRoundID,
			"testItemIds":   []string{staticID},
		})
	if staticRecorder.Code != http.StatusUnprocessableEntity {
		t.Fatalf("静态项应返回 422，实际 %d，响应: %s", staticRecorder.Code, staticRecorder.Body.String())
	}
	if !strings.Contains(staticRecorder.Body.String(), "静态测试项不能带入第二轮及以后轮次") {
		t.Fatalf("静态项错误信息不明确: %s", staticRecorder.Body.String())
	}

	empty := postJSONMap(t, handler, token, http.MethodPost,
		"/api/v1/projects/"+projectCode+"/test-rounds", map[string]any{
			"sourceRoundId": sourceRoundID, "testItemIds": []string{},
		}, http.StatusOK)
	if empty["testItemCount"] != float64(0) || empty["caseCount"] != float64(0) {
		t.Fatalf("空轮次计数不正确: %+v", empty)
	}
}

func workspaceItemIDs(workspace map[string]any) []string {
	rawItems, _ := workspace["items"].([]any)
	ids := make([]string, 0, len(rawItems))
	for _, raw := range rawItems {
		item, _ := raw.(map[string]any)
		if id, ok := item["id"].(string); ok {
			ids = append(ids, id)
		}
	}
	return ids
}
