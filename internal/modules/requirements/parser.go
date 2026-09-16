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
	ChapterNumber      string
	Title              string
	Description        string
	ParentChapter      string
	SourceAnchor       string
	PrimaryKind        string
	ExternalIdentifier string
	IsRequirement      bool
}

type docxParagraph struct {
	text           string
	style          string
	numberingID    string
	numberingLevel int
	hasImage       bool
	inTable        bool
	position       int
}

var chapterPattern = regexp.MustCompile(`^(\d+(?:\.\d+)*)(?:[、.．:：\s]\s*(.+))?$`)
var leafRequirementPattern = regexp.MustCompile(`^\[(RQGN[^-\]]+-[^-\]]+-\d+)\]`)
var requirementGroupPattern = regexp.MustCompile(`^\[RQGN[^-\]]+(?:-[^-\]]+)+\]`)

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
	tableDepth := 0

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
				current.inTable = tableDepth > 0
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
			case "numId":
				if current != nil {
					for _, attribute := range element.Attr {
						if attribute.Name.Local == "val" {
							current.numberingID = attribute.Value
						}
					}
				}
			case "ilvl":
				if current != nil {
					for _, attribute := range element.Attr {
						if attribute.Name.Local == "val" {
							current.numberingLevel = parseChapterNumber(attribute.Value)
						}
					}
				}
			case "tab":
				if current != nil {
					current.text += " "
				}
			case "tbl":
				tableDepth++
				if tableDepth == 1 {
					paragraphs = append(paragraphs, docxParagraph{
						text: "[表格]", inTable: true, position: len(paragraphs) + 1,
					})
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
					if text != "" && !current.inTable {
						current.text = text
						paragraphs = append(paragraphs, *current)
					}
				}
				current = nil
			case "tbl":
				if tableDepth > 0 {
					tableDepth--
				}
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
	chapterCounters := make([]int, 0)

	flush := func() {
		if currentHeading == "" {
			return
		}
		node := chapters[currentHeading]
		node.Description = strings.Join(body, "\n")
		node.PrimaryKind = inferPrimaryKind(node.Title + " " + node.Description)
		node.IsRequirement = looksLikeRequirement(node.Title, node.Description)
		chapters[currentHeading] = node
		body = make([]string, 0)
	}

	for _, paragraph := range paragraphs {
		chapter, title, level, isHeading := classifyParagraph(paragraph)
		if isHeading {
			flush()
			if chapter == "" {
				chapter = nextChapter(&chapterCounters, level)
			}
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
		node := chapters[chapter]
		node.IsRequirement = false
		if matches := leafRequirementPattern.FindStringSubmatch(node.Title); matches != nil {
			node.ExternalIdentifier = matches[1]
			node.IsRequirement = true
			parts := make([]string, 0)
			if node.Description != "" {
				parts = append(parts, node.Description)
			}
			for _, childChapter := range orderedChapters {
				if !strings.HasPrefix(childChapter, chapter+".") {
					continue
				}
				child := chapters[childChapter]
				if child.Description == "" {
					continue
				}
				parts = append(parts, child.Title+"："+child.Description)
			}
			node.Description = strings.Join(parts, "\n")
		} else if !insideRequirementGroup(orderedChapters, chapters, chapter) {
			node.IsRequirement = looksLikeRequirement(node.Title, node.Description)
		}
		node.PrimaryKind = inferPrimaryKind(node.Title + " " + node.Description)
		nodes = append(nodes, node)
	}
	return nodes
}

func insideRequirementGroup(orderedChapters []string, chapters map[string]ParsedNode, chapter string) bool {
	for _, candidate := range orderedChapters {
		if candidate == chapter || !strings.HasPrefix(chapter, candidate+".") {
			continue
		}
		if requirementGroupPattern.MatchString(chapters[candidate].Title) {
			return true
		}
	}
	return false
}

func classifyParagraph(paragraph docxParagraph) (chapter string, title string, level int, isHeading bool) {
	if headingLevel, ok := wordHeadingLevel(paragraph); ok {
		return "", strings.TrimSpace(paragraph.text), headingLevel, true
	}
	if paragraph.style != "" {
		return "", "", 0, false
	}
	matches := chapterPattern.FindStringSubmatch(strings.TrimSpace(paragraph.text))
	if matches == nil {
		return "", "", 0, false
	}
	title = strings.TrimSpace(matches[2])
	textLikelyHeading := title != "" && len([]rune(title)) <= 80 && !strings.Contains(title, "。") &&
		paragraph.numberingID == ""
	if !textLikelyHeading {
		return "", "", 0, false
	}
	return matches[1], title, 0, true
}

func wordHeadingLevel(paragraph docxParagraph) (int, bool) {
	level := parseChapterNumber(paragraph.style)
	if level >= 1 && level <= 9 && strings.TrimSpace(paragraph.text) != "" {
		return level, true
	}
	if strings.Contains(paragraph.style, "heading") || strings.Contains(paragraph.style, "标题") {
		if matches := regexp.MustCompile(`([1-9])\s*$`).FindStringSubmatch(paragraph.style); matches != nil {
			return int(matches[1][0] - '0'), true
		}
	}
	if paragraph.numberingID == "1" && paragraph.numberingLevel >= 0 && paragraph.numberingLevel < 5 &&
		strings.TrimSpace(paragraph.text) != "" {
		return paragraph.numberingLevel + 1, true
	}
	return 0, false
}

func nextChapter(counters *[]int, level int) string {
	if level < 1 {
		level = 1
	}
	if level <= len(*counters) {
		*counters = (*counters)[:level]
		(*counters)[level-1]++
	} else {
		for len(*counters) < level-1 {
			*counters = append(*counters, 0)
		}
		*counters = append(*counters, 1)
	}
	parts := make([]string, len(*counters))
	for index, count := range *counters {
		parts[index] = fmt.Sprintf("%d", count)
	}
	return strings.Join(parts, ".")
}

func looksLikeRequirement(title string, description string) bool {
	description = strings.TrimSpace(description)
	if description == "" {
		return false
	}
	if !strings.Contains(title, "需求") && !strings.Contains(title, "要求") &&
		!strings.Contains(title, "约束") && !strings.Contains(title, "功能") {
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
