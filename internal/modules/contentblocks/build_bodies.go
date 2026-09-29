package contentblocks

import (
	"context"
	"errors"
	"strings"
)

// RequirementBodySpec 描述一条需求的正文段落区间（1-based，end 不含）。
type RequirementBodySpec struct {
	RequirementID  string
	StartParagraph int
	EndParagraph   int
}

// BuildRequirementBodies 为一批需求生成正文块：抽取并登记图片资源，再按段落区间切分正文树。
//
// 这是可选能力：调用方在没有 OfficeCLI 或解析失败时应降级为纯文本，不阻断主流程。
func (s *Service) BuildRequirementBodies(
	ctx context.Context,
	source DocxSource,
	docxPath string,
	projectID string,
	specs []RequirementBodySpec,
	operator string,
) (int, error) {
	if source == nil {
		return 0, nil
	}
	if len(specs) == 0 {
		return 0, nil
	}

	media, err := ExtractDocumentMedia(docxPath)
	if err != nil {
		return 0, err
	}
	assetIDs := make(map[string]string, len(media.Files))
	for _, file := range media.Files {
		assetID, registerErr := s.RegisterAsset(ctx, projectID, "", operator, file)
		if registerErr != nil {
			return 0, registerErr
		}
		assetIDs[file.RelID] = assetID
	}

	body, err := source.Body(ctx, docxPath, 8)
	if err != nil {
		return 0, err
	}
	if len(body) == 0 {
		return 0, nil
	}

	options := ImportOptions{
		HeaderRow:       true,
		AssetIDForRelID: func(relID string) string { return assetIDs[relID] },
	}

	built := 0
	for _, spec := range specs {
		segment := SegmentBody(body, spec.StartParagraph, spec.EndParagraph)
		if len(segment) == 0 {
			continue
		}
		converted := ConvertBody(segment, options)
		if len(converted.Doc.Content) == 0 {
			continue
		}
		// 解析阶段不覆盖解析器产出的摘要，只落正文块。
		if err := s.saveBody(ctx, projectID, spec.RequirementID, converted.Doc, OriginImported, AuthoringAuto, operator, false); err != nil {
			return built, err
		}
		built++
	}
	return built, nil
}

// saveBody 写入正文块；syncDescription 为真时同步需求摘要。
func (s *Service) saveBody(
	ctx context.Context,
	projectID string,
	ownerID string,
	doc Node,
	origin string,
	authoringMode string,
	operator string,
	syncDescription bool,
) error {
	if err := ValidateDocument(doc); err != nil {
		return err
	}
	if strings.TrimSpace(projectID) == "" || strings.TrimSpace(ownerID) == "" {
		return errors.New("内容块拥有者信息不完整")
	}
	return s.persist(ctx, projectID, ownerID, doc, origin, authoringMode, operator, syncDescription)
}
