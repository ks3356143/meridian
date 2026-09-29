package contentblocks

import (
	"context"
	"path/filepath"
	"testing"

	"chenmeridian/internal/modules/officecli"
)

type fakeDocxSource struct {
	body []officecli.Node
	err  error
}

func (f fakeDocxSource) Body(context.Context, string, int) ([]officecli.Node, error) {
	return f.body, f.err
}

func TestImportFromDocxRegistersImages(t *testing.T) {
	db := newTestDatabase(t)
	service := NewService(db, filepath.Join(t.TempDir(), "assets"))
	docxPath := filepath.Join(t.TempDir(), "sample.docx")
	writeSampleDocx(t, docxPath)

	source := fakeDocxSource{body: []officecli.Node{
		paragraph("指令参数管理", "heading 2", map[string]any{"styleName": "heading 2"}),
		paragraph("参数说明如下。", "Normal", nil),
		paragraph("", "Normal", nil, officecli.Node{
			Type:   "picture",
			Format: map[string]any{"relId": "rId1", "width": "10cm", "height": "5cm"},
		}),
	}}

	result, err := service.ImportFromDocx(context.Background(), source, docxPath, TestProjectID, "tester")
	if err != nil {
		t.Fatalf("导入失败: %v", err)
	}
	if err := ValidateDocument(result.Doc); err != nil {
		t.Fatalf("导入结果应满足节点白名单: %v", err)
	}

	if len(result.Doc.Content) != 3 {
		t.Fatalf("应产出 3 个块（标题 + 段落 + 图片），实际 %d", len(result.Doc.Content))
	}
	image := result.Doc.Content[2]
	if image.Type != NodeAssetImage {
		t.Fatalf("第三个块应为图片，实际 %s", image.Type)
	}
	assetID, _ := stringAttr(image.Attrs, "assetId")
	if assetID == "" {
		t.Fatalf("图片未绑定已登记的资源: %+v", image.Attrs)
	}

	var asset Asset
	if err := db.Where("id = ?", assetID).First(&asset).Error; err != nil {
		t.Fatalf("资源记录未落库: %v", err)
	}
	if asset.ProjectID != TestProjectID || asset.MimeType != "image/png" || asset.FileSize == 0 {
		t.Fatalf("资源记录内容不正确: %+v", asset)
	}
	if asset.StorageKey == "" {
		t.Fatalf("资源缺少存储键: %+v", asset)
	}

	// EMF 与外部链接图片应被记录为跳过，而不是静默丢失。
	if len(result.Skipped) != 2 {
		t.Fatalf("应记录 2 项跳过资源，实际 %+v", result.Skipped)
	}
}

func TestImportFromDocxWithoutSource(t *testing.T) {
	service := NewService(newTestDatabase(t), t.TempDir())
	if _, err := service.ImportFromDocx(context.Background(), nil, "x.docx", TestProjectID, "tester"); err == nil {
		t.Fatal("缺少解析源时应报错")
	}
}
