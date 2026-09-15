package requirements

import (
	"archive/zip"
	"encoding/xml"
	"fmt"
	"io"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

type ParsedNode struct {
	ChapterNumber string
	Title         string
	Description   string
	ParentChapter string
	SourceAnchor  string
	PrimaryKind   string
	IsRequirement bool
}

type docxParagraph struct {
	text     string
	style    string
	hasImage bool
	position int
}

var chapterPattern = regexp.MustCompile(`^(\d+(?:\.\d+)*)(?:[、.．:：\s]\s*(.+))?$`)

func ParseDOCX(path string) ([]ParsedNode, error) {
	reader, err := zip.OpenReader(path)
	if err != nil {
		return nil, fmt.Errorf("打开 DOCX 文件失败: %w", err)
	}
	defer reader.Close()

	var document *zip.File
	for _, file := range reader.File {
		if file.Name == "word/document.xml" {
			document = file
			break
		}
	}
	if document == nil {
		return nil, fmt.Errorf("DOCX 中缺少 word/document.xml")
	}

	file, err := document.Open()
	if err != nil {
		return nil, fmt.Errorf("读取 DOCX 内容失败: %w", err)
	}
	defer file.Close()

	paragraphs, err := readParagraphs(file)
	if err != nil {
		return nil, err
	}
	return buildParsedNodes(paragraphs), nil
}

func readParagraphs(reader io.Reader) ([]docxParagraph, error) {
	decoder := xml.NewDecoder(reader)
	paragraphs := make([]docxParagraph, 0)
	var current *docxParagraph
	inText := false

	for {
		token, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("解析 DOCX XML 失败: %w", err)
		}

		switch element := token.(type) {
		case xml.StartElement:
			switch element.Name.Local {
			case "p":
				current = &docxParagraph{position: len(paragraphs) + 1}
			case "pStyle":
				if current != nil {
					for _, attribute := range element.Attr {
						if attribute.Name.Local == "val" {
							current.style = strings.ToLower(attribute.Value)
						}
					}
				}
			case "t":
				if current != nil {
					inText = true
				}
			case "drawing":
				if current != nil {
					current.hasImage = true
				}
			case "tab":
				if current != nil {
					current.text += " "
				}
			}
		case xml.CharData:
			if inText && current != nil {
				current.text += string(element)
			}
		case xml.EndElement:
			switch element.Name.Local {
			case "t":
				inText = false
			case "p":
				if current != nil {
					text := strings.TrimSpace(current.text)
					if current.hasImage {
						text = strings.TrimSpace(text + " [图片]")
					}
					if text != "" {
						current.text = text
						paragraphs = append(paragraphs, *current)
					}
				}
				current = nil
			}
		}
	}
	return paragraphs, nil
}

func buildParsedNodes(paragraphs []docxParagraph) []ParsedNode {
	nodes := make([]ParsedNode, 0)
	chapters := make(map[string]ParsedNode)
	var currentHeading string
	var body []string

	flush := func() {
		if currentHeading == "" {
			return
		}
		node := chapters[currentHeading]
		node.Description = strings.Join(body, "\n")
		node.PrimaryKind = inferPrimaryKind(node.Title + " " + node.Description)
		node.IsRequirement = looksLikeRequirement(node.Description)
		chapters[currentHeading] = node
		body = make([]string, 0)
	}

	for _, paragraph := range paragraphs {
		chapter, title, isHeading := classifyParagraph(paragraph)
		if isHeading {
			flush()
			node := ParsedNode{
				ChapterNumber: chapter,
				Title:         title,
				ParentChapter: parentChapter(chapter),
				SourceAnchor:  fmt.Sprintf("DOCX 段落 %d", paragraph.position),
			}
			chapters[chapter] = node
			currentHeading = chapter
			continue
		}
		if currentHeading != "" {
			body = append(body, paragraph.text)
		}
	}
	flush()

	orderedChapters := make([]string, 0, len(chapters))
	for chapter := range chapters {
		orderedChapters = append(orderedChapters, chapter)
	}
	sort.Slice(orderedChapters, func(i int, j int) bool {
		return compareChapter(orderedChapters[i], orderedChapters[j]) < 0
	})
	for _, chapter := range orderedChapters {
		nodes = append(nodes, chapters[chapter])
	}
	return nodes
}

func classifyParagraph(paragraph docxParagraph) (chapter string, title string, isHeading bool) {
	matches := chapterPattern.FindStringSubmatch(strings.TrimSpace(paragraph.text))
	if matches == nil {
		return "", "", false
	}
	style := paragraph.style
	styleHeading := strings.Contains(style, "heading") ||
		strings.Contains(style, "标题") ||
		strings.Contains(style, "tou")
	textLikelyHeading := len([]rune(matches[2])) <= 80 && !strings.Contains(matches[2], "。")
	if !styleHeading && !textLikelyHeading {
		return "", "", false
	}
	return matches[1], strings.TrimSpace(matches[2]), true
}

func looksLikeRequirement(description string) bool {
	description = strings.TrimSpace(description)
	if description == "" {
		return false
	}
	for _, marker := range []string{"应", "应当", "须", "确保", "能够", "至少", "不低于", "不高于"} {
		if strings.Contains(description, marker) {
			return true
		}
	}
	return false
}

func inferPrimaryKind(text string) string {
	text = strings.ToLower(text)
	switch {
	case strings.Contains(text, "性能") || strings.Contains(text, "时间") ||
		strings.Contains(text, "周期") || strings.Contains(text, "内存") ||
		strings.Contains(text, "吞吐") || strings.Contains(text, "延迟"):
		return KindPerformance
	case strings.Contains(text, "接口") || strings.Contains(text, "通信") ||
		strings.Contains(text, "总线") || strings.Contains(text, "协议"):
		return KindInterface
	case strings.Contains(text, "安全") || strings.Contains(text, "保密") ||
		strings.Contains(text, "权限"):
		return KindSafety
	case strings.Contains(text, "可靠") || strings.Contains(text, "冗余") ||
		strings.Contains(text, "故障") || strings.Contains(text, "恢复"):
		return KindReliability
	default:
		return KindFunctional
	}
}

func parentChapter(chapter string) string {
	index := strings.LastIndex(chapter, ".")
	if index <= 0 {
		return ""
	}
	return chapter[:index]
}

func compareChapter(left string, right string) int {
	leftParts := strings.Split(left, ".")
	rightParts := strings.Split(right, ".")
	for i := 0; i < len(leftParts) && i < len(rightParts); i++ {
		leftNumber := parseChapterNumber(leftParts[i])
		rightNumber := parseChapterNumber(rightParts[i])
		if leftNumber != rightNumber {
			if leftNumber < rightNumber {
				return -1
			}
			return 1
		}
	}
	if len(leftParts) == len(rightParts) {
		return strings.Compare(left, right)
	}
	if len(leftParts) < len(rightParts) {
		return -1
	}
	return 1
}

func parseChapterNumber(value string) int {
	number := 0
	for _, char := range value {
		if char < '0' || char > '9' {
			break
		}
		number = number*10 + int(char-'0')
	}
	return number
}

func hasDocxExtension(path string) bool {
	return strings.EqualFold(filepath.Ext(path), ".docx")
}
