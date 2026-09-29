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
	NodeBulletList  = "bulletList"
	NodeOrderedList = "orderedList"
	NodeListItem    = "listItem"
	NodeTable       = "table"
	NodeTableRow    = "tableRow"
	NodeTableHeader = "tableHeader"
	NodeTableCell   = "tableCell"
	NodeAssetImage  = "assetImage"
	NodePageBreak   = "pagebreak"
)

// 行内标记白名单。
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
		NodeBulletList:  true,
		NodeOrderedList: true,
		NodeTable:       true,
		NodeAssetImage:  true,
		NodePageBreak:   true,
	},
	NodeParagraph:   {NodeText: true},
	NodeHeading:     {NodeText: true},
	NodeBulletList:  {NodeListItem: true},
	NodeOrderedList: {NodeListItem: true},
	NodeListItem:    {NodeParagraph: true},
	NodeTable:       {NodeTableRow: true},
	NodeTableRow:    {NodeTableHeader: true, NodeTableCell: true},
	NodeTableHeader: {NodeParagraph: true},
	NodeTableCell:   {NodeParagraph: true},
	NodeText:        {},
	NodeAssetImage:  {},
	NodePageBreak:   {},
}

// minChildren 定义必须至少包含一个子节点的节点。
var minChildren = map[string]int{
	NodeBulletList:  1,
	NodeOrderedList: 1,
	NodeListItem:    1,
	NodeTable:       1,
	NodeTableRow:    1,
}

var allowedMarks = map[string]bool{
	MarkBold:      true,
	MarkItalic:    true,
	MarkUnderline: true,
}

var allowedAlign = map[string]bool{
	"inherit": true, "left": true, "center": true, "right": true,
	"justify": true, "both": true, "distribute": true,
}

var allowedValign = map[string]bool{"top": true, "center": true, "bottom": true}

// ParseDocument 解析正文 JSON，并校验根节点类型。
func ParseDocument(data []byte) (Node, error) {
	if len(strings.TrimSpace(string(data))) == 0 {
		data = []byte(EmptyDocumentJSON)
	}
	var root Node
	if err := json.Unmarshal(data, &root); err != nil {
		return Node{}, fmt.Errorf("解析内容块 JSON 失败: %w", err)
	}
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
	case NodeOrderedList:
		if style, ok := stringAttr(n.Attrs, "style"); ok && style != ListStyleOrderedParen && style != ListStyleLetterParen {
			return &ValidationError{Path: path, Msg: fmt.Sprintf("列表形态 %q 不受支持", style)}
		}
	case NodeAssetImage:
		if assetID, _ := stringAttr(n.Attrs, "assetId"); strings.TrimSpace(assetID) == "" {
			return &ValidationError{Path: path, Msg: "assetImage 缺少 assetId"}
		}
		if align, ok := stringAttr(n.Attrs, "align"); ok && !allowedAlign[align] {
			return &ValidationError{Path: path, Msg: fmt.Sprintf("对齐值 %q 不受支持", align)}
		}
	case NodeTable, NodeTableHeader, NodeTableCell:
		if align, ok := stringAttr(n.Attrs, "align"); ok && !allowedAlign[align] {
			return &ValidationError{Path: path, Msg: fmt.Sprintf("对齐值 %q 不受支持", align)}
		}
	}
	if n.Type == NodeTableHeader || n.Type == NodeTableCell {
		if valign, ok := stringAttr(n.Attrs, "valign"); ok && !allowedValign[valign] {
			return &ValidationError{Path: path, Msg: fmt.Sprintf("垂直对齐值 %q 不受支持", valign)}
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
	case NodePageBreak:
		return "\n"
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