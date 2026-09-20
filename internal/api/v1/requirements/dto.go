package requirements

import (
	requirementsservice "chenmeridian/internal/modules/requirements"
)

type WorkbenchInput struct {
	Code            string `path:"code" required:"true"`
	SourceVersionID string `query:"sourceVersionId"`
}

type WorkbenchOutput struct {
	Body requirementsservice.WorkbenchResponse
}

type CreateSectionInput struct {
	Code string `path:"code" required:"true"`
	Body CreateSectionRequest
}

type CreateSectionRequest struct {
	SourceVersionID string `json:"sourceVersionId" required:"true"`
	ParentID        string `json:"parentId,omitempty"`
	ChapterNumber   string `json:"chapterNumber" required:"true"`
	Title           string `json:"title" required:"true"`
}

type SectionOutput struct {
	Body requirementsservice.SectionResponse
}

type CreateRequirementInput struct {
	Code string `path:"code" required:"true"`
	Body CreateRequirementRequest
}

type CreateRequirementRequest struct {
	SourceVersionID    string   `json:"sourceVersionId" required:"true"`
	SectionID          string   `json:"sectionId,omitempty"`
	ChapterNumber      string   `json:"chapterNumber" required:"true"`
	ExternalIdentifier string   `json:"externalIdentifier,omitempty"`
	Name               string   `json:"name" required:"true"`
	Description        string   `json:"description"`
	PrimaryKind        string   `json:"primaryKind" required:"true"`
	SecondaryKinds     []string `json:"secondaryKinds,omitempty"`
	Tags               []string `json:"tags,omitempty"`
}

type RequirementOutput struct {
	Body requirementsservice.RequirementResponse
}

type RequirementEventsInput struct {
	ID string `path:"id" required:"true"`
}

type RequirementEventsOutput struct {
	Body []requirementsservice.RequirementEventResponse
}

type PurgeRequirementInput struct {
	Code string `path:"code" required:"true"`
	ID   string `path:"id" required:"true"`
	Body PurgeRequirementRequest
}

type PurgeRequirementRequest struct {
	Reason string `json:"reason"`
}

type PurgeRequirementOutput struct {
	Body requirementsservice.PurgeRequirementResult
}

type BulkPurgeRequirementsInput struct {
	Code string `path:"code" required:"true"`
	Body BulkPurgeRequirementsRequest
}

type BulkPurgeRequirementsRequest struct {
	IDs    []string `json:"ids,omitempty"`
	All    bool     `json:"all,omitempty"`
	Reason string   `json:"reason" required:"true"`
}

type BulkPurgeRequirementsOutput struct {
	Body requirementsservice.PurgeRequirementResult
}

type BulkCreateInput struct {
	Code string `path:"code" required:"true"`
	Body BulkCreateRequest
}

type BulkCreateRequest struct {
	SourceVersionID string                         `json:"sourceVersionId" required:"true"`
	Items           []requirementsservice.BulkItem `json:"items" required:"true"`
}

type BulkCreateOutput struct {
	Body requirementsservice.BulkCreateResult
}

type ParseInput struct {
	Code string `path:"code" required:"true"`
	Body ParseRequest
}

type ParseRequest struct {
	SourceVersionID string `json:"sourceVersionId" required:"true"`
}

type ParseOutput struct {
	Body requirementsservice.ParseResult
}

type UpdateRequirementInput struct {
	ID   string `path:"id" required:"true"`
	Body UpdateRequirementRequest
}

type UpdateRequirementRequest struct {
	SectionID          string   `json:"sectionId,omitempty"`
	ChapterNumber      string   `json:"chapterNumber" required:"true"`
	ExternalIdentifier string   `json:"externalIdentifier,omitempty"`
	Name               string   `json:"name" required:"true"`
	Description        string   `json:"description"`
	PrimaryKind        string   `json:"primaryKind" required:"true"`
	SecondaryKinds     []string `json:"secondaryKinds,omitempty"`
	Tags               []string `json:"tags,omitempty"`
}

type StatusActionInput struct {
	Code string `path:"code" required:"true"`
	Body StatusActionRequest
}

type StatusActionRequest struct {
	IDs    []string `json:"ids" required:"true"`
	Action string   `json:"action" required:"true"`
	Reason string   `json:"reason,omitempty"`
}

type StatusActionOutput struct {
	Body requirementsservice.StatusActionResult
}

type BulkUpdateRequirementInput struct {
	Code string `path:"code" required:"true"`
	Body BulkUpdateRequirementRequest
}

type BulkUpdateRequirementRequest struct {
	IDs            []string                             `json:"ids" required:"true"`
	PrimaryKind    *string                              `json:"primaryKind,omitempty"`
	SecondaryKinds *[]string                            `json:"secondaryKinds,omitempty"`
	Replace        *requirementsservice.BulkReplaceSpec `json:"replace,omitempty"`
}

type BulkUpdateRequirementOutput struct {
	Body requirementsservice.BulkUpdateResult
}
