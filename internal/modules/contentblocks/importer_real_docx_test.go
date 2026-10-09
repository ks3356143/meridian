package contentblocks

import (
	"context"
	"os"
	"strings"
	"testing"

	"chenmeridian/internal/modules/officecli"
)

// 真实交付文档回归：解析端列宽必须与 Word 的 w:tblGrid 对齐。
// 用法：设置 OFFICECLI_BINARY 与 OFFICECLI_SAMPLE_DOCX 后执行
// go test ./internal/modules/contentblocks -run RealDocx -v
func TestConvertBodyRealDocxColumnWidths(t *testing.T) {
	sample := strings.TrimSpace(os.Getenv("OFFICECLI_SAMPLE_DOCX"))
	if sample == "" {
		t.Skip("未设置 OFFICECLI_SAMPLE_DOCX，跳过真实文档回归")
	}
	client := officecli.NewClient(os.Getenv("OFFICECLI_BINARY"))
	if !client.Available() {
		t.Skip("OfficeCLI 不可用，跳过真实文档回归")
	}
	// 引擎的常驻进程会锁住文件，收尾必须显式 close。
	defer client.Close(context.Background(), sample)
	body, err := client.Body(context.Background(), sample, 8)
	if err != nil {
		t.Fatalf("读取真实文档正文失败: %v", err)
	}

	flat := make([]officecli.Node, 0, len(body))
	flattenBody(body, &flat)
	rawTables := make([]officecli.Node, 0)
	for _, node := range flat {
		if node.Type == "table" {
			rawTables = append(rawTables, node)
		}
	}
	if len(rawTables) == 0 {
		t.Fatalf("样本文档没有表格，无法回归列宽: %s", sample)
	}

	result := ConvertBody(body, ImportOptions{})
	tables := make([]Node, 0)
	for _, block := range result.Doc.Content {
		if block.Type == NodeTable {
			tables = append(tables, block)
		}
	}
	if len(tables) != len(rawTables) {
		t.Fatalf("解析出的表格数量不一致: %d != %d", len(tables), len(rawTables))
	}

	withWidths := 0
	for index, table := range tables {
		raw := rawTables[index]
		expected := 0
		gridOK := true
		for _, part := range strings.Split(strings.TrimSpace(raw.String("colWidths")), ",") {
			points := parsePoints(part)
			if points <= 0 {
				gridOK = false
				break
			}
			expected += pointsToPixels(points)
		}
		sum := 0
		for _, cell := range table.Content[0].Content {
			widths, _ := cell.Attrs["colwidth"].([]int)
			if len(widths) == 0 {
				continue
			}
			span, _ := intAttr(cell.Attrs, "colspan")
			if span < 1 {
				span = 1
			}
			if span != len(widths) {
				t.Fatalf("表 %d 的列宽数量应等于 colspan: %d != %d", index+1, len(widths), span)
			}
			for _, width := range widths {
				sum += width
			}
		}
		if !gridOK {
			if sum != 0 {
				t.Fatalf("表 %d 没有可用 grid 却写入了列宽", index+1)
			}
			continue
		}
		if sum == 0 {
			t.Fatalf("表 %d 有 grid 却没写出列宽", index+1)
		}
		if diff := sum - expected; diff > 1 || diff < -1 {
			t.Fatalf("表 %d 首行列宽总和 %d 与 grid %d 不一致", index+1, sum, expected)
		}
		withWidths++
	}
	if withWidths == 0 {
		t.Fatalf("样本文档没有任何表格写出列宽: %s", sample)
	}
	t.Logf("真实文档回归通过：%d 张表，%d 张带列宽", len(tables), withWidths)
}
