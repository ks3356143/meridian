package testitems

import (
	"context"
	"testing"
)

func TestPreviewRequirementTestItemsClassifiesCandidates(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	seedRequirementForCreate(t, service, projectID, "req-preview-create", "待创建需求", "functional", "official", "pending", "可创建测试项")
	seedBatchRequirement(t, service, projectID, "req-preview-linked", "4.2", "已关联需求", "interface", "official", "pending", "已有关联")
	seedBatchRequirement(t, service, projectID, "req-preview-incomplete", "4.3", "待补描述需求", "performance", "official", "completed", "")

	if _, err := service.CreateTestItem(ctx, CreateTestItemInput{ProjectID: projectID, RequirementID: "req-preview-linked"}); err != nil {
		t.Fatalf("准备已关联需求失败: %v", err)
	}
	preview, err := service.PreviewRequirementTestItems(ctx, projectID)
	if err != nil {
		t.Fatalf("预览需求候选失败: %v", err)
	}
	if preview.Total != 3 || preview.Creatable != 1 || preview.Linked != 1 || preview.Incomplete != 1 {
		t.Fatalf("候选分类不正确: %+v", preview)
	}
	byID := make(map[string]RequirementTestItemCandidate, len(preview.Requirement))
	for _, item := range preview.Requirement {
		byID[item.RequirementID] = item
	}
	if !byID["req-preview-create"].CanCreate || byID["req-preview-create"].MappedTypeCode != "SU" {
		t.Fatalf("待创建需求状态不正确: %+v", byID["req-preview-create"])
	}
	if byID["req-preview-linked"].CanCreate || byID["req-preview-linked"].LinkedTestItemCount != 1 {
		t.Fatalf("已关联需求不应可创建: %+v", byID["req-preview-linked"])
	}
	if byID["req-preview-incomplete"].BlockReason != "待补描述" {
		t.Fatalf("待补描述原因不正确: %+v", byID["req-preview-incomplete"])
	}
}
