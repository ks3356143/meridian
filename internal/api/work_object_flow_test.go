package api

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestWorkObjectUploadConfirmAndVersionFlow(t *testing.T) {
	assetRoot := filepath.Join(t.TempDir(), "file-assets")
	handler := newTestHandlerWithAssetRoot(t, assetRoot)
	token := loginForProjectTest(t, handler)
	projectCode := createWorkObjectTestProject(t, handler, token)

	firstBody := uploadWorkObjectTestFile(t, handler, token, projectCode, "BCD星指令生成与发控软件需求规格说明V1.00.docx", "SRS V1.00")
	if firstBody.ID == "" || firstBody.ObjectKind != "srs" || firstBody.Version != "V1.00" {
		t.Fatalf("上传后工作对象识别错误: %+v", firstBody)
	}
	if firstBody.ObjectName != "BCD星指令生成与发控软件需求规格说明" {
		t.Fatalf("对象名称识别错误: %s", firstBody.ObjectName)
	}
	if firstBody.Status != "draft" || !firstBody.HasLocalFile {
		t.Fatalf("上传后应生成待确认文件版本: %+v", firstBody)
	}

	expectedHash := sha256.Sum256([]byte("SRS V1.00"))
	if firstBody.SHA256 != hex.EncodeToString(expectedHash[:]) {
		t.Fatalf("SHA-256 不正确: %s", firstBody.SHA256)
	}

	files, err := filepath.Glob(filepath.Join(assetRoot, "projects", projectCode, "*", "*", "*.original.docx"))
	if err != nil {
		t.Fatalf("查找落盘文件失败: %v", err)
	}
	if len(files) != 1 {
		t.Fatalf("应落盘 1 个原始文件，实际 %d: %v", len(files), files)
	}
	content, err := os.ReadFile(files[0])
	if err != nil {
		t.Fatalf("读取落盘文件失败: %v", err)
	}
	if string(content) != "SRS V1.00" {
		t.Fatalf("落盘文件内容不正确: %s", content)
	}

	updateBody, err := json.Marshal(map[string]string{
		"objectKind":  "srs",
		"objectName":  "BCD星指令生成与发控软件需求规格说明",
		"version":     "V1.00",
		"platform":    "cpu",
		"source":      "研制方",
		"receivedAt":  "2026-09-14",
		"receiveMode": "email",
	})
	if err != nil {
		t.Fatalf("构造更新请求失败: %v", err)
	}
	updateRecorder := httptest.NewRecorder()
	updateRequest := httptest.NewRequest(http.MethodPut, "/api/v1/work-object-versions/"+firstBody.ID, bytes.NewReader(updateBody))
	updateRequest.Header.Set("Content-Type", "application/json")
	updateRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(updateRecorder, updateRequest)
	if updateRecorder.Code != http.StatusOK {
		t.Fatalf("更新状态码应为 200，实际 %d，响应: %s", updateRecorder.Code, updateRecorder.Body.String())
	}

	confirmRecorder := httptest.NewRecorder()
	confirmRequest := httptest.NewRequest(http.MethodPost, "/api/v1/work-object-versions/"+firstBody.ID+"/confirm", nil)
	confirmRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(confirmRecorder, confirmRequest)
	if confirmRecorder.Code != http.StatusOK {
		t.Fatalf("确认状态码应为 200，实际 %d，响应: %s", confirmRecorder.Code, confirmRecorder.Body.String())
	}

	listBody := listWorkObjects(t, handler, token, projectCode)
	if len(listBody) != 1 || listBody[0].Status != "confirmed" || listBody[0].Platform != "cpu" {
		t.Fatalf("刷新列表回显错误: %+v", listBody)
	}

	updateConfirmedRecorder := httptest.NewRecorder()
	updateConfirmedRequest := httptest.NewRequest(http.MethodPut, "/api/v1/work-object-versions/"+firstBody.ID, bytes.NewReader(updateBody))
	updateConfirmedRequest.Header.Set("Content-Type", "application/json")
	updateConfirmedRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(updateConfirmedRecorder, updateConfirmedRequest)
	if updateConfirmedRecorder.Code != http.StatusConflict {
		t.Fatalf("修改已确认版本应返回 409，实际 %d", updateConfirmedRecorder.Code)
	}

	secondBody := uploadWorkObjectTestFile(t, handler, token, projectCode, "BCD星指令生成与发控软件需求规格说明V1.01.docx", "SRS V1.01")
	if secondBody.WorkObjectID != firstBody.WorkObjectID || secondBody.Version != "V1.01" {
		t.Fatalf("V1.01 应挂在同一个工作对象下: first=%+v second=%+v", firstBody, secondBody)
	}

	confirmSecondRecorder := httptest.NewRecorder()
	confirmSecondRequest := httptest.NewRequest(http.MethodPost, "/api/v1/work-object-versions/"+secondBody.ID+"/confirm", nil)
	confirmSecondRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(confirmSecondRecorder, confirmSecondRequest)
	if confirmSecondRecorder.Code != http.StatusOK {
		t.Fatalf("确认 V1.01 状态码应为 200，实际 %d", confirmSecondRecorder.Code)
	}

	listAfterSecondConfirm := listWorkObjects(t, handler, token, projectCode)
	versionsAfterSecondConfirm := make(map[string]workObjectTestResponse, len(listAfterSecondConfirm))
	for _, item := range listAfterSecondConfirm {
		versionsAfterSecondConfirm[item.ID] = item
	}
	if versionsAfterSecondConfirm[firstBody.ID].Status != "superseded" ||
		versionsAfterSecondConfirm[firstBody.ID].SupersededBy != secondBody.ID ||
		versionsAfterSecondConfirm[secondBody.ID].Status != "confirmed" {
		t.Fatalf("确认新版本后替代关系错误: %+v", listAfterSecondConfirm)
	}

	firstLifecycle := listWorkObjectLifecycle(t, handler, token, firstBody.ID)
	if len(firstLifecycle) < 2 || firstLifecycle[0].Action != "supersede" || firstLifecycle[1].Action != "confirm" {
		t.Fatalf("V1.00 生命周期记录错误: %+v", firstLifecycle)
	}

	withdrawBody, err := json.Marshal(map[string]string{"reason": "新版本信息确认有误，需要修正后重新确认"})
	if err != nil {
		t.Fatalf("构造撤回请求失败: %v", err)
	}
	withdrawRecorder := httptest.NewRecorder()
	withdrawRequest := httptest.NewRequest(http.MethodPost, "/api/v1/work-object-versions/"+secondBody.ID+"/withdraw", bytes.NewReader(withdrawBody))
	withdrawRequest.Header.Set("Content-Type", "application/json")
	withdrawRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(withdrawRecorder, withdrawRequest)
	if withdrawRecorder.Code != http.StatusOK {
		t.Fatalf("撤回 V1.01 状态码应为 200，实际 %d，响应: %s", withdrawRecorder.Code, withdrawRecorder.Body.String())
	}
	listAfterWithdraw := listWorkObjects(t, handler, token, projectCode)
	versionsAfterWithdraw := make(map[string]workObjectTestResponse, len(listAfterWithdraw))
	for _, item := range listAfterWithdraw {
		versionsAfterWithdraw[item.ID] = item
	}
	if versionsAfterWithdraw[secondBody.ID].Status != "draft" ||
		versionsAfterWithdraw[firstBody.ID].Status != "confirmed" {
		t.Fatalf("撤回 V1.01 后应恢复 V1.00: %+v", listAfterWithdraw)
	}

	reconfirmRecorder := httptest.NewRecorder()
	reconfirmRequest := httptest.NewRequest(http.MethodPost, "/api/v1/work-object-versions/"+secondBody.ID+"/confirm", nil)
	reconfirmRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(reconfirmRecorder, reconfirmRequest)
	if reconfirmRecorder.Code != http.StatusOK {
		t.Fatalf("重新确认 V1.01 状态码应为 200，实际 %d", reconfirmRecorder.Code)
	}

	revokeBody, err := json.Marshal(map[string]string{"reason": "客户通知 V1.01 资料作废"})
	if err != nil {
		t.Fatalf("构造作废请求失败: %v", err)
	}
	revokeRecorder := httptest.NewRecorder()
	revokeRequest := httptest.NewRequest(http.MethodPost, "/api/v1/work-object-versions/"+secondBody.ID+"/revoke", bytes.NewReader(revokeBody))
	revokeRequest.Header.Set("Content-Type", "application/json")
	revokeRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(revokeRecorder, revokeRequest)
	if revokeRecorder.Code != http.StatusOK {
		t.Fatalf("作废 V1.01 状态码应为 200，实际 %d，响应: %s", revokeRecorder.Code, revokeRecorder.Body.String())
	}
	listAfterRevoke := listWorkObjects(t, handler, token, projectCode)
	versionsAfterRevoke := make(map[string]workObjectTestResponse, len(listAfterRevoke))
	for _, item := range listAfterRevoke {
		versionsAfterRevoke[item.ID] = item
	}
	if versionsAfterRevoke[secondBody.ID].Status != "revoked" ||
		versionsAfterRevoke[firstBody.ID].Status != "superseded" {
		t.Fatalf("作废后的状态错误: %+v", listAfterRevoke)
	}
	if files, err := filepath.Glob(filepath.Join(assetRoot, "projects", projectCode, "*", "*", "*.original.docx")); err != nil || len(files) != 2 {
		t.Fatalf("作废后应保留两个原始文件，文件数异常: %v, err=%v", files, err)
	}

	secondLifecycle := listWorkObjectLifecycle(t, handler, token, secondBody.ID)
	if len(secondLifecycle) < 4 {
		t.Fatalf("V1.01 生命周期记录不完整: %+v", secondLifecycle)
	}

	deleteConfirmedRecorder := httptest.NewRecorder()
	deleteConfirmedRequest := httptest.NewRequest(http.MethodDelete, "/api/v1/work-object-versions/"+secondBody.ID, nil)
	deleteConfirmedRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(deleteConfirmedRecorder, deleteConfirmedRequest)
	if deleteConfirmedRecorder.Code != http.StatusConflict {
		t.Fatalf("删除已确认版本应返回 409，实际 %d", deleteConfirmedRecorder.Code)
	}

	duplicateRecorder := uploadWorkObjectTestRecorder(t, handler, token, projectCode, "BCD星指令生成与发控软件需求规格说明V1.01.docx", "duplicate")
	if duplicateRecorder.Code != http.StatusConflict {
		t.Fatalf("重复版本应返回 409，实际 %d，响应: %s", duplicateRecorder.Code, duplicateRecorder.Body.String())
	}
}

func TestManualWorkObjectCreateAndDelete(t *testing.T) {
	handler := newTestHandler(t)
	token := loginForProjectTest(t, handler)
	projectCode := createWorkObjectTestProject(t, handler, token)

	body, err := json.Marshal(map[string]string{
		"objectKind":  "task_book",
		"objectName":  "BCD星软件研制任务书",
		"version":     "V1.00",
		"platform":    "cpu",
		"source":      "研制方",
		"receivedAt":  "2026-09-14",
		"receiveMode": "onsite",
	})
	if err != nil {
		t.Fatalf("构造手工登记请求失败: %v", err)
	}
	createRecorder := httptest.NewRecorder()
	createRequest := httptest.NewRequest(http.MethodPost, "/api/v1/projects/"+projectCode+"/work-objects/manual", bytes.NewReader(body))
	createRequest.Header.Set("Content-Type", "application/json")
	createRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(createRecorder, createRequest)
	if createRecorder.Code != http.StatusOK {
		t.Fatalf("手工登记状态码应为 200，实际 %d，响应: %s", createRecorder.Code, createRecorder.Body.String())
	}

	var created workObjectTestResponse
	if err := json.Unmarshal(createRecorder.Body.Bytes(), &created); err != nil {
		t.Fatalf("解析手工登记响应失败: %v", err)
	}
	if created.ObjectKind != "task_book" || created.HasLocalFile || created.Status != "draft" {
		t.Fatalf("手工登记响应异常: %+v", created)
	}

	items := listWorkObjects(t, handler, token, projectCode)
	if len(items) != 1 || items[0].ID != created.ID {
		t.Fatalf("手工登记列表回显异常: %+v", items)
	}

	deleteRecorder := httptest.NewRecorder()
	deleteRequest := httptest.NewRequest(http.MethodDelete, "/api/v1/work-object-versions/"+created.ID, nil)
	deleteRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(deleteRecorder, deleteRequest)
	if deleteRecorder.Code != http.StatusNoContent {
		t.Fatalf("删除状态码应为 204，实际 %d，响应: %s", deleteRecorder.Code, deleteRecorder.Body.String())
	}
	if items := listWorkObjects(t, handler, token, projectCode); len(items) != 0 {
		t.Fatalf("删除后列表应为空: %+v", items)
	}
}

type workObjectTestResponse struct {
	ID           string `json:"id"`
	WorkObjectID string `json:"workObjectId"`
	ObjectKind   string `json:"objectKind"`
	ObjectName   string `json:"objectName"`
	Version      string `json:"version"`
	Platform     string `json:"platform"`
	Status       string `json:"status"`
	SupersededBy string `json:"supersededBy"`
	SHA256       string `json:"sha256"`
	HasLocalFile bool   `json:"hasLocalFile"`
}

type workObjectLifecycleTestResponse struct {
	Action string `json:"action"`
	Reason string `json:"reason"`
}

func createWorkObjectTestProject(t *testing.T, handler http.Handler, token string) string {
	t.Helper()

	optionsRecorder := httptest.NewRecorder()
	optionsRequest := httptest.NewRequest(http.MethodGet, "/api/v1/project-options", nil)
	optionsRequest.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(optionsRecorder, optionsRequest)
	if optionsRecorder.Code != http.StatusOK {
		t.Fatalf("项目选项状态码应为 200，实际 %d", optionsRecorder.Code)
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

	code := fmt.Sprintf("R%d", time.Now().UnixNano()%90000+10000)
	body, err := json.Marshal(map[string]any{
		"identifierSuffix":        code[1:],
		"name":                    "BCD星指令生成与发控软件测评",
		"nature":                  "鉴定测评",
		"platform":                "CPU/非嵌",
		"softwareType":            "新研",
		"classification":          "内部",
		"securityLevel":           "B",
		"organization":            "XX研究所",
		"ownerId":                 options.Users[0].ID,
		"memberIds":               []string{options.Users[0].ID},
		"languages":               []string{"C"},
		"runtimeEnvironments":     []string{"VxWorks"},
		"developmentEnvironments": []string{"Keil"},
		"referenceStandardIds":    []string{options.Standards[0].ID},
	})
	if err != nil {
		t.Fatalf("构造创建项目请求失败: %v", err)
	}
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/projects", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("创建项目状态码应为 200，实际 %d，响应: %s", recorder.Code, recorder.Body.String())
	}
	return code
}

func uploadWorkObjectTestFile(
	t *testing.T,
	handler http.Handler,
	token string,
	projectCode string,
	fileName string,
	content string,
) workObjectTestResponse {
	t.Helper()
	recorder := uploadWorkObjectTestRecorder(t, handler, token, projectCode, fileName, content)
	if recorder.Code != http.StatusOK {
		t.Fatalf("上传状态码应为 200，实际 %d，响应: %s", recorder.Code, recorder.Body.String())
	}
	var response []workObjectTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("解析上传响应失败: %v", err)
	}
	if len(response) != 1 {
		t.Fatalf("上传响应应包含 1 个工作对象，实际 %d", len(response))
	}
	return response[0]
}

func uploadWorkObjectTestRecorder(
	t *testing.T,
	handler http.Handler,
	token string,
	projectCode string,
	fileName string,
	content string,
) *httptest.ResponseRecorder {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	file, err := writer.CreateFormFile("files", fileName)
	if err != nil {
		t.Fatalf("构造上传文件失败: %v", err)
	}
	if _, err := io.WriteString(file, content); err != nil {
		t.Fatalf("写入上传文件失败: %v", err)
	}
	for key, value := range map[string]string{
		"source":      "客户提供",
		"receivedAt":  "2026-09-14",
		"receiveMode": "email",
	} {
		if err := writer.WriteField(key, value); err != nil {
			t.Fatalf("构造上传字段失败: %v", err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("关闭上传请求失败: %v", err)
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/projects/"+projectCode+"/work-objects/upload", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	request.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(recorder, request)
	return recorder
}

func listWorkObjects(t *testing.T, handler http.Handler, token string, projectCode string) []workObjectTestResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/projects/"+projectCode+"/work-objects", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("列表状态码应为 200，实际 %d，响应: %s", recorder.Code, recorder.Body.String())
	}
	var response []workObjectTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("解析列表失败: %v", err)
	}
	return response
}

func listWorkObjectLifecycle(
	t *testing.T,
	handler http.Handler,
	token string,
	versionID string,
) []workObjectLifecycleTestResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/work-object-versions/"+versionID+"/lifecycle", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("生命周期状态码应为 200，实际 %d，响应: %s", recorder.Code, recorder.Body.String())
	}
	var response []workObjectLifecycleTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("解析生命周期失败: %v", err)
	}
	return response
}
