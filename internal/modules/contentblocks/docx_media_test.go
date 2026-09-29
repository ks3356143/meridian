package contentblocks

import (
	"archive/zip"
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

const sampleRelationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image2.emf"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://example.com/a.png" TargetMode="External"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

func writeSampleDocx(t *testing.T, path string) {
	t.Helper()
	file, err := os.Create(path)
	if err != nil {
		t.Fatalf("创建样例 DOCX 失败: %v", err)
	}
	defer file.Close()

	writer := zip.NewWriter(file)
	entries := map[string][]byte{
		"word/document.xml":            []byte("<w:document/>"),
		"word/_rels/document.xml.rels": []byte(sampleRelationships),
		"word/media/image1.png":        {0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x01, 0x02},
		"word/media/image2.emf":        {0x01, 0x00, 0x00, 0x00},
	}
	for name, data := range entries {
		entry, err := writer.Create(name)
		if err != nil {
			t.Fatalf("写入 %s 失败: %v", name, err)
		}
		if _, err := entry.Write(data); err != nil {
			t.Fatalf("写入 %s 失败: %v", name, err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("关闭样例 DOCX 失败: %v", err)
	}
}

func TestExtractDocumentMedia(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sample.docx")
	writeSampleDocx(t, path)

	extraction, err := ExtractDocumentMedia(path)
	if err != nil {
		t.Fatalf("抽媒体失败: %v", err)
	}
	if len(extraction.Files) != 1 {
		t.Fatalf("应抽出 1 张受支持图片，实际 %d", len(extraction.Files))
	}
	file := extraction.Files[0]
	if file.RelID != "rId1" || file.PartName != "word/media/image1.png" {
		t.Fatalf("图片关系解析错误: %+v", file)
	}
	if file.MimeType != "image/png" || file.Extension != ".png" {
		t.Fatalf("图片类型解析错误: %+v", file)
	}
	if !bytes.HasPrefix(file.Data, []byte{0x89, 0x50, 0x4E, 0x47}) {
		t.Fatalf("图片字节不正确: %v", file.Data)
	}
	if len(extraction.Skipped) != 2 {
		t.Fatalf("应跳过 2 项（EMF 与外部链接），实际 %d: %+v", len(extraction.Skipped), extraction.Skipped)
	}
}

func TestExtractDocumentMediaWithoutRels(t *testing.T) {
	path := filepath.Join(t.TempDir(), "empty.docx")
	file, err := os.Create(path)
	if err != nil {
		t.Fatalf("创建文件失败: %v", err)
	}
	writer := zip.NewWriter(file)
	entry, _ := writer.Create("word/document.xml")
	_, _ = entry.Write([]byte("<w:document/>"))
	_ = writer.Close()
	_ = file.Close()

	extraction, err := ExtractDocumentMedia(path)
	if err != nil {
		t.Fatalf("缺少关系表时不应报错: %v", err)
	}
	if len(extraction.Files) != 0 || len(extraction.Skipped) != 0 {
		t.Fatalf("缺少关系表时应为空结果: %+v", extraction)
	}
}
