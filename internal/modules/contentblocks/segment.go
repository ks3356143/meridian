package contentblocks

import "chenmeridian/internal/modules/officecli"

// SegmentBody 按「全文档段落序号」区间切分正文树。
//
// start 为起始段落序号（1-based，包含），end 为结束序号（不包含，<=0 表示到文档末尾）。
// 序号口径与 Go 解析器一致：按文档顺序统计所有 w:p，包含表格与内容控件内的段落。
// 跨区间的表格按整体保留，不做半表切分。
func SegmentBody(body []officecli.Node, start, end int) []officecli.Node {
	if len(body) == 0 {
		return nil
	}
	if start <= 0 {
		start = 1
	}
	counter := 0
	selected := make([]officecli.Node, 0)
	for _, node := range body {
		count := countParagraphs(node)
		if count == 0 {
			continue
		}
		first := counter + 1
		last := counter + count
		counter = last
		if end > 0 && first >= end {
			break
		}
		if last < start {
			continue
		}
		selected = append(selected, node)
	}
	return selected
}

// countParagraphs 统计子树内的段落数量。
func countParagraphs(node officecli.Node) int {
	if node.Type == "paragraph" {
		return 1
	}
	total := 0
	for _, child := range node.Children {
		total += countParagraphs(child)
	}
	return total
}
