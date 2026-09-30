package contentblocks

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"
	"time"

	"gorm.io/gorm"

	"chenmeridian/internal/database"
	"chenmeridian/migrations"
)

// TestProjectID 是测试项目 id。
const TestProjectID = "project-test"

func newTestDatabase(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "content-blocks.db"))
	if err != nil {
		t.Fatalf("打开测试数据库失败: %v", err)
	}
	if err := database.Migrate(db, migrations.FS); err != nil {
		t.Fatalf("执行迁移失败: %v", err)
	}
	sqlDB, err := db.DB()
	if err == nil {
		t.Cleanup(func() { _ = sqlDB.Close() })
	}

	// 附件表有项目外键，测试前先准备最小可用的项目数据。
	now := time.Now().UTC()
	if err := db.Exec(`INSERT INTO users (id, username, display_name, password_hash, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)`, "user-test", "tester", "测试用户", "x", now, now).Error; err != nil {
		t.Fatalf("插入测试用户失败: %v", err)
	}
	if err := db.Exec(`INSERT INTO projects (id, code, name, nature, platform, software_type, classification,
		security_level, organization, owner_id, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		TestProjectID, "TEST-001", "测试项目", "第三方测评", "CPU/非嵌", "新研", "内部", "A", "测试单位", "user-test", "编制大纲中", now, now).Error; err != nil {
		t.Fatalf("插入测试项目失败: %v", err)
	}
	return db
}

func TestAssetStoreSavesByHash(t *testing.T) {
	root := t.TempDir()
	store := NewAssetStore(root)

	first, key, err := store.Save([]byte("hello-image"), ".png")
	if err != nil {
		t.Fatalf("保存附件失败: %v", err)
	}
	if len(first) != 64 {
		t.Fatalf("sha256 长度不正确: %q", first)
	}
	if key != filepath.ToSlash(filepath.Join(first[:2], first+".png")) {
		t.Fatalf("存储键不符合约定: %q", key)
	}
	if _, err := os.Stat(filepath.Join(root, filepath.FromSlash(key))); err != nil {
		t.Fatalf("附件文件未落盘: %v", err)
	}

	// 同一内容重复保存应复用同一路径且不报错。
	second, secondKey, err := store.Save([]byte("hello-image"), ".png")
	if err != nil {
		t.Fatalf("重复保存失败: %v", err)
	}
	if second != first || secondKey != key {
		t.Fatalf("相同内容应得到相同存储键: %q vs %q", secondKey, key)
	}

	// 空内容应被拒绝。
	if _, _, err := store.Save(nil, ".png"); err == nil {
		t.Fatal("空附件应被拒绝")
	}
}

func TestRegisterAssetDeduplicates(t *testing.T) {
	db := newTestDatabase(t)
	service := NewService(db, filepath.Join(t.TempDir(), "assets"))
	ctx := context.Background()

	projectID := TestProjectID
	media := MediaFile{
		RelID:     "rId1",
		Extension: ".png",
		MimeType:  "image/png",
		Data:      []byte{0x89, 0x50, 0x4E, 0x47, 0x01},
	}

	firstID, err := service.RegisterAsset(ctx, projectID, "", "tester", media)
	if err != nil {
		t.Fatalf("登记附件失败: %v", err)
	}
	if firstID == "" {
		t.Fatal("登记后应返回资源 id")
	}

	second := media
	second.RelID = "rId2"
	secondID, err := service.RegisterAsset(ctx, projectID, "", "tester", second)
	if err != nil {
		t.Fatalf("重复登记失败: %v", err)
	}
	if secondID != firstID {
		t.Fatalf("相同哈希应复用资源记录: %q vs %q", secondID, firstID)
	}

	var count int64
	if err := db.Model(&Asset{}).Where("project_id = ?", projectID).Count(&count).Error; err != nil {
		t.Fatalf("统计附件失败: %v", err)
	}
	if count != 1 {
		t.Fatalf("同一哈希应只保留一条记录，实际 %d", count)
	}
}

func TestAssetContentOriginalAndThumbnail(t *testing.T) {
	db := newTestDatabase(t)
	service := NewService(db, filepath.Join(t.TempDir(), "assets"))
	ctx := context.Background()

	source := image.NewRGBA(image.Rect(0, 0, 640, 320))
	for y := 0; y < 320; y++ {
		for x := 0; x < 640; x++ {
			source.Set(x, y, color.RGBA{R: uint8(x % 255), G: uint8(y % 255), B: 90, A: 255})
		}
	}
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, source); err != nil {
		t.Fatalf("编码测试图片失败: %v", err)
	}

	assetID, err := service.RegisterAsset(ctx, TestProjectID, "", "tester", MediaFile{
		RelID:     "rId1",
		Extension: ".png",
		MimeType:  "image/png",
		Data:      encoded.Bytes(),
	})
	if err != nil {
		t.Fatalf("登记测试附件失败: %v", err)
	}

	original, err := service.AssetContent(ctx, "TEST-001", assetID, 0)
	if err != nil {
		t.Fatalf("读取原图失败: %v", err)
	}
	if original.ContentType != "image/png" || !bytes.Equal(original.Bytes, encoded.Bytes()) {
		t.Fatal("原图接口应返回原始 PNG")
	}

	thumbnail, err := service.AssetContent(ctx, "TEST-001", assetID, 160)
	if err != nil {
		t.Fatalf("读取缩略图失败: %v", err)
	}
	if thumbnail.ThumbnailFallback || thumbnail.ContentType != "image/png" {
		t.Fatalf("缩略图不应降级: %+v", thumbnail)
	}
	config, err := png.DecodeConfig(bytes.NewReader(thumbnail.Bytes))
	if err != nil {
		t.Fatalf("解析缩略图失败: %v", err)
	}
	if config.Width != 160 || config.Height != 80 {
		t.Fatalf("缩略图尺寸不正确: %dx%d", config.Width, config.Height)
	}

	if _, err := service.AssetContent(ctx, "OTHER", assetID, 0); !errors.Is(err, ErrAssetProjectNotFound) {
		t.Fatalf("不存在项目应返回项目错误，实际 %v", err)
	}
	if _, err := service.AssetContent(ctx, "TEST-001", "missing", 0); !errors.Is(err, ErrAssetNotFound) {
		t.Fatalf("不存在附件应返回附件错误，实际 %v", err)
	}
}

func TestUploadAssetDedupAndDimensions(t *testing.T) {
	db := newTestDatabase(t)
	service := NewService(db, filepath.Join(t.TempDir(), "assets"))
	ctx := context.Background()

	source := image.NewRGBA(image.Rect(0, 0, 800, 400))
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, source); err != nil {
		t.Fatalf("编码测试图片失败: %v", err)
	}
	upload := AssetUpload{Data: encoded.Bytes(), Filename: "sample.png", MimeType: "image/png", Operator: "tester"}
	first, err := service.UploadAsset(ctx, "TEST-001", upload)
	if err != nil {
		t.Fatalf("上传图片失败: %v", err)
	}
	if first.Width != 800 || first.Height != 400 || first.MimeType != "image/png" {
		t.Fatalf("上传元数据不正确: %+v", first)
	}
	second, err := service.UploadAsset(ctx, "TEST-001", upload)
	if err != nil {
		t.Fatalf("重复上传失败: %v", err)
	}
	if second.ID != first.ID {
		t.Fatalf("相同图片应复用资源: %s != %s", second.ID, first.ID)
	}

	if _, err := service.UploadAsset(ctx, "TEST-001", AssetUpload{Data: []byte("x"), Filename: "x.txt"}); !errors.Is(err, ErrAssetUploadType) {
		t.Fatalf("非图片应被拒绝，实际 %v", err)
	}
	if _, err := service.UploadAsset(ctx, "TEST-001", AssetUpload{Data: make([]byte, MaxAssetUploadBytes+1), Filename: "large.png"}); !errors.Is(err, ErrAssetUploadTooLarge) {
		t.Fatalf("超大图片应被拒绝，实际 %v", err)
	}
}
