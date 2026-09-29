package v1

import (
	"context"
	"errors"
	"path/filepath"

	contentblockservice "chenmeridian/internal/modules/contentblocks"
	"chenmeridian/internal/modules/officecli"
	requirementservice "chenmeridian/internal/modules/requirements"
)

// ErrBodyBuilderUnavailable 表示外部文档引擎不可用，解析降级为纯文本。
var ErrBodyBuilderUnavailable = errors.New("外部文档引擎不可用，已降级为纯文本解析")

// requirementBodyBuilder 把内容块服务适配成需求解析的正文构建器。
type requirementBodyBuilder struct {
	blocks *contentblockservice.Service
	source *officecli.Client
}

func (b requirementBodyBuilder) BuildRequirementBodies(
	ctx context.Context,
	docxPath string,
	projectID string,
	specs []requirementservice.RequirementBodyRange,
	operatedBy string,
) (int, error) {
	if b.blocks == nil || b.source == nil {
		return 0, ErrBodyBuilderUnavailable
	}
	if !b.source.Available() {
		return 0, ErrBodyBuilderUnavailable
	}

	converted := make([]contentblockservice.RequirementBodySpec, 0, len(specs))
	for _, spec := range specs {
		converted = append(converted, contentblockservice.RequirementBodySpec{
			RequirementID:  spec.RequirementID,
			StartParagraph: spec.Start,
			EndParagraph:   spec.End,
		})
	}

	// 处理完成后释放引擎为文档保留的常驻进程，避免文件被锁。
	defer b.source.Close(ctx, docxPath)
	return b.blocks.BuildRequirementBodies(ctx, b.source, docxPath, projectID, converted, operatedBy)
}

// contentAssetRoot 返回内容块附件的存储根目录（data/assets）。
func contentAssetRoot(assetRoot string) string {
	return filepath.Join(filepath.Dir(assetRoot), "assets")
}
