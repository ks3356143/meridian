package contentblocks

import (
	"strings"
	"testing"

	"chenmeridian/internal/modules/officecli"
)

func run(text string, format map[string]any) officecli.Node {
	return officecli.Node{Type: "run", Text: text, Format: format}
}

func paragraph(text, style string, format map[string]any, children ...officecli.Node) officecli.Node {
	if len(children) == 0 {
		children = []officecli.Node{run(text, nil)}
	}
	return officecli.Node{Type: "paragraph", Text: text, Style: style, Format: format, Children: children}
}

func cell(children ...officecli.Node) officecli.Node {
	return officecli.Node{Type: "cell", Children: children}
}

func TestConvertBodyBuildsAllowedDocument(t *testing.T) {
	body := []officecli.Node{
		paragraph("5.1 指令参数管理", "heading 3", map[string]any{"styleName": "heading 3"}),
		paragraph("软件应支持参数配置。", "Normal", nil,
			run("软件应", map[string]any{"bold": true}),
			run("支持参数配置。", nil),
		),
		// 无序列表两项
		paragraph("第一项", "List Paragraph", map[string]any{"numId": "7", "listStyle": "bullet", "numFmt": "bullet"}),
		paragraph("第二项", "List Paragraph", map[string]any{"numId": "7", "listStyle": "bullet", "numFmt": "bullet"}),
		// 有序列表一项（字母括号）
		paragraph("甲项", "List Paragraph", map[string]any{"numId": "9", "listStyle": "ordered", "numFmt": "lowerLetter"}),
		// 表格：首行表头
		{
			Type: "table",
			Children: []officecli.Node{
				{Type: "row", Children: []officecli.Node{cell(paragraph("参数", "Normal", nil)), cell(paragraph("说明", "Normal", nil))}},
				{Type: "row", Children: []officecli.Node{cell(paragraph("V1.10", "Normal", nil)), cell(paragraph("版本号", "Normal", nil))}},
			},
		},
		// 图片段落
		paragraph("", "Normal", map[string]any{"align": "center"}, officecli.Node{
			Type:   "picture",
			Format: map[string]any{"relId": "rId5", "width": "12.0cm", "height": "6.0cm"},
		}),
		// 内容控件包一层
		{Type: "sdt", Children: []officecli.Node{paragraph("控件内段落", "Normal", nil)}},
		// 无关节点应被忽略
		{Type: "bookmark"},
	}

	result := ConvertBody(body, ImportOptions{
		HeaderRow: true,
		AssetIDForRelID: func(relID string) string {
			if relID == "rId5" {
				return "asset-5"
			}
			return ""
		},
	})

	if err := ValidateDocument(result.Doc); err != nil {
		t.Fatalf("转换结果不符合节点白名单: %v", err)
	}
	if len(result.Skipped) != 0 {
		t.Fatalf("不应有跳过的资源: %+v", result.Skipped)
	}

	kinds := make([]string, 0, len(result.Doc.Content))
	for _, block := range result.Doc.Content {
		kinds = append(kinds, block.Type)
	}
	want := []string{NodeHeading, NodeParagraph, NodeBulletList, NodeOrderedList, NodeTable, NodeAssetImage, NodeParagraph}
	if strings.Join(kinds, ",") != strings.Join(want, ",") {
		t.Fatalf("块序列不符合预期: %v", kinds)
	}

	heading := result.Doc.Content[0]
	if level, ok := intAttr(heading.Attrs, "level"); !ok || level != 3 {
		t.Fatalf("标题层级错误: %+v", heading.Attrs)
	}
	if !strings.Contains(PlainText(result.Doc), "第一项") {
		t.Fatalf("列表文本丢失: %q", PlainText(result.Doc))
	}

	bullet := result.Doc.Content[2]
	if len(bullet.Content) != 2 {
		t.Fatalf("无序列表应合并两项，实际 %d", len(bullet.Content))
	}
	ordered := result.Doc.Content[3]
	if style, _ := stringAttr(ordered.Attrs, "style"); style != ListStyleLetterParen {
		t.Fatalf("字母列表形态错误: %+v", ordered.Attrs)
	}

	table := result.Doc.Content[4]
	firstRow := table.Content[0]
	if firstRow.Content[0].Type != NodeTableHeader {
		t.Fatalf("首行应为表头，实际 %s", firstRow.Content[0].Type)
	}
	if table.Content[1].Content[0].Type != NodeTableCell {
		t.Fatalf("数据行应为普通单元格，实际 %s", table.Content[1].Content[0].Type)
	}

	image := result.Doc.Content[5]
	if assetID, _ := stringAttr(image.Attrs, "assetId"); assetID != "asset-5" {
		t.Fatalf("图片资源 id 未写入: %+v", image.Attrs)
	}
	if width, _ := stringAttr(image.Attrs, "width"); width != "12.0cm" {
		t.Fatalf("图片宽度未写入: %+v", image.Attrs)
	}
}

func TestConvertBodySkipsUnresolvedImage(t *testing.T) {
	body := []officecli.Node{
		paragraph("图前说明", "Normal", nil),
		paragraph("", "Normal", nil, officecli.Node{Type: "picture", Format: map[string]any{"relId": "rId9"}}),
	}
	result := ConvertBody(body, ImportOptions{HeaderRow: true})
	if err := ValidateDocument(result.Doc); err != nil {
		t.Fatalf("跳过图片后仍应是合法文档: %v", err)
	}
	if len(result.Skipped) != 1 || result.Skipped[0].RelID != "rId9" {
		t.Fatalf("应记录一张被跳过的图片: %+v", result.Skipped)
	}
	if len(result.Doc.Content) != 1 {
		t.Fatalf("纯图片段落不应产出空段落: %+v", result.Doc.Content)
	}
}

func TestConvertBodyHeadingLevelClamped(t *testing.T) {
	cases := map[string]int{
		"heading 1": MinHeadingLevel,
		"heading 5": MaxHeadingLevel,
		"heading 2": 2,
	}
	for styleName, want := range cases {
		body := []officecli.Node{paragraph("标题", styleName, map[string]any{"styleName": styleName})}
		result := ConvertBody(body, ImportOptions{})
		if len(result.Doc.Content) != 1 {
			t.Fatalf("%s 应产出一个块", styleName)
		}
		level, _ := intAttr(result.Doc.Content[0].Attrs, "level")
		if level != want {
			t.Fatalf("%s 层级应收敛为 %d，实际 %d", styleName, want, level)
		}
	}
}

func TestConvertBodyTextMarks(t *testing.T) {
	body := []officecli.Node{
		paragraph("", "Normal", nil,
			run("加粗", map[string]any{"bold": true}),
			run("斜体", map[string]any{"italic": true}),
			run("下划线", map[string]any{"underline": "single"}),
			run("普通", nil),
		),
	}
	result := ConvertBody(body, ImportOptions{})
	if err := ValidateDocument(result.Doc); err != nil {
		t.Fatalf("结果应合法: %v", err)
	}
	content := result.Doc.Content[0].Content
	if len(content) != 4 {
		t.Fatalf("run 数量不符: %d", len(content))
	}
	if len(content[0].Marks) != 1 || content[0].Marks[0].Type != MarkBold {
		t.Fatalf("加粗标记丢失: %+v", content[0])
	}
	if len(content[2].Marks) != 1 || content[2].Marks[0].Type != MarkUnderline {
		t.Fatalf("下划线标记丢失: %+v", content[2])
	}
	if len(content[3].Marks) != 0 {
		t.Fatalf("普通文本不应有标记: %+v", content[3])
	}
}