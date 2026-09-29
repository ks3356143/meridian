package contentblocks

import (
	"strconv"
	"strings"

	"chenmeridian/internal/modules/officecli"
)

// ImportOptions 控制 DOCX 正文到受限内容块的转换。
type ImportOptions struct {
	// AssetIDForRelID 把文档内 relId 映射成已落库的资源 id；返回空字符串表示跳过该图片。
	AssetIDForRelID func(relID string) string
	// HeaderRow 为真时把表格首行转成 tableHeader。
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

	var pending *listGroup
	for _, node := range flat {
		switch node.Type {
		case "table":
			converter.flushList(&pending)
			if table, ok := converter.convertTable(node); ok {
				converter.blocks = append(converter.blocks, table)
			}
		default:
			converted := converter.convertParagraph(node)
			if converted.list != nil {
				if pending != nil && pending.kind == *converted.list {
					pending.items = append(pending.items, converted.item)
				} else {
					converter.flushList(&pending)
					pending = &listGroup{kind: *converted.list, items: []Node{converted.item}}
				}
			} else {
				converter.flushList(&pending)
			}
			if converted.block != nil {
				converter.blocks = append(converter.blocks, *converted.block)
			}
			converter.blocks = append(converter.blocks, converted.images...)
		}
	}
	converter.flushList(&pending)

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

type listKind struct {
	ordered bool
	style   string
}

type listGroup struct {
	kind  listKind
	items []Node
}

type paragraphResult struct {
	block  *Node
	images []Node
	list   *listKind
	item   Node
}

func (c *converter) flushList(group **listGroup) {
	if group == nil || *group == nil {
		return
	}
	current := *group
	nodeType := NodeBulletList
	attrs := map[string]any(nil)
	if current.kind.ordered {
		nodeType = NodeOrderedList
		attrs = map[string]any{"style": current.kind.style}
	}
	c.blocks = append(c.blocks, Node{Type: nodeType, Attrs: attrs, Content: current.items})
	*group = nil
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
		kind := listKindFor(node)
		item := Node{Type: NodeListItem, Content: []Node{{Type: NodeParagraph, Content: inline}}}
		return paragraphResult{list: &kind, item: item, images: images}
	}

	// 纯图片段落不产出空段落，只产出图片块；图片被跳过时整段丢弃，避免留下空行。
	if len(inline) == 0 && hasPicture(node) {
		return paragraphResult{images: images}
	}
	return paragraphResult{
		block:  &Node{Type: NodeParagraph, Content: inline},
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
	if align := strings.TrimSpace(paragraph.String("align")); align == "left" || align == "right" {
		attrs["sourceAlign"] = align
	}
	return Node{Type: NodeAssetImage, Attrs: attrs}, true
}

func (c *converter) convertTable(node officecli.Node) (Node, bool) {
	table := Node{Type: NodeTable, Attrs: map[string]any{"align": "center"}}
	rowIndex := 0
	for _, row := range node.Children {
		if row.Type != "row" {
			continue
		}
		rowNode := Node{Type: NodeTableRow}
		isHeader := c.options.HeaderRow && rowIndex == 0
		for _, cell := range row.Children {
			if cell.Type != "cell" {
				continue
			}
			cellType := NodeTableCell
			if isHeader {
				cellType = NodeTableHeader
			}
			cellNode := Node{Type: cellType}
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
			rowNode.Content = append(rowNode.Content, cellNode)
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

func listKindFor(node officecli.Node) listKind {
	listStyle := strings.ToLower(strings.TrimSpace(node.String("listStyle")))
	numFmt := strings.ToLower(strings.TrimSpace(node.String("numFmt")))
	if listStyle == "bullet" || numFmt == "bullet" {
		return listKind{ordered: false}
	}
	style := ListStyleOrderedParen
	if numFmt == "lowerletter" || numFmt == "upperletter" || numFmt == "lowerroman" || numFmt == "upperroman" {
		style = ListStyleLetterParen
	}
	return listKind{ordered: true, style: style}
}

func marksFromFormat(format map[string]any) []Mark {
	marks := make([]Mark, 0, 3)
	if flag, ok := format["bold"].(bool); ok && flag {
		marks = append(marks, Mark{Type: MarkBold})
	}
	if flag, ok := format["italic"].(bool); ok && flag {
		marks = append(marks, Mark{Type: MarkItalic})
	}
	if style, ok := format["underline"].(string); ok && style != "" && style != "none" {
		marks = append(marks, Mark{Type: MarkUnderline})
	}
	return marks
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}