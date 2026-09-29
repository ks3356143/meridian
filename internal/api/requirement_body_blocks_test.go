package api

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"chenmeridian/internal/modules/officecli"
)

// TestParseBuildsRequirementBodyBlocks 验证解析 SRS 时按需求区间落正文块。
// 需要本机存在 OfficeCLI，否则跳过（CI 无引擎时属于允许的降级）。
func TestParseBuildsRequirementBodyBlocks(t *testing.T) {
	client := officecli.NewClient("")
	if !client.Available() {
		t.Skip("本机没有可用的 OfficeCLI，跳过正文块联调")
	}

	ctx := context.Background()
	docxPath := filepath.Join(t.TempDir(), "srs.docx")
	if _, err := client.Run(ctx, "create", docxPath); err != nil {
		t.Fatalf("创建测试 DOCX 失败: %v", err)
	}
	defer client.Close(ctx, docxPath)

	for _, text := range []string{
		"3 功能需求",
		"3.1 数据处理功能",
		"系统应完成指令数据的解析、校验和分发。",
		"3.2 性能需求",
		"处理延迟应不高于 200ms。",
	} {
		if _, err := client.Run(ctx, "add", docxPath, "/body", "--type", "paragraph", "--prop", "text="+text); err != nil {
			t.Fatalf("写入段落失败: %v", err)
		}
	}
	// OfficeCLI 的常驻进程会延迟落盘，非 officecli 程序读文件前必须先 close/save。
	if _, err := client.Run(ctx, "close", docxPath); err != nil {
		t.Fatalf("关闭常驻进程失败: %v", err)
	}
	data, err := os.ReadFile(docxPath)
	if err != nil {
		t.Fatalf("读取测试 DOCX 失败: %v", err)
	}

	handler := newTestHandler(t)
	token := loginForProjectTest(t, handler)
	projectCode := createWorkObjectTestProject(t, handler, token)
	source := uploadWorkObjectTestFile(t, handler, token, projectCode,
		"BCD星指令生成与发控软件需求规格说明V1.01.docx", string(data))
	postJSON(t, handler, token, http.MethodPost,
		"/api/v1/work-object-versions/"+source.ID+"/confirm", nil, http.StatusOK)

	result := postJSONMap(t, handler, token, http.MethodPost,
		"/api/v1/projects/"+projectCode+"/requirements/parse",
		map[string]string{"sourceVersionId": source.ID}, http.StatusOK)
	if skipped, _ := result["bodyBuildSkipped"].(bool); skipped {
		t.Fatalf("本机有引擎却降级: %v", result["bodyBuildError"])
	}
	built, _ := result["bodyBlockCount"].(float64)
	if built <= 0 {
		t.Fatalf("解析后应构建正文块，实际 %v", result)
	}

	workbench := listRequirementsWorkbench(t, handler, token, projectCode)
	if len(workbench.Requirements) == 0 {
		t.Fatalf("解析后应有候选需求")
	}
	candidateID := ""
	for _, item := range workbench.Requirements {
		if item.Status == "candidate" {
			candidateID = item.ID
			break
		}
	}
	if candidateID == "" {
		t.Fatalf("未找到候选需求: %+v", workbench.Requirements)
	}

	body := readRequirementBody(t, handler, token, candidateID, http.StatusOK)
	if !body.HasContent {
		t.Fatalf("候选需求应有正文块内容: %+v", body)
	}
	if !strings.Contains(body.PlainText, "系统应完成指令数据的解析") {
		t.Fatalf("正文块纯文本不符合预期: %q", body.PlainText)
	}
}
