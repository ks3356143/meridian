package contentblocks

import (
	"context"
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
