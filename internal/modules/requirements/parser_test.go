package requirements

import (
	"strings"
	"testing"
)

func TestParseDOCXHeadingsIgnoreTOCAndTables(t *testing.T) {
	document := `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
 <w:body>
  <w:p><w:pPr><w:pStyle w:val="20"/></w:pPr><w:r><w:t>1 范围1</w:t></w:r></w:p>
  <w:p><w:pPr><w:pStyle w:val="1"/></w:pPr><w:r><w:t>范围</w:t></w:r></w:p>
  <w:p><w:pPr><w:pStyle w:val="1"/></w:pPr><w:r><w:t>工程需求</w:t></w:r></w:p>
  <w:p><w:pPr><w:pStyle w:val="2"/></w:pPr><w:r><w:t>功能需求</w:t></w:r></w:p>
  <w:p><w:pPr><w:numPr><w:ilvl w:val="2"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>[RQGN001-CMD-001] 指令管理</w:t></w:r></w:p>
  <w:p><w:pPr><w:numPr><w:ilvl w:val="3"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>业务处理需求</w:t></w:r></w:p>
  <w:p><w:r><w:t>系统应提供指令管理功能。</w:t></w:r></w:p>
  <w:tbl><w:tr><w:tc><w:p><w:r><w:t>24.03</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
  <w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>质量要求</w:t></w:r></w:p>
  <w:p><w:r><w:t>系统应持续记录操作审计日志。</w:t></w:r></w:p>
 </w:body>
</w:document>`

	paragraphs, err := readParagraphs(strings.NewReader(document))
	if err != nil {
		t.Fatalf("读取 DOCX 段落失败: %v", err)
	}
	nodes := buildParsedNodes(paragraphs)
	want := []struct{ chapter, title, parent string }{
		{"1", "范围", ""},
		{"2", "工程需求", ""},
		{"2.1", "功能需求", "2"},
		{"2.1.1", "[RQGN001-CMD-001] 指令管理", "2.1"},
		{"2.1.1.1", "业务处理需求", "2.1.1"},
		{"2.2", "质量要求", "2"},
	}
	if len(nodes) != len(want) {
		t.Fatalf("章节数量错误: %+v", nodes)
	}
	for index, expected := range want {
		if nodes[index].ChapterNumber != expected.chapter || nodes[index].Title != expected.title ||
			nodes[index].ParentChapter != expected.parent {
			t.Fatalf("第 %d 个章节错误: got %+v, want %+v", index, nodes[index], expected)
		}
	}
	leaf := nodes[3]
	if !leaf.IsRequirement || leaf.ExternalIdentifier != "RQGN001-CMD-001" {
		t.Fatalf("叶子需求识别错误: %+v", leaf)
	}
	if !strings.Contains(leaf.Description, "业务处理需求：系统应提供指令管理功能。\n[表格]") {
		t.Fatalf("叶子需求应合并子章节描述: %+v", leaf)
	}
	if nodes[4].IsRequirement {
		t.Fatalf("需求组内的普通子章节不应成为需求: %+v", nodes[4])
	}
	if !nodes[5].IsRequirement {
		t.Fatalf("标题包含要求且描述包含应的章节应成为需求: %+v", nodes[5])
	}
}

func TestParseDOCXOnlyExternalInterfaceIsRequirement(t *testing.T) {
	paragraphs := []docxParagraph{
		{style: "1", text: "4 接口", position: 1},
		{style: "2", text: "内部接口", position: 2},
		{text: "系统应在模块间转发数据。", position: 3},
		{style: "2", text: "外部接口", position: 4},
		{text: "系统应提供对外数据交换能力。", position: 5},
		{style: "3", text: "与测控系统接口", position: 6},
		{text: "系统应接收测控系统指令。", position: 7},
		{text: "[表格]", inTable: true, position: 8},
		{style: "2", text: "接口说明", position: 9},
		{text: "系统应按照接口文件执行。", position: 10},
	}

	nodes := buildParsedNodes(paragraphs)
	byChapter := make(map[string]ParsedNode, len(nodes))
	for _, node := range nodes {
		byChapter[node.ChapterNumber] = node
	}

	if byChapter["1"].IsRequirement || byChapter["1.1"].IsRequirement ||
		byChapter["1.2.1"].IsRequirement || byChapter["1.3"].IsRequirement {
		t.Fatalf("泛化接口、内部接口和外部接口子章节不应成为需求: %+v", nodes)
	}
	external := byChapter["1.2"]
	if !external.IsRequirement || external.PrimaryKind != KindInterface {
		t.Fatalf("外部接口应成为接口需求: %+v", external)
	}
	if len(external.Tags) != 1 || external.Tags[0] != "外部接口" {
		t.Fatalf("外部接口应携带标识: %+v", external.Tags)
	}
	if !strings.Contains(external.Description, "与测控系统接口：系统应接收测控系统指令。") ||
		!strings.Contains(external.Description, "[表格]") {
		t.Fatalf("外部接口应合并子章节和表格上下文: %+v", external.Description)
	}
}
