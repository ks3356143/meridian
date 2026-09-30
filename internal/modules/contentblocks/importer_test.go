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
		// 无序列表按“只保留有序列表”规则转换。
		paragraph("第一项", "List Paragraph", map[string]any{"numId": "7", "listStyle": "bullet", "numFmt": "bullet"}),
		paragraph("第二项", "List Paragraph", map[string]any{"numId": "7", "listStyle": "bullet", "numFmt": "bullet"}),
		// 有序列表一项（字母括号）。
		paragraph("甲项", "List Paragraph", map[string]any{"numId": "9", "listStyle": "ordered", "numFmt": "lowerLetter"}),
		// 表格：首行表头。
		{
			Type: "table",
			Children: []officecli.Node{
				{Type: "row", Children: []officecli.Node{cell(paragraph("参数", "Normal", nil)), cell(paragraph("说明", "Normal", nil))}},
				{Type: "row", Children: []officecli.Node{cell(paragraph("V1.10", "Normal", nil)), cell(paragraph("版本号", "Normal", nil))}},
			},
		},
		// 图片段落。
		paragraph("", "Normal", map[string]any{"align": "center"}, officecli.Node{
			Type:   "picture",
			Format: map[string]any{"relId": "rId5", "width": "12.0cm", "height": "6.0cm"},
		}),
		// 内容控件包一层。
		{Type: "sdt", Children: []officecli.Node{paragraph("控件内段落", "Normal", nil)}},
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
	want := []string{NodeHeading, NodeParagraph, NodeOrderedList, NodeOrderedList, NodeTable, NodeAssetImage, NodeParagraph}
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

	firstList := result.Doc.Content[2]
	if len(firstList.Content) != 2 || firstList.Type != NodeOrderedList {
		t.Fatalf("无序列表应转换为有序列表并合并两项: %+v", firstList)
	}
	ordered := result.Doc.Content[3]
	if style, _ := stringAttr(ordered.Attrs, "style"); style != ListStyleOrderedParen {
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

func TestConvertBodyBuildsNestedOrderedList(t *testing.T) {
	body := []officecli.Node{
		paragraph("一级一", "List Paragraph", map[string]any{"numId": "7", "numLevel": "0"}),
		paragraph("二级一", "List Paragraph", map[string]any{"numId": "7", "numLevel": "1"}),
		paragraph("二级二", "List Paragraph", map[string]any{"numId": "7", "numLevel": "1"}),
		paragraph("一级二", "List Paragraph", map[string]any{"numId": "7", "numLevel": "0"}),
	}
	result := ConvertBody(body, ImportOptions{})
	if len(result.Doc.Content) != 1 {
		t.Fatalf("应产出一个顶层有序列表，实际 %d", len(result.Doc.Content))
	}
	root := result.Doc.Content[0]
	if root.Type != NodeOrderedList || len(root.Content) != 2 {
		t.Fatalf("顶层列表不正确: %+v", root)
	}
	firstItem := root.Content[0]
	if len(firstItem.Content) != 2 || firstItem.Content[1].Type != NodeOrderedList {
		t.Fatalf("一级项下应有二级有序列表: %+v", firstItem)
	}
	if len(firstItem.Content[1].Content) != 2 {
		t.Fatalf("二级列表应有两项: %+v", firstItem.Content[1])
	}
}

func TestConvertBodyKeepsParagraphAlignmentAndIndent(t *testing.T) {
	body := []officecli.Node{
		paragraph("正文", "Normal", map[string]any{"align": "left", "firstLineChars": float64(200)}),
		paragraph("居中", "Normal", map[string]any{"align": "center", "firstLineChars": float64(200)}),
	}
	result := ConvertBody(body, ImportOptions{})
	left := result.Doc.Content[0]
	if align, _ := stringAttr(left.Attrs, "align"); align != "left" {
		t.Fatalf("段落对齐未保留: %+v", left.Attrs)
	}
	if indent, _ := intAttr(left.Attrs, "firstLineIndent"); indent != 2 {
		t.Fatalf("段落首行缩进未识别: %+v", left.Attrs)
	}
	center := result.Doc.Content[1]
	if _, ok := center.Attrs["firstLineIndent"]; ok {
		t.Fatalf("居中段落不应保留首行缩进: %+v", center.Attrs)
	}
}

func TestConvertBodyTableUsesFirstRowMetadata(t *testing.T) {
	table := officecli.Node{
		Type:   "table",
		Format: map[string]any{"firstRow": false},
		Children: []officecli.Node{
			{Type: "row", Children: []officecli.Node{cell(paragraph("无表头", "Normal", nil))}},
		},
	}
	result := ConvertBody([]officecli.Node{table}, ImportOptions{HeaderRow: true})
	if got := result.Doc.Content[0].Content[0].Content[0].Type; got != NodeTableCell {
		t.Fatalf("firstRow=false 时不应强制表头，实际 %s", got)
	}
}

func TestConvertBodyIdentifiesTableCaption(t *testing.T) {
	body := []officecli.Node{
		paragraph("表1-1 参数说明", "Normal", map[string]any{"align": "center"}),
	}
	result := ConvertBody(body, ImportOptions{})
	if variant, _ := stringAttr(result.Doc.Content[0].Attrs, "variant"); variant != "tableCaption" {
		t.Fatalf("表题语义未识别: %+v", result.Doc.Content[0].Attrs)
	}
}

func TestConvertBodyTableColspanAndVerticalMerge(t *testing.T) {
	table := officecli.Node{
		Type: "table",
		Children: []officecli.Node{
			{Type: "row", Children: []officecli.Node{
				{Type: "cell", Format: map[string]any{"colspan": float64(2), "vmerge": "restart"}, Children: []officecli.Node{paragraph("合并", "Normal", nil)}},
			}},
			{Type: "row", Children: []officecli.Node{
				{Type: "cell", Format: map[string]any{"vmerge": "continue"}, Children: []officecli.Node{paragraph("", "Normal", nil)}},
				{Type: "cell", Format: map[string]any{"vmerge": "continue"}, Children: []officecli.Node{paragraph("", "Normal", nil)}},
			}},
		},
	}
	result := ConvertBody([]officecli.Node{table}, ImportOptions{})
	cell := result.Doc.Content[0].Content[0].Content[0]
	if colspan, _ := intAttr(cell.Attrs, "colspan"); colspan != 2 {
		t.Fatalf("colspan 未保留: %+v", cell.Attrs)
	}
	if rowspan, _ := intAttr(cell.Attrs, "rowspan"); rowspan != 2 {
		t.Fatalf("vmerge 应转换为 rowspan=2: %+v", cell.Attrs)
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
	if len(content[1].Marks) != 0 || len(content[2].Marks) != 0 {
		t.Fatalf("斜体与下划线应被降级为普通文本: %+v %+v", content[1], content[2])
	}
	if len(content[3].Marks) != 0 {
		t.Fatalf("普通文本不应有标记: %+v", content[3])
	}
}
