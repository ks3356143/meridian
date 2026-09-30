package contentblocks

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"testing"
)

func TestCreateThumbnailScalesToMaxWidth(t *testing.T) {
	source := image.NewRGBA(image.Rect(0, 0, 800, 400))
	for y := 0; y < 400; y++ {
		for x := 0; x < 800; x++ {
			source.Set(x, y, color.RGBA{R: uint8(x % 255), G: uint8(y % 255), B: 120, A: 255})
		}
	}
	var original bytes.Buffer
	if err := png.Encode(&original, source); err != nil {
		t.Fatalf("编码测试 PNG 失败: %v", err)
	}

	thumb, contentType, generated, err := CreateThumbnail(original.Bytes(), "image/png", 320)
	if err != nil {
		t.Fatalf("生成缩略图失败: %v", err)
	}
	if !generated || contentType != "image/png" {
		t.Fatalf("缩略图元数据不正确: generated=%v content=%s", generated, contentType)
	}
	config, err := png.DecodeConfig(bytes.NewReader(thumb))
	if err != nil {
		t.Fatalf("读取缩略图尺寸失败: %v", err)
	}
	if config.Width != 320 || config.Height != 160 {
		t.Fatalf("缩略图尺寸不正确: %dx%d", config.Width, config.Height)
	}
}

func TestCreateThumbnailKeepsSmallOriginal(t *testing.T) {
	source := image.NewRGBA(image.Rect(0, 0, 120, 60))
	var original bytes.Buffer
	if err := png.Encode(&original, source); err != nil {
		t.Fatalf("编码测试 PNG 失败: %v", err)
	}

	thumb, _, generated, err := CreateThumbnail(original.Bytes(), "image/png", 320)
	if err != nil {
		t.Fatalf("处理小图失败: %v", err)
	}
	if generated || !bytes.Equal(thumb, original.Bytes()) {
		t.Fatal("小图不应重新编码")
	}
}
