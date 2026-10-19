package api

import (
	"encoding/json"
	"net/http"
	"testing"
)

type batchCreateTestItemsTestResponse struct {
	Total   int `json:"total"`
	Created int `json:"created"`
	Skipped int `json:"skipped"`
	Failed  int `json:"failed"`
	Items   []struct {
		RequirementID string `json:"requirementId"`
		Outcome       string `json:"outcome"`
	} `json:"items"`
}

func TestBatchCreateTestItemsFromRequirementsFlow(t *testing.T) {
	handler := newTestHandler(t)
	token := loginForProjectTest(t, handler)
	projectCode := createWorkObjectTestProject(t, handler, token)

	source := postJSONMap(t, handler, token, http.MethodPost,
		"/api/v1/projects/"+projectCode+"/work-objects/manual", map[string]string{
			"objectKind":  "srs",
			"objectName":  "批量测试需求规格说明",
			"version":     "1.00",
			"source":      "研制方",
			"receivedAt":  "2026-10-19",
			"receiveMode": "onsite",
		}, http.StatusOK)
	sourceID := source["id"].(string)
	postJSON(t, handler, token, http.MethodPost,
		"/api/v1/work-object-versions/"+sourceID+"/confirm", nil, http.StatusOK)
	section := postRequirementSection(t, handler, token, projectCode, sourceID, "", "5", "批量创建测试")

	first := postRequirement(t, handler, token, projectCode, requirementTestPayload{
		SourceVersionID: sourceID,
		SectionID:       section.ID,
		Chapter:         "5.1",
		Name:            "批量需求一",
		Description:     "需求一描述",
		Kind:            "functional",
	}, http.StatusOK)
	second := postRequirement(t, handler, token, projectCode, requirementTestPayload{
		SourceVersionID: sourceID,
		SectionID:       section.ID,
		Chapter:         "5.2",
		Name:            "批量需求二",
		Description:     "需求二描述",
		Kind:            "interface",
	}, http.StatusOK)
	incomplete := postRequirement(t, handler, token, projectCode, requirementTestPayload{
		SourceVersionID: sourceID,
		SectionID:       section.ID,
		Chapter:         "5.3",
		Name:            "待补描述需求",
		Description:     "",
		Kind:            "performance",
	}, http.StatusOK)

	batchPath := "/api/v1/projects/" + projectCode + "/test-items/from-requirements"
	recorder := postJSONRecorder(t, handler, token, http.MethodPost, batchPath, map[string]any{
		"requirementIds": []string{first.ID, second.ID, incomplete.ID},
	})
	if recorder.Code != http.StatusOK {
		t.Fatalf("选中需求批量创建状态码应为 200，实际 %d，响应: %s", recorder.Code, recorder.Body.String())
	}
	var selectedResult batchCreateTestItemsTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &selectedResult); err != nil {
		t.Fatalf("解析选中需求批量结果失败: %v", err)
	}
	if selectedResult.Total != 3 || selectedResult.Created != 2 ||
		selectedResult.Skipped != 1 || selectedResult.Failed != 0 {
		t.Fatalf("选中需求批量结果不正确: %+v", selectedResult)
	}

	postRequirement(t, handler, token, projectCode, requirementTestPayload{
		SourceVersionID: sourceID,
		SectionID:       section.ID,
		Chapter:         "5.4",
		Name:            "全部创建新增需求",
		Description:     "第四条需求描述",
		Kind:            "reliability",
	}, http.StatusOK)

	recorder = postJSONRecorder(t, handler, token, http.MethodPost, batchPath, map[string]any{"all": true})
	if recorder.Code != http.StatusOK {
		t.Fatalf("全部需求批量创建状态码应为 200，实际 %d，响应: %s", recorder.Code, recorder.Body.String())
	}
	var allResult batchCreateTestItemsTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &allResult); err != nil {
		t.Fatalf("解析全部需求批量结果失败: %v", err)
	}
	if allResult.Total != 4 || allResult.Created != 1 ||
		allResult.Skipped != 3 || allResult.Failed != 0 {
		t.Fatalf("全部需求批量结果不正确: %+v", allResult)
	}

	workspaceRecorder := postJSONRecorder(t, handler, token, http.MethodGet,
		"/api/v1/projects/"+projectCode+"/test-items", nil)
	if workspaceRecorder.Code != http.StatusOK {
		t.Fatalf("测试项工作台状态码应为 200，实际 %d，响应: %s", workspaceRecorder.Code, workspaceRecorder.Body.String())
	}
	var workspace struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	if err := json.Unmarshal(workspaceRecorder.Body.Bytes(), &workspace); err != nil {
		t.Fatalf("解析测试项工作台失败: %v", err)
	}
	if len(workspace.Items) != 3 {
		t.Fatalf("两轮批量后应共有 3 个测试项，实际 %d", len(workspace.Items))
	}
}
