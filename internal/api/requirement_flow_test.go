package api

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

type requirementWorkbenchTestResponse struct {
	Sources []struct {
		ID         string `json:"id"`
		ObjectKind string `json:"objectKind"`
		ObjectName string `json:"objectName"`
		Version    string `json:"version"`
		ParseState string `json:"parseState"`
	} `json:"sources"`
	Sections []struct {
		ID            string `json:"id"`
		ParentID      string `json:"parentId"`
		ChapterNumber string `json:"chapterNumber"`
		Title         string `json:"title"`
		Origin        string `json:"origin"`
		InScope       bool   `json:"inScope"`
	} `json:"sections"`
	Requirements []struct {
		ID                 string   `json:"id"`
		SectionID          string   `json:"sectionId"`
		ChapterNumber      string   `json:"chapterNumber"`
		ExternalIdentifier string   `json:"externalIdentifier"`
		Name               string   `json:"name"`
		Description        string   `json:"description"`
		PrimaryKind        string   `json:"primaryKind"`
		SecondaryKinds     []string `json:"secondaryKinds"`
		Tags               []string `json:"tags"`
		Origin             string   `json:"origin"`
		Status             string   `json:"status"`
		TestItemTaskStatus string   `json:"testItemTaskStatus"`
	} `json:"requirements"`
}

func TestRequirementManualAndParsedFlow(t *testing.T) {
	handler := newTestHandler(t)
	token := loginForProjectTest(t, handler)
	projectCode := createWorkObjectTestProject(t, handler, token)

	docx := buildRequirementTestDOCX(t)
	source := uploadWorkObjectTestFile(t, handler, token, projectCode,
		"BCD星指令生成与发控软件需求规格说明V1.01.docx", docx)
	postJSON(t, handler, token, http.MethodPost,
		"/api/v1/work-object-versions/"+source.ID+"/confirm", nil, http.StatusOK)

	taskBook := postJSONMap(t, handler, token, http.MethodPost,
		"/api/v1/projects/"+projectCode+"/work-objects/manual", map[string]string{
			"objectKind":  "task_book",
			"objectName":  "BCD星软件研制任务书",
			"version":     "1.00",
			"source":      "研制方",
			"receivedAt":  "2026-09-16",
			"receiveMode": "onsite",
		}, http.StatusOK)
	postJSON(t, handler, token, http.MethodPost,
		"/api/v1/work-object-versions/"+taskBook["id"].(string)+"/confirm", nil, http.StatusOK)

	workbench := listRequirementsWorkbench(t, handler, token, projectCode)
	if len(workbench.Sources) != 2 || workbench.Sources[0].ID != source.ID ||
		workbench.Sources[0].ObjectKind != "srs" ||
		workbench.Sources[0].ParseState != "ready" ||
		workbench.Sources[1].ObjectKind != "task_book" ||
		workbench.Sources[1].ParseState != "manual" {
		t.Fatalf("可解析主 SRS 识别错误: %+v", workbench.Sources)
	}

	rootSection := postRequirementSection(t, handler, token, projectCode, source.ID, "", "5", "补充需求")
	childSection := postRequirementSection(t, handler, token, projectCode, source.ID,
		rootSection.ID, "5.1", "初始化要求")

	manualRequirement := postRequirement(t, handler, token, projectCode, requirementTestPayload{
		SourceVersionID: source.ID,
		SectionID:       childSection.ID,
		Chapter:         "5.1.1",
		Name:            "系统初始化",
		Description:     "系统应在上电后完成初始化并报告状态。",
		Kind:            "functional",
		SecondaryKinds:  []string{"performance", "interface", "performance"},
		Tags:            []string{"初始化"},
	}, http.StatusOK)
	if manualRequirement.Status != "official" ||
		manualRequirement.TestItemTaskStatus != "pending" ||
		manualRequirement.PrimaryKind != "functional" {
		t.Fatalf("手动需求应直接保存为正式需求并记录测试项契约: %+v", manualRequirement)
	}
	if len(manualRequirement.SecondaryKinds) != 2 ||
		manualRequirement.SecondaryKinds[0] != "performance" ||
		manualRequirement.SecondaryKinds[1] != "interface" {
		t.Fatalf("副需求类型应去重并按类型顺序保存: %+v", manualRequirement)
	}
	if manualRequirement.ExternalIdentifier != "XTCS" {
		t.Fatalf("空标识应按名称拼音首字母生成四位: %+v", manualRequirement)
	}
	focusedRequirement := postRequirement(t, handler, token, projectCode, requirementTestPayload{
		SourceVersionID: source.ID,
		Chapter:         "7.2.1",
		Name:            "指令发送",
		Description:     "系统应按指令序列发送控制指令。",
		Kind:            "functional",
	}, http.StatusOK)
	if focusedRequirement.SectionID == "" {
		t.Fatalf("需求章节应保存并关联: %+v", focusedRequirement)
	}
	focusedRequirement = putRequirement(t, handler, token, focusedRequirement.ID, map[string]any{
		"sectionId":          focusedRequirement.SectionID,
		"chapterNumber":      "7.2.4",
		"externalIdentifier": focusedRequirement.ExternalIdentifier,
		"name":               focusedRequirement.Name,
		"description":        focusedRequirement.Description,
		"primaryKind":        focusedRequirement.PrimaryKind,
		"tags":               focusedRequirement.Tags,
	})
	if focusedRequirement.ChapterNumber != "7.2.4" || focusedRequirement.SectionID == "" {
		t.Fatalf("修改未登记章节号应创建并关联章节: %+v", focusedRequirement)
	}
	postRequirement(t, handler, token, projectCode, requirementTestPayload{
		SourceVersionID: source.ID,
		Chapter:         "7.2.2",
		Name:            "系统初始化",
		Description:     "重复名称不应保存。",
		Kind:            "functional",
	}, http.StatusConflict)
	postRequirement(t, handler, token, projectCode, requirementTestPayload{
		SourceVersionID: source.ID,
		Chapter:         "7.2.3",
		Name:            "重复标识",
		Description:     "重复标识不应保存。",
		Kind:            "functional",
		ExternalID:      "XTCS",
	}, http.StatusConflict)
	postRequirement(t, handler, token, projectCode, requirementTestPayload{
		SourceVersionID: source.ID,
		Chapter:         "7.2.5",
		Name:            "主副类型重复",
		Description:     "副类型不能与主类型相同。",
		Kind:            "functional",
		SecondaryKinds:  []string{"functional"},
	}, http.StatusBadRequest)
	postRequirement(t, handler, token, projectCode, requirementTestPayload{
		SourceVersionID: source.ID,
		Chapter:         "7.2.6",
		Name:            "副类型非法",
		Description:     "副类型必须使用固定枚举。",
		Kind:            "functional",
		SecondaryKinds:  []string{"unknown"},
	}, http.StatusBadRequest)
	updateConflictBody := map[string]any{
		"sectionId":          focusedRequirement.SectionID,
		"chapterNumber":      focusedRequirement.ChapterNumber,
		"externalIdentifier": focusedRequirement.ExternalIdentifier,
		"name":               manualRequirement.Name,
		"description":        "重复名称不应更新。",
		"primaryKind":        "functional",
		"tags":               []string{},
	}
	postJSON(t, handler, token, http.MethodPut,
		"/api/v1/software-requirements/"+focusedRequirement.ID, updateConflictBody, http.StatusConflict)
	updateConflictBody["name"] = focusedRequirement.Name
	updateConflictBody["externalIdentifier"] = manualRequirement.ExternalIdentifier
	postJSON(t, handler, token, http.MethodPut,
		"/api/v1/software-requirements/"+focusedRequirement.ID, updateConflictBody, http.StatusConflict)

	focusedRequirement = putRequirement(t, handler, token, focusedRequirement.ID, map[string]any{
		"sectionId":          focusedRequirement.SectionID,
		"chapterNumber":      focusedRequirement.ChapterNumber,
		"externalIdentifier": focusedRequirement.ExternalIdentifier,
		"name":               focusedRequirement.Name,
		"description":        focusedRequirement.Description,
		"primaryKind":        focusedRequirement.PrimaryKind,
		"secondaryKinds":     []string{"performance"},
		"tags":               focusedRequirement.Tags,
	})
	if len(focusedRequirement.SecondaryKinds) != 1 || focusedRequirement.SecondaryKinds[0] != "performance" {
		t.Fatalf("修改需求应保存副需求类型: %+v", focusedRequirement)
	}
	postJSON(t, handler, token, http.MethodPut,
		"/api/v1/software-requirements/"+focusedRequirement.ID, map[string]any{
			"sectionId":          focusedRequirement.SectionID,
			"chapterNumber":      focusedRequirement.ChapterNumber,
			"externalIdentifier": focusedRequirement.ExternalIdentifier,
			"name":               focusedRequirement.Name,
			"description":        focusedRequirement.Description,
			"primaryKind":        "performance",
			"tags":               focusedRequirement.Tags,
		}, http.StatusBadRequest)
	postJSON(t, handler, token, http.MethodPut,
		"/api/v1/software-requirements/"+focusedRequirement.ID, map[string]any{
			"sectionId":          focusedRequirement.SectionID,
			"chapterNumber":      focusedRequirement.ChapterNumber,
			"externalIdentifier": focusedRequirement.ExternalIdentifier,
			"name":               focusedRequirement.Name,
			"description":        focusedRequirement.Description,
			"primaryKind":        focusedRequirement.PrimaryKind,
			"tags":               focusedRequirement.Tags,
		}, http.StatusBadRequest)
	focusedRequirement = putRequirement(t, handler, token, focusedRequirement.ID, map[string]any{
		"sectionId":          focusedRequirement.SectionID,
		"chapterNumber":      focusedRequirement.ChapterNumber,
		"externalIdentifier": focusedRequirement.ExternalIdentifier,
		"name":               focusedRequirement.Name,
		"description":        focusedRequirement.Description,
		"primaryKind":        focusedRequirement.PrimaryKind,
		"secondaryKinds":     []string{},
		"tags":               focusedRequirement.Tags,
	})
	if len(focusedRequirement.SecondaryKinds) != 0 {
		t.Fatalf("显式空数组应清空副需求类型: %+v", focusedRequirement)
	}

	bulkBody := map[string]any{
		"sourceVersionId": source.ID,
		"items": []map[string]string{
			{"nodeType": "section", "chapterNumber": "6", "title": "批量章节"},
			{
				"nodeType": "requirement", "chapterNumber": "6.1", "name": "接口自检",
				"description": "系统应提供接口自检指令。", "primaryKind": "interface",
			},
		},
	}
	postJSON(t, handler, token, http.MethodPost,
		"/api/v1/projects/"+projectCode+"/requirements/bulk", bulkBody, http.StatusOK)

	parseResult := postJSONMap(t, handler, token, http.MethodPost,
		"/api/v1/projects/"+projectCode+"/requirements/parse",
		map[string]any{"sourceVersionId": source.ID}, http.StatusOK)
	if parseResult["sectionCount"].(float64) != 4 ||
		parseResult["candidateCount"].(float64) != 2 {
		t.Fatalf("解析结果统计错误: %+v", parseResult)
	}

	workbench = listRequirementsWorkbench(t, handler, token, projectCode)
	if len(workbench.Sections) != 11 {
		t.Fatalf("章节树数量错误: %+v", workbench.Sections)
	}
	sectionParents := make(map[string]string, len(workbench.Sections))
	sectionScope := make(map[string]bool, len(workbench.Sections))
	for _, section := range workbench.Sections {
		sectionParents[section.ChapterNumber] = section.ParentID
		sectionScope[section.ChapterNumber] = section.InScope
	}
	for _, chapter := range []string{"7", "7.2"} {
		if _, exists := sectionParents[chapter]; exists {
			t.Fatalf("根节点录入需求不应自动创建父章节 %s: %+v", chapter, workbench.Sections)
		}
	}
	if sectionParents["7.2.1"] != "" {
		t.Fatalf("缺失父章节时需求章节应保持根节点: %+v", workbench.Sections)
	}
	if _, exists := sectionParents["4"]; !exists {
		t.Fatalf("无候选需求的解析章节也应保留为全文目录: %+v", workbench.Sections)
	}
	if sectionScope["4"] {
		t.Fatalf("参考资料章节不应进入测试作业面: %+v", workbench.Sections)
	}
	if !sectionScope["3"] || !sectionScope["3.1"] {
		t.Fatalf("候选需求章节链应进入测试作业面: %+v", workbench.Sections)
	}
	candidates := make([]string, 0, 2)
	for _, requirement := range workbench.Requirements {
		if requirement.Status == "candidate" {
			candidates = append(candidates, requirement.ID)
		}
	}
	if len(candidates) != 2 {
		t.Fatalf("应生成 2 条候选需求: %+v", workbench.Requirements)
	}

	postJSON(t, handler, token, http.MethodPost,
		"/api/v1/projects/"+projectCode+"/requirements/status",
		map[string]any{"ids": candidates[:1], "action": "confirm"}, http.StatusOK)
	postJSON(t, handler, token, http.MethodPost,
		"/api/v1/projects/"+projectCode+"/requirements/status",
		map[string]any{"ids": candidates[1:], "action": "exclude", "reason": "该段是说明文字，不作为需求"}, http.StatusOK)

	workbench = listRequirementsWorkbench(t, handler, token, projectCode)
	statuses := make(map[string]string, len(workbench.Requirements))
	taskStatuses := make(map[string]string, len(workbench.Requirements))
	finalScope := make(map[string]bool, len(workbench.Sections))
	for _, section := range workbench.Sections {
		finalScope[section.ChapterNumber] = section.InScope
	}
	for _, requirement := range workbench.Requirements {
		statuses[requirement.ChapterNumber] = requirement.Status
		taskStatuses[requirement.ChapterNumber] = requirement.TestItemTaskStatus
	}
	if statuses["3.1"] != "official" || taskStatuses["3.1"] != "pending" {
		t.Fatalf("确认候选需求错误: %+v", statuses)
	}
	if statuses["3.2"] != "excluded" || taskStatuses["3.2"] != "none" {
		t.Fatalf("排除候选需求错误: %+v", statuses)
	}
	if !finalScope["3"] || !finalScope["3.1"] || finalScope["3.2"] || finalScope["4"] {
		t.Fatalf("排除候选后作业面应收缩: %+v", workbench.Sections)
	}
}

func TestParseDocSRSRequiresConversion(t *testing.T) {
	assetRoot := filepath.Join(t.TempDir(), "file-assets")
	handler := newTestHandlerWithAssetRoot(t, assetRoot)
	token := loginForProjectTest(t, handler)
	projectCode := createWorkObjectTestProject(t, handler, token)
	source := uploadWorkObjectTestFile(t, handler, token, projectCode,
		"BCD星指令生成与发控软件需求规格说明V1.01.doc", "legacy word")
	postJSON(t, handler, token, http.MethodPost,
		"/api/v1/work-object-versions/"+source.ID+"/confirm", nil, http.StatusOK)

	recorder := postJSONRecorder(t, handler, token, http.MethodPost,
		"/api/v1/projects/"+projectCode+"/requirements/parse",
		map[string]any{"sourceVersionId": source.ID})
	if recorder.Code != http.StatusUnsupportedMediaType {
		t.Fatalf(".doc 解析应提示先转换，实际 %d，响应: %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), ".docx") {
		t.Fatalf("转换提示不明确: %s", recorder.Body.String())
	}

	docx := buildRequirementTestDOCX(t)
	parseCopyRecorder := uploadParseCopyTestRecorder(t, handler, token, source.ID,
		"BCD星指令生成与发控软件需求规格说明V1.01.docx", docx)
	if parseCopyRecorder.Code != http.StatusOK {
		t.Fatalf("补传解析副本状态码应为 200，实际 %d，响应: %s",
			parseCopyRecorder.Code, parseCopyRecorder.Body.String())
	}
	workbench := listRequirementsWorkbench(t, handler, token, projectCode)
	if len(workbench.Sources) != 1 || workbench.Sources[0].ParseState != "ready" {
		t.Fatalf("补传解析副本后 SRS 应可解析: %+v", workbench.Sources)
	}
	parseResult := postJSONMap(t, handler, token, http.MethodPost,
		"/api/v1/projects/"+projectCode+"/requirements/parse",
		map[string]any{"sourceVersionId": source.ID}, http.StatusOK)
	if parseResult["sectionCount"].(float64) != 4 ||
		parseResult["candidateCount"].(float64) != 2 {
		t.Fatalf("解析副本解析结果错误: %+v", parseResult)
	}
	files, err := filepath.Glob(filepath.Join(assetRoot, "projects", projectCode, "*", "*", "*.parse.docx"))
	if err != nil || len(files) != 1 {
		t.Fatalf("解析副本落盘数量错误: %v, err=%v", files, err)
	}
}

type requirementTestPayload struct {
	SourceVersionID string
	SectionID       string
	Chapter         string
	ExternalID      string
	Name            string
	Description     string
	Kind            string
	SecondaryKinds  []string
	Tags            []string
}

type requirementTestResponse struct {
	ID                 string   `json:"id"`
	SectionID          string   `json:"sectionId"`
	ChapterNumber      string   `json:"chapterNumber"`
	ExternalIdentifier string   `json:"externalIdentifier"`
	Name               string   `json:"name"`
	Description        string   `json:"description"`
	PrimaryKind        string   `json:"primaryKind"`
	SecondaryKinds     []string `json:"secondaryKinds"`
	Tags               []string `json:"tags"`
	Status             string   `json:"status"`
	TestItemTaskStatus string   `json:"testItemTaskStatus"`
}

type sectionTestResponse struct {
	ID            string `json:"id"`
	ParentID      string `json:"parentId"`
	ChapterNumber string `json:"chapterNumber"`
	Title         string `json:"title"`
}

func buildRequirementTestDOCX(t *testing.T) string {
	t.Helper()
	document := `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>3 功能需求</w:t></w:r></w:p>
    <w:p><w:r><w:t>3.1 数据处理功能</w:t></w:r></w:p>
    <w:p><w:r><w:t>系统应完成指令数据的解析、校验和分发。</w:t></w:r></w:p>
    <w:p><w:r><w:t>3.2 性能需求</w:t></w:r></w:p>
    <w:p><w:r><w:t>处理延迟应不高于 200ms。</w:t></w:r></w:p>
    <w:p><w:r><w:t>4 参考资料</w:t></w:r></w:p>
    <w:p><w:r><w:t>本章只列参考资料。</w:t></w:r></w:p>
  </w:body>
</w:document>`
	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	file, err := writer.Create("word/document.xml")
	if err != nil {
		t.Fatalf("构造 DOCX 失败: %v", err)
	}
	if _, err := file.Write([]byte(document)); err != nil {
		t.Fatalf("写入 DOCX 内容失败: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("关闭 DOCX 失败: %v", err)
	}
	return buffer.String()
}

func uploadParseCopyTestRecorder(
	t *testing.T,
	handler http.Handler,
	token string,
	versionID string,
	fileName string,
	content string,
) *httptest.ResponseRecorder {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	file, err := writer.CreateFormFile("file", fileName)
	if err != nil {
		t.Fatalf("构造解析副本失败: %v", err)
	}
	if _, err := io.WriteString(file, content); err != nil {
		t.Fatalf("写入解析副本失败: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("关闭解析副本请求失败: %v", err)
	}
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(
		http.MethodPost, "/api/v1/work-object-versions/"+versionID+"/parse-copy", &body,
	)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	request.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(recorder, request)
	return recorder
}

func postRequirementSection(
	t *testing.T,
	handler http.Handler,
	token string,
	projectCode string,
	sourceVersionID string,
	parentID string,
	chapter string,
	title string,
) sectionTestResponse {
	t.Helper()
	body := map[string]string{
		"sourceVersionId": sourceVersionID,
		"parentId":        parentID,
		"chapterNumber":   chapter,
		"title":           title,
	}
	recorder := postJSONRecorder(t, handler, token, http.MethodPost,
		"/api/v1/projects/"+projectCode+"/requirement-sections", body)
	if recorder.Code != http.StatusOK {
		t.Fatalf("新增章节状态码应为 200，实际 %d，响应: %s", recorder.Code, recorder.Body.String())
	}
	var response sectionTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("解析新增章节响应失败: %v", err)
	}
	return response
}

func postRequirement(
	t *testing.T,
	handler http.Handler,
	token string,
	projectCode string,
	payload requirementTestPayload,
	expectedStatus int,
) requirementTestResponse {
	t.Helper()
	body := map[string]any{
		"sourceVersionId":    payload.SourceVersionID,
		"sectionId":          payload.SectionID,
		"chapterNumber":      payload.Chapter,
		"name":               payload.Name,
		"description":        payload.Description,
		"primaryKind":        payload.Kind,
		"secondaryKinds":     payload.SecondaryKinds,
		"tags":               payload.Tags,
		"externalIdentifier": payload.ExternalID,
	}
	recorder := postJSONRecorder(t, handler, token, http.MethodPost,
		"/api/v1/projects/"+projectCode+"/requirements", body)
	if recorder.Code != expectedStatus {
		t.Fatalf("新增需求状态码应为 %d，实际 %d，响应: %s", expectedStatus, recorder.Code, recorder.Body.String())
	}
	if expectedStatus != http.StatusOK {
		return requirementTestResponse{}
	}
	var response requirementTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("解析新增需求响应失败: %v", err)
	}
	return response
}

func putRequirement(
	t *testing.T,
	handler http.Handler,
	token string,
	requirementID string,
	body map[string]any,
) requirementTestResponse {
	t.Helper()
	recorder := postJSONRecorder(t, handler, token, http.MethodPut,
		"/api/v1/software-requirements/"+requirementID, body)
	if recorder.Code != http.StatusOK {
		t.Fatalf("修改需求状态码应为 200，实际 %d，响应: %s", recorder.Code, recorder.Body.String())
	}
	var response requirementTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("解析修改需求响应失败: %v", err)
	}
	return response
}

func listRequirementsWorkbench(
	t *testing.T,
	handler http.Handler,
	token string,
	projectCode string,
) requirementWorkbenchTestResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/projects/"+projectCode+"/requirements", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("需求工作台状态码应为 200，实际 %d，响应: %s", recorder.Code, recorder.Body.String())
	}
	var response requirementWorkbenchTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("解析需求工作台失败: %v", err)
	}
	return response
}

func postJSONMap(
	t *testing.T,
	handler http.Handler,
	token string,
	method string,
	path string,
	body any,
	expectedStatus int,
) map[string]any {
	t.Helper()
	recorder := postJSONRecorder(t, handler, token, method, path, body)
	if recorder.Code != expectedStatus {
		t.Fatalf("请求 %s 状态码应为 %d，实际 %d，响应: %s", path, expectedStatus, recorder.Code, recorder.Body.String())
	}
	var response map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("解析 %s 响应失败: %v", path, err)
	}
	return response
}

func postJSON(
	t *testing.T,
	handler http.Handler,
	token string,
	method string,
	path string,
	body any,
	expectedStatus int,
) {
	t.Helper()
	recorder := postJSONRecorder(t, handler, token, method, path, body)
	if recorder.Code != expectedStatus {
		t.Fatalf("请求 %s 状态码应为 %d，实际 %d，响应: %s", path, expectedStatus, recorder.Code, recorder.Body.String())
	}
}

func postJSONRecorder(
	t *testing.T,
	handler http.Handler,
	token string,
	method string,
	path string,
	body any,
) *httptest.ResponseRecorder {
	t.Helper()
	var request *http.Request
	if body == nil {
		request = httptest.NewRequest(method, path, nil)
	} else {
		data, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("构造请求失败: %v", err)
		}
		request = httptest.NewRequest(method, path, bytes.NewReader(data))
		request.Header.Set("Content-Type", "application/json")
	}
	request.Header.Set("Authorization", "Bearer "+token)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}
