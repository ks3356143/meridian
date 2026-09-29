package officecli

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// TestClientSmokeAgainstRealBinary 需要本机存在 OfficeCLI：
// 设置 OFFICECLI_BINARY 或把 officecli 放进 PATH 后执行，否则跳过。
func TestClientSmokeAgainstRealBinary(t *testing.T) {
	client := NewClient(os.Getenv("OFFICECLI_BINARY")).WithTimeout(2 * time.Minute)
	if !client.Available() {
		t.Skip("本机没有可用的 OfficeCLI 二进制，跳过联调")
	}

	ctx := context.Background()
	version, err := client.Version(ctx)
	if err != nil {
		t.Fatalf("读取版本失败: %v", err)
	}
	if strings.TrimSpace(version) == "" {
		t.Fatalf("版本号为空")
	}

	file := filepath.Join(t.TempDir(), "smoke.docx")
	if _, err := client.Run(ctx, "create", file); err != nil {
		t.Fatalf("创建文档失败: %v", err)
	}
	defer client.Close(ctx, file)

	if _, err := client.Run(ctx, "add", file, "/body", "--type", "paragraph", "--prop", "text=冒烟测试段落"); err != nil {
		t.Fatalf("写入段落失败: %v", err)
	}
	if _, err := client.Run(ctx, "set", file, "/body/p[1]", "--prop", "style=Heading2"); err != nil {
		t.Fatalf("设置标题样式失败: %v", err)
	}

	body, err := client.Body(ctx, file, 4)
	if err != nil {
		t.Fatalf("读取正文树失败: %v", err)
	}
	if len(body) == 0 {
		t.Fatalf("正文树为空")
	}
	found := false
	for _, node := range body {
		if strings.Contains(node.Text, "冒烟测试段落") {
			found = true
		}
	}
	if !found {
		t.Fatalf("未在正文树中找到写入的段落: %+v", body)
	}
}
