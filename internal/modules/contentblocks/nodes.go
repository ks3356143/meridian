package contentblocks

import (
	"encoding/json"
	"fmt"
	"strings"
)

// 受限节点白名单。存储层一律使用这里的节点名，模块内的语义化叫法不得落库。
const (
	NodeDoc         = "doc"
	NodeParagraph   = "paragraph"
	NodeText        = "text"
	NodeHeading     = "heading"
	NodeBulletList  = "bulletList" // 仅用于历史数据兼容读取，SanitizeDocument 会转换为 orderedList。
	NodeOrderedList = "orderedList"
	NodeListItem    = "listItem"
	NodeTable       = "table"
	NodeTableRow    = "tableRow"
	NodeTableHeader = "tableHeader"
	NodeTableCell   = "tableCell"
	NodeAssetImage  = "assetImage"
	NodePageBreak   = "pagebreak" // 仅用于历史数据兼容读取，保存时清洗。
)

// 行内标记白名单。需求正文只保留粗体。
const (
	MarkBold      = "bold"
	MarkItalic    = "italic"
	MarkUnderline = "underline"
)

// 标题层级限制（对应 Word Heading 2–4）。
const (
	MinHeadingLevel = 2
	MaxHeadingLevel = 4
)

// 有序列表形态，取自模板 numbering.xml。
const (
	ListStyleOrderedParen = "ordered-paren"
	ListStyleLetterParen  = "letter-paren"
	DefaultListStyle      = ListStyleOrderedParen
)

// 空正文的规范 JSON。
const EmptyDocumentJSON = `{"type":"doc","content":[]}`

// Mark 是行内标记。
type Mark struct {
	Type  string         `json:"type"`
	Attrs map[string]any `json:"attrs,omitempty"`
}

// Node 是受限内容块节点；根节点必须是 doc。
type Node struct {
	Type    string         `json:"type"`
	Attrs   map[string]any `json:"attrs,omitempty"`
	Content []Node         `json:"content,omitempty"`
	Text    string         `json:"text,omitempty"`
	Marks   []Mark         `json:"marks,omitempty"`
}

// ValidationError 描述校验失败的位置与原因。
type ValidationError struct {
	Path string
	Msg  string
}

func (e *ValidationError) Error() string {
	if e.Path == "" {
		return "内容块校验失败：" + e.Msg
	}
	return fmt.Sprintf("内容块校验失败：%s %s", e.Path, e.Msg)
}

// allowedChildren 定义每个节点允许的直接子节点。
var allowedChildren = map[string]map[string]bool{
	NodeDoc: {
		NodeParagraph:   true,
		NodeHeading:     true,
		NodeOrderedList: true,
		NodeTable:       true,
		NodeAssetImage:  true,
	},
	NodeParagraph:   {NodeText: true},
	NodeHeading:     {NodeText: true},
	NodeOrderedList: {NodeListItem: true},
	NodeListItem:    {NodeParagraph: true, NodeOrderedList: true},
	NodeTable:       {NodeTableRow: true},
	NodeTableRow:    {NodeTableHeader: true, NodeTableCell: true},
	NodeTableHeader: {NodeParagraph: true},
	NodeTableCell:   {NodeParagraph: true},
	NodeText:        {},
	NodeAssetImage:  {},
}

// minChildren 定义必须至少包含一个子节点的节点。
var minChildren = map[string]int{
	NodeOrderedList: 1,
	NodeListItem:    1,
	NodeTable:       1,
	NodeTableRow:    1,
}

var allowedMarks = map[string]bool{MarkBold: true}

var allowedAlign = map[string]bool{
	"inherit": true, "left": true, "center": true, "right": true,
	"justify": true, "both": true, "distribute": true,
}

var allowedTableAlign = map[string]bool{"left": true, "center": true, "right": true}
var allowedValign = map[string]bool{"top": true, "center": true, "bottom": true}

var allowedAttrs = map[string]map[string]bool{
	NodeParagraph:   {"align": true, "firstLineIndent": true, "variant": true},
	NodeHeading:     {"level": true, "align": true},
	NodeOrderedList: {"style": true, "start": true},
	NodeTable:       {"align": true},
	NodeTableHeader: {"align": true, "valign": true, "colspan": true, "rowspan": true, "colwidth": true},
	NodeTableCell:   {"align": true, "valign": true, "colspan": true, "rowspan": true, "colwidth": true},
	NodeAssetImage:  {"assetId": true, "width": true, "height": true, "alt": true, "align": true},
}

// ParseDocument 解析正文 JSON，先清洗历史格式，再按当前白名单校验。
func ParseDocument(data []byte) (Node, error) {
	if len(strings.TrimSpace(string(data))) == 0 {
		data = []byte(EmptyDocumentJSON)
	}
	var root Node
	if err := json.Unmarshal(data, &root); err != nil {
		return Node{}, fmt.Errorf("解析内容块 JSON 失败: %w", err)
	}
	root = SanitizeDocument(root)
	if err := ValidateDocument(root); err != nil {
		return Node{}, err
	}
	return root, nil
}

// MarshalDocument 序列化正文节点。
func MarshalDocument(root Node) (string, error) {
	data, err := json.Marshal(root)
	if err != nil {
		return "", fmt.Errorf("序列化内容块失败: %w", err)
	}
	return string(data), nil
}

// ValidateDocument 校验整棵文档树是否符合受限节点白名单。
func ValidateDocument(root Node) error {
	if root.Type != NodeDoc {
		return &ValidationError{Msg: fmt.Sprintf("根节点必须是 %s，当前为 %q", NodeDoc, root.Type)}
	}
	return validateNode(root, root.Type)
}

func validateNode(n Node, path string) error {
	children, known := allowedChildren[n.Type]
	if !known {
		return &ValidationError{Path: path, Msg: fmt.Sprintf("节点类型 %q 未登记", n.Type)}
	}
	if err := validateAttributes(n, path); err != nil {
		return err
	}
	if n.Type == NodeText && n.Text == "" {
		return &ValidationError{Path: path, Msg: "text 节点缺少文本"}
	}
	if min, ok := minChildren[n.Type]; ok && len(n.Content) < min {
		return &ValidationError{Path: path, Msg: "节点缺少必需的子节点"}
	}
	for index, child := range n.Content {
		childPath := fmt.Sprintf("%s.content[%d]", path, index)
		if !children[child.Type] {
			return &ValidationError{
				Path: childPath,
				Msg:  fmt.Sprintf("节点 %q 不允许出现在 %q 下", child.Type, n.Type),
			}
		}
		if err := validateNode(child, childPath); err != nil {
			return err
		}
	}
	return nil
}

func validateAttributes(n Node, path string) error {
	switch n.Type {
	case NodeParagraph:
		if align, ok := stringAttr(n.Attrs, "align"); ok && !allowedAlign[align] {
			return &ValidationError{Path: path, Msg: fmt.Sprintf("对齐值 %q 不受支持", align)}
		}
		if indent, ok := intAttr(n.Attrs, "firstLineIndent"); ok && indent != 0 && indent != 2 {
			return &ValidationError{Path: path, Msg: "段落首行缩进只支持 0 或 2 字符"}
		}
		if variant, ok := stringAttr(n.Attrs, "variant"); ok && variant != "" && variant != "tableCaption" {
			return &ValidationError{Path: path, Msg: fmt.Sprintf("段落语义 %q 不受支持", variant)}
		}
	case NodeHeading:
		level, ok := intAttr(n.Attrs, "level")
		if !ok {
			return &ValidationError{Path: path, Msg: "heading 缺少 level"}
		}
		if level < MinHeadingLevel || level > MaxHeadingLevel {
			return &ValidationError{
				Path: path,
				Msg:  fmt.Sprintf("heading level 必须在 %d–%d 之间", MinHeadingLevel, MaxHeadingLevel),
			}
		}
		if align, ok := stringAttr(n.Attrs, "align"); ok && !allowedAlign[align] {
			return &ValidationError{Path: path, Msg: fmt.Sprintf("对齐值 %q 不受支持", align)}
		}
	case NodeOrderedList:
		if style, ok := stringAttr(n.Attrs, "style"); ok && style != ListStyleOrderedParen && style != ListStyleLetterParen {
			return &ValidationError{Path: path, Msg: fmt.Sprintf("列表形态 %q 不受支持", style)}
		}
		if start, ok := intAttr(n.Attrs, "start"); ok && start < 1 {
			return &ValidationError{Path: path, Msg: "列表起始编号必须大于等于 1"}
		}
	case NodeTable:
		if align, ok := stringAttr(n.Attrs, "align"); ok && !allowedTableAlign[align] {
			return &ValidationError{Path: path, Msg: fmt.Sprintf("表格对齐值 %q 不受支持", align)}
		}
	case NodeTableHeader, NodeTableCell:
		if align, ok := stringAttr(n.Attrs, "align"); ok && !allowedAlign[align] {
			return &ValidationError{Path: path, Msg: fmt.Sprintf("对齐值 %q 不受支持", align)}
		}
		if valign, ok := stringAttr(n.Attrs, "valign"); ok && !allowedValign[valign] {
			return &ValidationError{Path: path, Msg: fmt.Sprintf("垂直对齐值 %q 不受支持", valign)}
		}
		if span, ok := intAttr(n.Attrs, "colspan"); ok && span < 1 {
			return &ValidationError{Path: path, Msg: "colspan 必须大于等于 1"}
		}
		if span, ok := intAttr(n.Attrs, "rowspan"); ok && span < 1 {
			return &ValidationError{Path: path, Msg: "rowspan 必须大于等于 1"}
		}
	case NodeAssetImage:
		if assetID, _ := stringAttr(n.Attrs, "assetId"); strings.TrimSpace(assetID) == "" {
			return &ValidationError{Path: path, Msg: "assetImage 缺少 assetId"}
		}
		if align, ok := stringAttr(n.Attrs, "align"); ok && !allowedAlign[align] {
			return &ValidationError{Path: path, Msg: fmt.Sprintf("对齐值 %q 不受支持", align)}
		}
	}
	for _, mark := range n.Marks {
		if n.Type != NodeText {
			return &ValidationError{Path: path, Msg: "只有 text 节点可以带行内标记"}
		}
		if !allowedMarks[mark.Type] {
			return &ValidationError{Path: path, Msg: fmt.Sprintf("行内标记 %q 未登记", mark.Type)}
		}
	}
	return nil
}

// PlainText 提取用于完善度统计与搜索的纯文本。
func PlainText(root Node) string {
	return strings.TrimSpace(plainTextOf(root))
}

// HasContent 判断正文是否包含可展示内容；图片和表格结构也算内容，不能只看纯文本。
func HasContent(root Node) bool {
	if strings.TrimSpace(PlainText(root)) != "" {
		return true
	}
	return hasStructuredContent(root)
}

func hasStructuredContent(n Node) bool {
	if n.Type == NodeAssetImage || n.Type == NodeTable {
		return true
	}
	for _, child := range n.Content {
		if hasStructuredContent(child) {
			return true
		}
	}
	return false
}

func plainTextOf(n Node) string {
	switch n.Type {
	case NodeText:
		return n.Text
	case NodeParagraph, NodeHeading:
		return joinInline(n) + "\n"
	case NodeTableHeader, NodeTableCell:
		return joinInline(n)
	case NodeTableRow:
		cells := make([]string, 0, len(n.Content))
		for _, cell := range n.Content {
			cells = append(cells, strings.TrimSpace(plainTextOf(cell)))
		}
		return strings.Join(cells, "\t") + "\n"
	case NodeListItem:
		return joinInline(n)
	default:
		return joinInline(n)
	}
}

func joinInline(n Node) string {
	var b strings.Builder
	for _, child := range n.Content {
		b.WriteString(plainTextOf(child))
	}
	return b.String()
}

func stringAttr(attrs map[string]any, key string) (string, bool) {
	if attrs == nil {
		return "", false
	}
	if value, ok := attrs[key].(string); ok {
		return value, true
	}
	return "", false
}

func intAttr(attrs map[string]any, key string) (int, bool) {
	if attrs == nil {
		return 0, false
	}
	switch value := attrs[key].(type) {
	case float64:
		return int(value), true
	case int:
		return value, true
	case json.Number:
		parsed, err := value.Int64()
		if err != nil {
			return 0, false
		}
		return int(parsed), true
	}
	return 0, false
}

// SanitizeDocument 清洗历史数据和 Tiptap 输出中的非保留格式，保证保存结果符合当前契约。
func SanitizeDocument(root Node) Node {
	root.Content = sanitizeNodes(root.Content)
	return root
}

func sanitizeNodes(nodes []Node) []Node {
	if len(nodes) == 0 {
		return nil
	}
	result := make([]Node, 0, len(nodes))
	for _, node := range nodes {
		if node.Type == NodePageBreak {
			continue
		}
		if node.Type == NodeBulletList {
			node.Type = NodeOrderedList
			if node.Attrs == nil {
				node.Attrs = map[string]any{}
			}
			if _, ok := stringAttr(node.Attrs, "style"); !ok {
				node.Attrs["style"] = DefaultListStyle
			}
		}
		node.Attrs = sanitizeAttrs(node.Type, node.Attrs)
		node.Content = sanitizeNodes(node.Content)
		if node.Type == NodeText {
			marks := make([]Mark, 0, len(node.Marks))
			for _, mark := range node.Marks {
				if mark.Type == MarkBold {
					marks = append(marks, mark)
				}
			}
			node.Marks = marks
		}
		if node.Type == NodeParagraph {
			normalizeParagraphAttrs(node.Attrs)
		}
		if node.Type == NodeOrderedList {
			if node.Attrs == nil {
				node.Attrs = map[string]any{"style": DefaultListStyle}
			}
		}
		result = append(result, node)
	}
	return result
}

func sanitizeAttrs(nodeType string, attrs map[string]any) map[string]any {
	if len(attrs) == 0 {
		return nil
	}
	allowed := allowedAttrs[nodeType]
	if len(allowed) == 0 {
		return nil
	}
	out := make(map[string]any, len(attrs))
	for key, value := range attrs {
		if !allowed[key] || isZeroAttr(key, value) {
			continue
		}
		switch key {
		case "align":
			normalized := normalizeAlign(value)
			if normalized == "" || normalized == "inherit" {
				continue
			}
			out[key] = normalized
		case "variant":
			if value == "tableCaption" {
				out[key] = value
			}
		case "width", "height":
			if text, ok := stringifyValue(value); ok && strings.TrimSpace(text) != "" {
				out[key] = text
			}
		case "colwidth":
			if widths, ok := sanitizeColumnWidths(value); ok {
				out[key] = widths
			}
		case "colspan", "rowspan", "start", "firstLineIndent", "level":
			if number, ok := intValue(value); ok {
				out[key] = number
			}
		default:
			out[key] = value
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func normalizeParagraphAttrs(attrs map[string]any) {
	if attrs == nil {
		return
	}
	if variant, ok := stringAttr(attrs, "variant"); !ok || variant != "tableCaption" {
		delete(attrs, "variant")
	}
	if indent, ok := intAttr(attrs, "firstLineIndent"); !ok || indent != 2 {
		delete(attrs, "firstLineIndent")
	}
	if align, ok := stringAttr(attrs, "align"); ok && (align == "center" || align == "right") {
		delete(attrs, "firstLineIndent")
	}
	if variant, ok := stringAttr(attrs, "variant"); ok && variant == "tableCaption" {
		attrs["align"] = "center"
		delete(attrs, "firstLineIndent")
	}
	if len(attrs) == 0 {
		return
	}
}

func isZeroAttr(key string, value any) bool {
	if value == nil {
		return true
	}
	if text, ok := value.(string); ok && strings.TrimSpace(text) == "" {
		return true
	}
	if number, ok := intValue(value); ok {
		switch key {
		case "firstLineIndent", "colspan", "rowspan", "start":
			return number == 0 || number == 1 && key != "firstLineIndent"
		}
	}
	return false
}

func normalizeAlign(value any) string {
	text, ok := value.(string)
	if !ok {
		return ""
	}
	switch strings.ToLower(strings.TrimSpace(text)) {
	case "start":
		return "left"
	case "end":
		return "right"
	case "both", "distribute":
		return "justify"
	case "inherit":
		return ""
	case "left", "center", "right", "justify":
		return strings.ToLower(strings.TrimSpace(text))
	default:
		return ""
	}
}

func intValue(value any) (int, bool) {
	switch typed := value.(type) {
	case float64:
		return int(typed), true
	case float32:
		return int(typed), true
	case int:
		return typed, true
	case int64:
		return int(typed), true
	case json.Number:
		parsed, err := typed.Int64()
		if err != nil {
			return 0, false
		}
		return int(parsed), true
	default:
		return 0, false
	}
}

func stringifyValue(value any) (string, bool) {
	switch typed := value.(type) {
	case string:
		return typed, true
	case float64:
		return fmt.Sprintf("%.0f", typed), true
	case int:
		return fmt.Sprintf("%d", typed), true
	default:
		return "", false
	}
}

func sanitizeColumnWidths(value any) ([]int, bool) {
	items, ok := value.([]any)
	if !ok {
		if typed, ok := value.([]int); ok {
			return typed, true
		}
		return nil, false
	}
	widths := make([]int, 0, len(items))
	for _, item := range items {
		number, ok := intValue(item)
		if !ok || number <= 0 {
			continue
		}
		widths = append(widths, number)
	}
	if len(widths) == 0 {
		return nil, false
	}
	return widths, true
}
