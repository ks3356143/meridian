package contentblocks

import (
	"encoding/json"
	"strings"
	"testing"
)

func doc(children ...Node) Node {
	return Node{Type: NodeDoc, Content: children}
}

func para(text string) Node {
	return Node{Type: NodeParagraph, Content: []Node{{Type: NodeText, Text: text}}}
}

func TestValidateDocumentAcceptsAllowedNodes(t *testing.T) {
	document := doc(
		Node{Type: NodeHeading, Attrs: map[string]any{"level": float64(3)}, Content: []Node{{Type: NodeText, Text: "标题"}}},
		para("正文段落"),
		Node{Type: NodeOrderedList, Attrs: map[string]any{"style": ListStyleLetterParen}, Content: []Node{
			{Type: NodeListItem, Content: []Node{para("第一项")}},
		}},
		Node{Type: NodeTable, Attrs: map[string]any{"align": "center"}, Content: []Node{
			{Type: NodeTableRow, Content: []Node{
				{Type: NodeTableHeader, Attrs: map[string]any{"align": "center"}, Content: []Node{para("表头")}},
				{Type: NodeTableCell, Attrs: map[string]any{"align": "left", "valign": "center"}, Content: []Node{para("长文本")}},
			}},
		}},
		Node{Type: NodeAssetImage, Attrs: map[string]any{"assetId": "asset-1", "width": float64(320)}},
		Node{Type: NodePageBreak},
	)

	if err := ValidateDocument(document); err != nil {
		t.Fatalf("期望校验通过，实际报错: %v", err)
	}
}

func TestValidateDocumentRejects(t *testing.T) {
	cases := []struct {
		name   string
		root   Node
		expect string
	}{
		{
			name:   "根节点不是 doc",
			root:   Node{Type: NodeParagraph, Content: []Node{{Type: NodeText, Text: "x"}}},
			expect: "根节点必须是 doc",
		},
		{
			name:   "未登记节点 blockquote",
			root:   doc(Node{Type: "blockquote", Content: []Node{para("引用")}}),
			expect: "不允许出现在",
		},
		{
			name:   "heading 层级越界",
			root:   doc(Node{Type: NodeHeading, Attrs: map[string]any{"level": float64(6)}, Content: []Node{{Type: NodeText, Text: "x"}}}),
			expect: "level 必须在",
		},
		{
			name:   "heading 缺少 level",
			root:   doc(Node{Type: NodeHeading, Content: []Node{{Type: NodeText, Text: "x"}}}),
			expect: "缺少 level",
		},
		{
			name:   "assetImage 缺少 assetId",
			root:   doc(Node{Type: NodeAssetImage, Attrs: map[string]any{"alt": "图"}}),
			expect: "缺少 assetId",
		},
		{
			name:   "table 没有行",
			root:   doc(Node{Type: NodeTable}),
			expect: "缺少必需的子节点",
		},
		{
			name:   "orderedList 形态非法",
			root:   doc(Node{Type: NodeOrderedList, Attrs: map[string]any{"style": "roman"}, Content: []Node{{Type: NodeListItem, Content: []Node{para("x")}}}}),
			expect: "列表形态",
		},
		{
			name:   "text 直接挂在 doc 下",
			root:   doc(Node{Type: NodeText, Text: "裸文本"}),
			expect: "不允许出现在",
		},
		{
			name:   "未登记行内标记",
			root:   doc(paraWithMark("文字", "strike")),
			expect: "行内标记",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateDocument(tc.root)
			if err == nil {
				t.Fatalf("期望校验失败，实际通过")
			}
			if !strings.Contains(err.Error(), tc.expect) {
				t.Fatalf("期望错误包含 %q，实际为 %q", tc.expect, err.Error())
			}
		})
	}
}

func paraWithMark(text, mark string) Node {
	return Node{Type: NodeParagraph, Content: []Node{
		{Type: NodeText, Text: text, Marks: []Mark{{Type: mark}}},
	}}
}

func TestParseDocumentRejectsInvalidJSON(t *testing.T) {
	if _, err := ParseDocument([]byte("{not json")); err == nil {
		t.Fatal("期望 JSON 解析失败")
	}
}

func TestParseDocumentFallsBackToEmpty(t *testing.T) {
	root, err := ParseDocument([]byte("  "))
	if err != nil {
		t.Fatalf("期望使用空文档兜底，实际报错: %v", err)
	}
	if root.Type != NodeDoc || len(root.Content) != 0 {
		t.Fatalf("期望空 doc，实际为 %+v", root)
	}
}

func TestPlainTextExtraction(t *testing.T) {
	document := doc(
		para("第一段"),
		Node{Type: NodeTable, Content: []Node{
			{Type: NodeTableRow, Content: []Node{
				{Type: NodeTableHeader, Content: []Node{para("姓名")}},
				{Type: NodeTableCell, Content: []Node{para("张三")}},
			}},
		}},
	)
	got := PlainText(document)
	if !strings.Contains(got, "第一段") || !strings.Contains(got, "姓名\t张三") {
		t.Fatalf("纯文本提取不符合预期: %q", got)
	}
}

func TestMarshalDocumentRoundTrip(t *testing.T) {
	document := doc(para("往返"))
	encoded, err := MarshalDocument(document)
	if err != nil {
		t.Fatalf("序列化失败: %v", err)
	}
	decoded, err := ParseDocument([]byte(encoded))
	if err != nil {
		t.Fatalf("反序列化失败: %v", err)
	}
	if PlainText(decoded) != "往返" {
		t.Fatalf("往返后纯文本不一致: %q", PlainText(decoded))
	}
	var raw map[string]any
	if err := json.Unmarshal([]byte(encoded), &raw); err != nil {
		t.Fatalf("编码结果不是合法 JSON: %v", err)
	}
}