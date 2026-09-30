package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type requirementBodyTestResponse struct {
	RequirementID string `json:"requirementId"`
	Doc           struct {
		Type    string `json:"type"`
		Content []struct {
			Type    string         `json:"type"`
			Attrs   map[string]any `json:"attrs"`
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
		} `json:"content"`
	} `json:"doc"`
	PlainText     string `json:"plainText"`
	Origin        string `json:"origin"`
	AuthoringMode string `json:"authoringMode"`
	HasContent    bool   `json:"hasContent"`
	UpdatedAt     string `json:"updatedAt"`
}

func TestRequirementBodyBlockFlow(t *testing.T) {
	handler := newTestHandler(t)
	token := loginForProjectTest(t, handler)
	projectCode := createWorkObjectTestProject(t, handler, token)

	docx := buildRequirementTestDOCX(t)
	source := uploadWorkObjectTestFile(t, handler, token, projectCode,
		"BCD星指令生成与发控软件需求规格说明V1.01.docx", docx)
	postJSON(t, handler, token, http.MethodPost,
		"/api/v1/work-object-versions/"+source.ID+"/confirm", nil, http.StatusOK)

	rootSection := postRequirementSection(t, handler, token, projectCode, source.ID, "", "5", "补充需求")
	childSection := postRequirementSection(t, handler, token, projectCode, source.ID,
		rootSection.ID, "5.1", "初始化要求")

	requirement := postRequirement(t, handler, token, projectCode, requirementTestPayload{
		SourceVersionID: source.ID,
		SectionID:       childSection.ID,
		Chapter:         "5.1.1",
		Name:            "正文块测试需求",
		Description:     "旧摘要",
		Kind:            "functional",
	}, http.StatusOK)

	// 首次读取：没有正文块时返回空文档。
	empty := readRequirementBody(t, handler, token, requirement.ID, http.StatusOK)
	if empty.Doc.Type != "doc" || len(empty.Doc.Content) != 0 {
		t.Fatalf("期望空文档，实际 %+v", empty.Doc)
	}
	if empty.HasContent {
		t.Fatalf("空文档不应标记为有内容")
	}

	// 保存受限块文档：标题 + 段落 + 表格 + 图片 + 分页符。
	document := map[string]any{
		"type": "doc",
		"content": []any{
			map[string]any{
				"type":  "heading",
				"attrs": map[string]any{"level": 3},
				"content": []any{
					map[string]any{"type": "text", "text": "5.1 指令参数管理"},
				},
			},
			map[string]any{
				"type": "paragraph",
				"content": []any{
					map[string]any{"type": "text", "text": "软件应支持参数配置。", "marks": []any{map[string]any{"type": "bold"}}},
				},
			},
			map[string]any{
				"type":  "orderedList",
				"attrs": map[string]any{"style": "letter-paren"},
				"content": []any{
					map[string]any{
						"type":    "listItem",
						"content": []any{map[string]any{"type": "paragraph", "content": []any{map[string]any{"type": "text", "text": "第一条"}}}},
					},
				},
			},
			map[string]any{
				"type":  "table",
				"attrs": map[string]any{"align": "center"},
				"content": []any{
					map[string]any{
						"type": "tableRow",
						"content": []any{
							map[string]any{"type": "tableHeader", "attrs": map[string]any{"align": "center", "valign": "center"}, "content": []any{map[string]any{"type": "paragraph", "content": []any{map[string]any{"type": "text", "text": "参数"}}}}},
							map[string]any{"type": "tableCell", "attrs": map[string]any{"align": "left", "valign": "center"}, "content": []any{map[string]any{"type": "paragraph", "content": []any{map[string]any{"type": "text", "text": "详细说明文本"}}}}},
						},
					},
				},
			},
			map[string]any{
				"type":  "assetImage",
				"attrs": map[string]any{"assetId": "asset-1", "width": 320, "height": 200, "align": "center"},
			},
			map[string]any{"type": "pagebreak"},
		},
	}

	saved := writeRequirementBody(t, handler, token, requirement.ID, map[string]any{
		"doc": document, "origin": "imported", "authoringMode": "mixed",
	}, http.StatusOK)
	if !saved.HasContent {
		t.Fatalf("保存后应标记为有内容")
	}
	if saved.Origin != "imported" || saved.AuthoringMode != "mixed" {
		t.Fatalf("来源与创作方式未按请求保存: %+v", saved)
	}
	if !strings.Contains(saved.PlainText, "5.1 指令参数管理") || !strings.Contains(saved.PlainText, "参数\t详细说明文本") {
		t.Fatalf("纯文本提取不符合预期: %q", saved.PlainText)
	}
	if saved.UpdatedAt == "" {
		t.Fatalf("保存后应返回更新时间")
	}

	// 读回一致。
	reloaded := readRequirementBody(t, handler, token, requirement.ID, http.StatusOK)
	if len(reloaded.Doc.Content) != len(document["content"].([]any))-1 {
		t.Fatalf("读回的块数量不一致: %d", len(reloaded.Doc.Content))
	}
	for _, block := range reloaded.Doc.Content {
		if block.Type == "pagebreak" {
			t.Fatal("保存后不应保留分页符")
		}
	}
	if reloaded.PlainText != saved.PlainText {
		t.Fatalf("读回纯文本不一致: %q != %q", reloaded.PlainText, saved.PlainText)
	}

	// 摘要桥接：列表接口按 Step 1 契约只回摘要，应已同步为正文纯文本。
	workbench := listRequirementsWorkbench(t, handler, token, projectCode)
	var syncedExcerpt string
	var syncedHasDescription bool
	for _, item := range workbench.Requirements {
		if item.ID == requirement.ID {
			syncedExcerpt = item.DescriptionExcerpt
			syncedHasDescription = item.HasDescription
		}
	}
	if !syncedHasDescription || !strings.Contains(syncedExcerpt, "5.1 指令参数管理") {
		t.Fatalf("需求摘要未同步正文纯文本: hasDescription=%v excerpt=%q", syncedHasDescription, syncedExcerpt)
	}

	// 未登记节点应被拒绝。
	writeRequirementBody(t, handler, token, requirement.ID, map[string]any{
		"doc": map[string]any{
			"type": "doc",
			"content": []any{
				map[string]any{"type": "blockquote", "content": []any{map[string]any{"type": "paragraph", "content": []any{map[string]any{"type": "text", "text": "引用"}}}}},
			},
		},
	}, http.StatusUnprocessableEntity)

	// 不存在的需求返回 404。
	missingRecorder := httptest.NewRecorder()
	missingRequest := httptest.NewRequest(http.MethodGet, "/api/v1/software-requirements/00000000-0000-0000-0000-000000000000/blocks", nil)
	missingRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(missingRecorder, missingRequest)
	if missingRecorder.Code != http.StatusNotFound {
		t.Fatalf("不存在的需求应返回 404，实际 %d", missingRecorder.Code)
	}
}

func readRequirementBody(t *testing.T, handler http.Handler, token, requirementID string, expectedStatus int) requirementBodyTestResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/software-requirements/"+requirementID+"/blocks", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(recorder, request)
	if recorder.Code != expectedStatus {
		t.Fatalf("读取正文期望 %d，实际 %d：%s", expectedStatus, recorder.Code, recorder.Body.String())
	}
	var response requirementBodyTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("解析正文响应失败: %v", err)
	}
	return response
}

func writeRequirementBody(t *testing.T, handler http.Handler, token, requirementID string, payload map[string]any, expectedStatus int) requirementBodyTestResponse {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("构造正文请求失败: %v", err)
	}
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPut, "/api/v1/software-requirements/"+requirementID+"/blocks", strings.NewReader(string(body)))
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Content-Type", "application/json")
	handler.ServeHTTP(recorder, request)
	if recorder.Code != expectedStatus {
		t.Fatalf("保存正文期望 %d，实际 %d：%s", expectedStatus, recorder.Code, recorder.Body.String())
	}
	var response requirementBodyTestResponse
	if expectedStatus == http.StatusOK {
		if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
			t.Fatalf("解析保存响应失败: %v", err)
		}
	}
	return response
}
