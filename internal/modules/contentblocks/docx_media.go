package contentblocks

import (
	"archive/zip"
	"fmt"
	"io"
	"path"
	"sort"
	"strings"
)

// 首批支持的图片类型，见《附件模型》。
var supportedMediaTypes = map[string]string{
	".png":  "image/png",
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".gif":  "image/gif",
}

// MediaFile 是从 DOCX 里抽出的内嵌媒体。
type MediaFile struct {
	RelID     string
	PartName  string
	Data      []byte
	Extension string
	MimeType  string
	Width     int
	Height    int
}

// SkippedMedia 记录被跳过的媒体及原因。
type SkippedMedia struct {
	RelID  string
	Reason string
}

// MediaExtraction 是一次媒体抽取的结果。
type MediaExtraction struct {
	Files   []MediaFile
	Skipped []SkippedMedia
}

// relationship 对应 word/_rels/document.xml.rels 中的一个关系项。
type relationship struct {
	ID         string `xml:"Id,attr"`
	Type       string `xml:"Type,attr"`
	Target     string `xml:"Target,attr"`
	TargetMode string `xml:"TargetMode,attr"`
}

type relationships struct {
	Items []relationship `xml:"Relationship"`
}

// ExtractDocumentMedia 读取 DOCX 的文档关系表，抽出其中的图片资源。
// 只处理内嵌图片；外部链接与不支持的格式记录在 Skipped 中。
func ExtractDocumentMedia(docxPath string) (MediaExtraction, error) {
	reader, err := zip.OpenReader(docxPath)
	if err != nil {
		return MediaExtraction{}, fmt.Errorf("打开 DOCX 失败: %w", err)
	}
	defer reader.Close()

	files := make(map[string]*zip.File, len(reader.File))
	for _, file := range reader.File {
		files[file.Name] = file
	}

	relsFile, ok := files["word/_rels/document.xml.rels"]
	if !ok {
		return MediaExtraction{}, nil
	}
	relsData, err := readZipFile(relsFile)
	if err != nil {
		return MediaExtraction{}, fmt.Errorf("读取文档关系表失败: %w", err)
	}
	parsed, err := parseRelationships(relsData)
	if err != nil {
		return MediaExtraction{}, err
	}

	result := MediaExtraction{}
	relIDs := make([]string, 0, len(parsed))
	byID := make(map[string]relationship, len(parsed))
	for _, rel := range parsed {
		if !strings.HasSuffix(rel.Type, "/image") {
			continue
		}
		relIDs = append(relIDs, rel.ID)
		byID[rel.ID] = rel
	}
	sort.Strings(relIDs)

	for _, relID := range relIDs {
		rel := byID[relID]
		if strings.EqualFold(rel.TargetMode, "External") {
			result.Skipped = append(result.Skipped, SkippedMedia{RelID: relID, Reason: "外部链接图片不受支持"})
			continue
		}
		partName := resolvePartName(rel.Target)
		entry, exists := files[partName]
		if !exists {
			result.Skipped = append(result.Skipped, SkippedMedia{RelID: relID, Reason: "媒体文件缺失: " + partName})
			continue
		}
		extension := strings.ToLower(path.Ext(partName))
		mimeType, supported := supportedMediaTypes[extension]
		if !supported {
			result.Skipped = append(result.Skipped, SkippedMedia{RelID: relID, Reason: "不支持的图片格式: " + extension})
			continue
		}
		data, readErr := readZipFile(entry)
		if readErr != nil {
			result.Skipped = append(result.Skipped, SkippedMedia{RelID: relID, Reason: "读取媒体失败: " + readErr.Error()})
			continue
		}
		result.Files = append(result.Files, MediaFile{
			RelID:     relID,
			PartName:  partName,
			Data:      data,
			Extension: extension,
			MimeType:  mimeType,
		})
	}
	return result, nil
}

func parseRelationships(data []byte) ([]relationship, error) {
	var parsed relationships
	if err := decodeXML(data, &parsed); err != nil {
		return nil, fmt.Errorf("解析文档关系表失败: %w", err)
	}
	return parsed.Items, nil
}

// resolvePartName 把关系目标解析成包内路径。
func resolvePartName(target string) string {
	cleaned := strings.TrimSpace(strings.ReplaceAll(target, "\\", "/"))
	if cleaned == "" {
		return ""
	}
	if strings.HasPrefix(cleaned, "/") {
		return strings.TrimPrefix(path.Clean(cleaned), "/")
	}
	return path.Clean(path.Join("word", cleaned))
}

func readZipFile(file *zip.File) ([]byte, error) {
	handle, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer handle.Close()
	return io.ReadAll(handle)
}
