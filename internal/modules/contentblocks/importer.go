package contentblocks

import (
	"regexp"
	"strconv"
	"strings"

	"chenmeridian/internal/modules/officecli"
)

// ImportOptions 控制 DOCX 正文到受限内容块的转换。
type ImportOptions struct {
	// AssetIDForRelID 把文档内 relId 映射成已落库的资源 id；返回空字符串表示跳过该图片。
	AssetIDForRelID func(relID string) string
	// HeaderRow 是缺少表格 firstRow 元数据时的兜底；真实文档优先读表格自身的 firstRow。
	HeaderRow bool
}

// ImportResult 是一次转换的结果。
type ImportResult struct {
	Doc     Node
	Skipped []SkippedMedia
}

// ConvertBody 把 OfficeCLI 的 /body 子树转换成受限内容块文档。
func ConvertBody(body []officecli.Node, options ImportOptions) ImportResult {
	converter := &converter{options: options}
	flat := make([]officecli.Node, 0, len(body))
	flattenBody(body, &flat)

	pendingNumID := ""
	pendingList := make([]listEntry, 0)
	for _, node := range flat {
		switch node.Type {
		case "table":
			converter.flushList(&pendingNumID, &pendingList)
			if table, ok := converter.convertTable(node); ok {
				converter.blocks = append(converter.blocks, table)
			}
		default:
			converted := converter.convertParagraph(node)
			if converted.list != nil {
				if pendingNumID != converted.list.numID {
					converter.flushList(&pendingNumID, &pendingList)
					pendingNumID = converted.list.numID
				}
				pendingList = append(pendingList, listEntry{level: converted.list.level, item: converted.item})
			} else {
				converter.flushList(&pendingNumID, &pendingList)
				if converted.block != nil {
					converter.blocks = append(converter.blocks, *converted.block)
				}
				converter.blocks = append(converter.blocks, converted.images...)
			}
		}
	}
	converter.flushList(&pendingNumID, &pendingList)

	return ImportResult{
		Doc:     Node{Type: NodeDoc, Content: converter.blocks},
		Skipped: converter.skipped,
	}
}

type converter struct {
	options ImportOptions
	blocks  []Node
	skipped []SkippedMedia
}

type paragraphResult struct {
	block  *Node
	images []Node
	list   *listMarker
	item   Node
}

type listMarker struct {
	numID string
	level int
	item  Node
}

type listEntry struct {
	level int
	item  Node
}

type listTree struct {
	Node  Node
	Items []*listItemTree
}

type listItemTree struct {
	Node     Node
	Children *listTree
}

type rowCellAnchor struct {
	row  int
	cell int
}

var tableCaptionPattern = regexp.MustCompile(`^表\s*\d+(?:\s*[-－—]\s*\d+)?\s+.+$`)

func (c *converter) flushList(numID *string, entries *[]listEntry) {
	if len(*entries) == 0 {
		*numID = ""
		return
	}
	c.blocks = append(c.blocks, buildOrderedList(*entries))
	*entries = nil
	*numID = ""
}

func buildOrderedList(entries []listEntry) Node {
	root := &listTree{Node: Node{Type: NodeOrderedList, Attrs: map[string]any{"style": DefaultListStyle}}}
	stack := []*listTree{root}
	lastItems := make([]*listItemTree, 1)

	for _, entry := range entries {
		target := entry.level + 1
		if target < 1 {
			target = 1
		}
		if target > len(stack)+1 {
			target = len(stack) + 1
		}
		for target > len(stack) {
			parent := lastItems[len(lastItems)-1]
			if parent == nil {
				break
			}
			child := &listTree{Node: Node{Type: NodeOrderedList, Attrs: map[string]any{"style": DefaultListStyle}}}
			parent.Children = child
			stack = append(stack, child)
			lastItems = append(lastItems, nil)
		}
		if target < len(stack) {
			stack = stack[:target]
			lastItems = lastItems[:target]
		}
		current := stack[len(stack)-1]
		item := &listItemTree{Node: entry.item}
		current.Items = append(current.Items, item)
		lastItems[len(lastItems)-1] = item
	}
	return listTreeToNode(root)
}

func listTreeToNode(tree *listTree) Node {
	node := tree.Node
	for _, item := range tree.Items {
		itemNode := item.Node
		if item.Children != nil {
			itemNode.Content = append(itemNode.Content, listTreeToNode(item.Children))
		}
		node.Content = append(node.Content, itemNode)
	}
	return node
}

// flattenBody 解包内容控件，展平成有序的段落与表格序列。
func flattenBody(nodes []officecli.Node, out *[]officecli.Node) {
	for _, node := range nodes {
		switch node.Type {
		case "paragraph", "table":
			*out = append(*out, node)
		case "sdt":
			flattenBody(node.Children, out)
		}
	}
}

func (c *converter) convertParagraph(node officecli.Node) paragraphResult {
	styleName := strings.ToLower(strings.TrimSpace(firstNonEmpty(node.String("styleName"), node.Style)))
	inline, images := c.inlineContent(node)

	if level, ok := headingLevel(styleName); ok {
		return paragraphResult{
			block:  &Node{Type: NodeHeading, Attrs: map[string]any{"level": level}, Content: inline},
			images: images,
		}
	}

	if numID := strings.TrimSpace(node.String("numId")); numID != "" {
		level, _ := node.Float("numLevel")
		item := Node{Type: NodeListItem, Content: []Node{{Type: NodeParagraph, Content: inline}}}
		return paragraphResult{list: &listMarker{numID: numID, level: int(level)}, item: item, images: images}
	}

	// 纯图片段落不产出空段落，只产出图片块；图片被跳过时整段丢弃，避免留下空行。
	if len(inline) == 0 && hasPicture(node) {
		return paragraphResult{images: images}
	}
	return paragraphResult{
		block: &Node{
			Type:    NodeParagraph,
			Attrs:   paragraphAttrs(node, textFromInline(inline)),
			Content: inline,
		},
		images: images,
	}
}

// inlineContent 提取段落内的文本 run 与行内图片。
func (c *converter) inlineContent(node officecli.Node) ([]Node, []Node) {
	runs := make([]officecli.Node, 0, len(node.Children))
	collectRuns(node.Children, &runs)

	inline := make([]Node, 0, len(runs))
	images := make([]Node, 0)
	for _, run := range runs {
		switch run.Type {
		case "picture":
			if image, ok := c.convertPicture(run, node); ok {
				images = append(images, image)
			}
		default:
			if run.Text == "" {
				continue
			}
			text := Node{Type: NodeText, Text: run.Text}
			if marks := marksFromFormat(run.Format); len(marks) > 0 {
				text.Marks = marks
			}
			inline = append(inline, text)
		}
	}

	if len(inline) == 0 && len(images) == 0 && strings.TrimSpace(node.Text) != "" {
		inline = append(inline, Node{Type: NodeText, Text: node.Text})
	}
	return inline, images
}

func hasPicture(node officecli.Node) bool {
	children := make([]officecli.Node, 0, len(node.Children))
	collectRuns(node.Children, &children)
	for _, child := range children {
		if child.Type == "picture" {
			return true
		}
	}
	return false
}

func collectRuns(nodes []officecli.Node, out *[]officecli.Node) {
	for _, node := range nodes {
		switch node.Type {
		case "run", "picture":
			*out = append(*out, node)
		case "sdt", "hyperlink":
			collectRuns(node.Children, out)
		}
	}
}

func (c *converter) convertPicture(node officecli.Node, paragraph officecli.Node) (Node, bool) {
	relID := strings.TrimSpace(node.String("relId"))
	if relID == "" {
		c.skipped = append(c.skipped, SkippedMedia{RelID: "", Reason: "图片缺少 relId"})
		return Node{}, false
	}
	assetID := ""
	if c.options.AssetIDForRelID != nil {
		assetID = c.options.AssetIDForRelID(relID)
	}
	if assetID == "" {
		c.skipped = append(c.skipped, SkippedMedia{RelID: relID, Reason: "图片资源未落库"})
		return Node{}, false
	}

	attrs := map[string]any{"assetId": assetID}
	if width := strings.TrimSpace(node.String("width")); width != "" {
		attrs["width"] = width
	}
	if height := strings.TrimSpace(node.String("height")); height != "" {
		attrs["height"] = height
	}
	if align := normalizeTextAlign(paragraph.String("align")); align == "left" || align == "right" || align == "center" {
		attrs["align"] = align
	}
	return Node{Type: NodeAssetImage, Attrs: attrs}, true
}

func (c *converter) convertTable(node officecli.Node) (Node, bool) {
	tableAlign := normalizeTableAlign(node.String("align"))
	if tableAlign == "" {
		tableAlign = "center"
	}
	table := Node{Type: NodeTable, Attrs: map[string]any{"align": tableAlign}}

	headerRow := c.options.HeaderRow
	if firstRow, ok := node.Format["firstRow"].(bool); ok {
		headerRow = firstRow
	}

	anchors := map[int]rowCellAnchor{}
	rowIndex := 0
	for _, row := range node.Children {
		if row.Type != "row" {
			continue
		}
		rowNode := Node{Type: NodeTableRow}
		logicalCol := 0
		updated := map[rowCellAnchor]bool{}
		for _, cell := range row.Children {
			if cell.Type != "cell" {
				continue
			}
			colspan := 1
			if span, ok := cell.Float("colspan"); ok && int(span) > 1 {
				colspan = int(span)
			}
			vmerge := strings.ToLower(strings.TrimSpace(cell.String("vmerge")))
			if vmerge == "continue" {
				for col := logicalCol; col < logicalCol+colspan; col++ {
					if anchor, ok := anchors[col]; ok && !updated[anchor] {
						setRowSpan(&table.Content[anchor.row].Content[anchor.cell], currentRowSpan(table.Content, anchor)+1)
						updated[anchor] = true
					}
				}
				logicalCol += colspan
				continue
			}

			cellType := NodeTableCell
			if headerRow && rowIndex == 0 {
				cellType = NodeTableHeader
			}
			cellNode := Node{Type: cellType, Attrs: tableCellAttrs(cell, cellType, colspan)}
			for _, child := range cell.Children {
				if child.Type != "paragraph" {
					continue
				}
				inline, _ := c.inlineContent(child)
				cellNode.Content = append(cellNode.Content, Node{Type: NodeParagraph, Content: inline})
			}
			if len(cellNode.Content) == 0 {
				cellNode.Content = []Node{{Type: NodeParagraph}}
			}
			cellIndex := len(rowNode.Content)
			rowNode.Content = append(rowNode.Content, cellNode)

			for col := logicalCol; col < logicalCol+colspan; col++ {
				if vmerge == "restart" {
					anchors[col] = rowCellAnchor{row: rowIndex, cell: cellIndex}
				} else {
					delete(anchors, col)
				}
			}
			logicalCol += colspan
		}
		if len(rowNode.Content) == 0 {
			continue
		}
		table.Content = append(table.Content, rowNode)
		rowIndex++
	}
	if len(table.Content) == 0 {
		return Node{}, false
	}
	return table, true
}

func tableCellAttrs(cell officecli.Node, cellType string, colspan int) map[string]any {
	attrs := map[string]any{}
	if cellType == NodeTableHeader {
		attrs["align"] = "center"
		attrs["valign"] = "center"
	} else {
		if align := normalizeTextAlign(cell.String("align")); align != "" {
			attrs["align"] = align
		} else {
			attrs["align"] = "left"
		}
		if valign := strings.ToLower(strings.TrimSpace(cell.String("valign"))); allowedValign[valign] {
			attrs["valign"] = valign
		} else {
			attrs["valign"] = "center"
		}
	}
	if colspan > 1 {
		attrs["colspan"] = colspan
	}
	return attrs
}

func currentRowSpan(rows []Node, anchor rowCellAnchor) int {
	if anchor.row < 0 || anchor.row >= len(rows) || anchor.cell < 0 || anchor.cell >= len(rows[anchor.row].Content) {
		return 1
	}
	span, ok := intAttr(rows[anchor.row].Content[anchor.cell].Attrs, "rowspan")
	if !ok || span < 1 {
		return 1
	}
	return span
}

func setRowSpan(cell *Node, span int) {
	if span <= 1 {
		return
	}
	if cell.Attrs == nil {
		cell.Attrs = map[string]any{}
	}
	cell.Attrs["rowspan"] = span
}

// headingLevel 从 "heading 2" 之类的样式名推导标题层级，并收敛到 2–4。
func headingLevel(styleName string) (int, bool) {
	if !strings.HasPrefix(styleName, "heading") {
		return 0, false
	}
	raw := strings.TrimSpace(strings.TrimPrefix(styleName, "heading"))
	if raw == "" {
		return MinHeadingLevel, true
	}
	level, err := strconv.Atoi(raw)
	if err != nil {
		return 0, false
	}
	if level < MinHeadingLevel {
		level = MinHeadingLevel
	}
	if level > MaxHeadingLevel {
		level = MaxHeadingLevel
	}
	return level, true
}

func paragraphAttrs(node officecli.Node, text string) map[string]any {
	attrs := map[string]any{}
	if tableCaptionPattern.MatchString(strings.TrimSpace(text)) {
		attrs["variant"] = "tableCaption"
		attrs["align"] = "center"
		return attrs
	}
	align := normalizeTextAlign(node.String("align"))
	if align != "" {
		attrs["align"] = align
	}
	if align != "center" && align != "right" && paragraphHasTwoCharFirstLineIndent(node) {
		attrs["firstLineIndent"] = 2
	}
	if len(attrs) == 0 {
		return nil
	}
	return attrs
}

func paragraphHasTwoCharFirstLineIndent(node officecli.Node) bool {
	if chars, ok := node.Float("firstLineChars"); ok && chars >= 200 {
		return true
	}
	indent := parsePoints(node.String("firstLineIndent"))
	if indent <= 0 {
		return false
	}
	if font := effectiveFontSizePoints(node); font > 0 && indent/font >= 1.5 {
		return true
	}
	return indent >= 18
}

func effectiveFontSizePoints(node officecli.Node) float64 {
	for _, key := range []string{"effective.size", "size", "markRPr.size"} {
		if points := parsePoints(node.String(key)); points > 0 {
			return points
		}
	}
	return 0
}

func parsePoints(raw string) float64 {
	raw = strings.ToLower(strings.TrimSpace(raw))
	if raw == "" {
		return 0
	}
	re := regexp.MustCompile(`^([0-9]+(?:\.[0-9]+)?)\s*(pt|px|cm|mm|in)?$`)
	match := re.FindStringSubmatch(raw)
	if len(match) != 3 {
		return 0
	}
	value, err := strconv.ParseFloat(match[1], 64)
	if err != nil {
		return 0
	}
	switch match[2] {
	case "px":
		return value * 72 / 96
	case "cm":
		return value * 72 / 2.54
	case "mm":
		return value * 72 / 25.4
	case "in":
		return value * 72
	default:
		return value
	}
}

func normalizeTextAlign(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "start":
		return "left"
	case "end":
		return "right"
	case "both", "distribute":
		return "justify"
	case "left", "center", "right", "justify":
		return strings.ToLower(strings.TrimSpace(raw))
	default:
		return ""
	}
}

func normalizeTableAlign(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "left", "center", "right":
		return strings.ToLower(strings.TrimSpace(raw))
	default:
		return ""
	}
}

func textFromInline(inline []Node) string {
	var b strings.Builder
	for _, node := range inline {
		if node.Type == NodeText {
			b.WriteString(node.Text)
		}
	}
	return b.String()
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func marksFromFormat(format map[string]any) []Mark {
	if flag, ok := format["bold"].(bool); ok && flag {
		return []Mark{{Type: MarkBold}}
	}
	return nil
}
