package contentblocks

import (
	"testing"

	"chenmeridian/internal/modules/officecli"
)

func TestSegmentBodyByParagraphIndex(t *testing.T) {
	body := []officecli.Node{
		paragraph("3 功能需求", "heading 1", nil),   // 段落 1
		paragraph("3.1 数据处理", "heading 2", nil), // 段落 2
		paragraph("系统应完成解析。", "Normal", nil),    // 段落 3
		{Type: "table", Children: []officecli.Node{ // 段落 4、5
			{Type: "row", Children: []officecli.Node{
				cell(paragraph("表头", "Normal", nil)),
				cell(paragraph("值", "Normal", nil)),
			}},
		}},
		paragraph("3.2 性能需求", "heading 2", nil),  // 段落 6
		paragraph("延迟不高于 200ms。", "Normal", nil), // 段落 7
	}

	// 章节 3.1 的区间是段落 2–5（不含 6），应包含标题、正文与整张表。
	segment := SegmentBody(body, 2, 6)
	if len(segment) != 3 {
		t.Fatalf("应选中 3 个顶层元素，实际 %d", len(segment))
	}
	if segment[0].Type != "paragraph" || segment[2].Type != "table" {
		t.Fatalf("选区内容不符合预期: %+v", segment)
	}

	// 章节 3.2 的区间是段落 6 到文档末尾。
	tail := SegmentBody(body, 6, 0)
	if len(tail) != 2 {
		t.Fatalf("尾段应选中 2 个元素，实际 %d", len(tail))
	}
	if tail[0].Text != "3.2 性能需求" {
		t.Fatalf("尾段起点不正确: %+v", tail[0])
	}

	// 越界区间返回空。
	if len(SegmentBody(body, 99, 0)) != 0 {
		t.Fatal("越界区间应返回空")
	}
}
