package testitems

import (
	"context"
	"testing"

	"chenmeridian/internal/modules/contentblocks"
)

func TestAnnotationsScansRequirementsAndStepHighlightsAcrossRounds(t *testing.T) {
	service, projectID := newTestService(t)
	ctx := context.Background()
	round1, err := service.EnsureRound(ctx, projectID)
	if err != nil {
		t.Fatalf("准备第 1 轮失败: %v", err)
	}
	seedRequirementForCreate(t, service, projectID, "req-annotation", "高亮需求", "functional", "official", "completed", "需求正文")
	if _, err := service.blocks.SaveBlock(ctx, projectID, contentblocks.OwnerTypeRequirement, "req-annotation",
		contentblocks.BlockKeyRequirementBody, annotationTestDoc(
			annotationTestRun("开始说明 ", nil),
			annotationTestRun("关键要求", []string{contentblocks.MarkHighlight}),
			annotationTestRun(" 结束说明", nil),
		), contentblocks.SaveBlockOptions{}, "user-1"); err != nil {
		t.Fatalf("保存需求高亮失败: %v", err)
	}

	item, err := service.CreateTestItem(ctx, CreateTestItemInput{
		ProjectID: projectID, RoundID: round1.ID, TypeCode: "SU", Name: "高亮测试项",
	})
	if err != nil {
		t.Fatalf("创建测试项失败: %v", err)
	}
	if err := service.LinkRequirement(ctx, projectID, item.ID, "req-annotation"); err != nil {
		t.Fatalf("关联需求失败: %v", err)
	}
	itemCase, err := service.CreateCase(ctx, item.ID, "高亮用例")
	if err != nil {
		t.Fatalf("创建用例失败: %v", err)
	}
	step, err := service.CreateStep(ctx, itemCase.ID, "预期结果")
	if err != nil {
		t.Fatalf("创建步骤失败: %v", err)
	}
	if _, err := service.SaveStepBlock(ctx, step.ID, contentblocks.StepKindOp, annotationTestDoc(
		annotationTestRun("打开页面，", nil),
		annotationTestRun("点击查询", []string{contentblocks.MarkHighlight}),
		annotationTestRun("，等待返回", nil),
	), "user-1"); err != nil {
		t.Fatalf("保存 op 高亮失败: %v", err)
	}
	if _, err := service.SaveStepBlock(ctx, step.ID, contentblocks.StepKindAct, annotationTestDoc(
		annotationTestRun("返回", nil),
		annotationTestRun("错误码 500", []string{contentblocks.MarkBold, contentblocks.MarkHighlight}),
	), "user-1"); err != nil {
		t.Fatalf("保存 act 高亮失败: %v", err)
	}

	first, err := service.Annotations(ctx, projectID, round1.ID)
	if err != nil {
		t.Fatalf("读取第 1 轮标注失败: %v", err)
	}
	if first.Summary.Total != 3 || first.Summary.RequirementBody != 1 || first.Summary.StepOp != 1 ||
		first.Summary.StepAct != 1 || first.Summary.Requirements != 1 || first.Summary.Cases != 1 {
		t.Fatalf("第 1 轮标注摘要不正确: %+v", first.Summary)
	}
	assertAnnotationText(t, first.Rows, "关键要求")
	assertAnnotationText(t, first.Rows, "点击查询")
	assertAnnotationText(t, first.Rows, "错误码 500")
	for _, row := range first.Rows {
		if row.Kind != AnnotationKindRequirementBody && row.RequirementID != "req-annotation" {
			t.Fatalf("步骤标注应带上所属需求上下文: %+v", row)
		}
	}

	round2, err := service.CreateRoundCopy(ctx, CreateRoundCopyInput{
		ProjectID: projectID, SourceRoundID: round1.ID, TestItemIDs: []string{item.ID}, Name: "第二轮",
	})
	if err != nil {
		t.Fatalf("创建第二轮失败: %v", err)
	}
	second, err := service.Annotations(ctx, projectID, round2.Round.ID)
	if err != nil {
		t.Fatalf("读取第二轮标注失败: %v", err)
	}
	if second.Summary.Total != 2 || second.Summary.RequirementBody != 1 || second.Summary.StepOp != 1 ||
		second.Summary.StepAct != 0 {
		t.Fatalf("第二轮应保留项目级需求高亮和复制后的 op 高亮，不复制 act: %+v", second.Summary)
	}

	all, err := service.Annotations(ctx, projectID, "all")
	if err != nil {
		t.Fatalf("读取全轮标注失败: %v", err)
	}
	if all.Summary.Total != 4 || all.Summary.RequirementBody != 1 || all.Summary.StepOp != 2 ||
		all.Summary.StepAct != 1 || all.Summary.Requirements != 1 || all.Summary.Cases != 2 {
		t.Fatalf("全轮标注摘要不正确: %+v", all.Summary)
	}
	opRounds := map[int]bool{}
	for _, row := range all.Rows {
		if row.Kind == AnnotationKindStepOp {
			opRounds[row.RoundNumber] = true
		}
	}
	if !opRounds[1] || !opRounds[2] {
		t.Fatalf("op 高亮应随轮显示: %+v", opRounds)
	}
}

func assertAnnotationText(t *testing.T, rows []AnnotationRow, want string) {
	t.Helper()
	for _, row := range rows {
		if row.Text == want {
			return
		}
	}
	t.Fatalf("未找到标注文字 %q: %+v", want, rows)
}

func annotationTestDoc(runs ...contentblocks.Node) contentblocks.Node {
	return contentblocks.Node{Type: contentblocks.NodeDoc, Content: []contentblocks.Node{
		{Type: contentblocks.NodeParagraph, Content: runs},
	}}
}

func annotationTestRun(text string, marks []string) contentblocks.Node {
	run := contentblocks.Node{Type: contentblocks.NodeText, Text: text}
	for _, mark := range marks {
		run.Marks = append(run.Marks, contentblocks.Mark{Type: mark})
	}
	return run
}
