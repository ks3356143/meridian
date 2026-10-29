package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

func TestQuickIssueHTTPFlow(t *testing.T) {
	handler := newTestHandler(t)
	token := loginForProjectTest(t, handler)
	projectCode := createWorkObjectTestProject(t, handler, token)

	item := postJSONMap(t, handler, token, http.MethodPost,
		"/api/v1/projects/"+projectCode+"/test-items", map[string]any{
			"typeCode": "SU", "name": "快捷问题测试项",
		}, http.StatusOK)
	itemID, _ := item["id"].(string)
	itemCase := postJSONMap(t, handler, token, http.MethodPost,
		"/api/v1/test-items/"+itemID+"/cases", map[string]string{"name": "快捷问题用例"}, http.StatusOK)
	caseID, _ := itemCase["id"].(string)
	step := postJSONMap(t, handler, token, http.MethodPost,
		"/api/v1/test-cases/"+caseID+"/steps", map[string]string{"expectText": "页面正常"}, http.StatusOK)
	stepID, _ := step["id"].(string)

	created := postJSONMap(t, handler, token, http.MethodPost,
		"/api/v1/test-cases/"+caseID+"/quick-issues", map[string]any{
			"testCaseStepId": stepID,
			"noteText":       "  参数页面闪烁  ",
		}, http.StatusOK)
	noteID, _ := created["id"].(string)
	if noteID == "" || created["noteText"] != "参数页面闪烁" || created["stepSeq"] != float64(1) ||
		created["canEdit"] != true || created["createdByName"] != "系统管理员" {
		t.Fatalf("创建问题草稿响应不正确: %+v", created)
	}

	listRecorder := postJSONRecorder(t, handler, token, http.MethodGet,
		"/api/v1/test-cases/"+caseID+"/quick-issues", nil)
	if listRecorder.Code != http.StatusOK {
		t.Fatalf("问题草稿列表状态码应为 200，实际 %d: %s", listRecorder.Code, listRecorder.Body.String())
	}
	var notes []map[string]any
	if err := json.Unmarshal(listRecorder.Body.Bytes(), &notes); err != nil {
		t.Fatalf("解析问题草稿列表失败: %v", err)
	}
	if len(notes) != 1 || notes[0]["canEdit"] != true {
		t.Fatalf("问题草稿列表不正确: %+v", notes)
	}

	updated := postJSONMap(t, handler, token, http.MethodPatch,
		"/api/v1/quick-issues/"+noteID, map[string]any{"noteText": "已编辑的问题"}, http.StatusOK)
	if updated["noteText"] != "已编辑的问题" {
		t.Fatalf("编辑问题草稿不正确: %+v", updated)
	}
	tooLong := postJSONRecorder(t, handler, token, http.MethodPatch,
		"/api/v1/quick-issues/"+noteID, map[string]any{"noteText": strings.Repeat("长", 501)})
	if tooLong.Code != http.StatusUnprocessableEntity || !strings.Contains(tooLong.Body.String(), "500") {
		t.Fatalf("501 字符应返回明确 422，实际 %d: %s", tooLong.Code, tooLong.Body.String())
	}
	postJSON(t, handler, token, http.MethodDelete, "/api/v1/quick-issues/"+noteID, nil, http.StatusNoContent)
	emptyList := postJSONRecorder(t, handler, token, http.MethodGet,
		"/api/v1/test-cases/"+caseID+"/quick-issues", nil)
	if emptyList.Code != http.StatusOK || strings.TrimSpace(emptyList.Body.String()) != "[]" {
		t.Fatalf("删除后列表应为空，实际 %d: %s", emptyList.Code, emptyList.Body.String())
	}
}
