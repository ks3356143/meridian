package contentblocks

import contentblocksservice "chenmeridian/internal/modules/contentblocks"

type RequirementBodyInput struct {
	ID string `path:"id" required:"true"`
}

type RequirementBodyOutput struct {
	Body contentblocksservice.BodyResponse
}

type SaveRequirementBodyInput struct {
	ID   string `path:"id" required:"true"`
	Body SaveRequirementBodyRequest
}

type SaveRequirementBodyRequest struct {
	Doc           contentblocksservice.Node `json:"doc" required:"true"`
	Origin        string                    `json:"origin,omitempty"`
	AuthoringMode string                    `json:"authoringMode,omitempty"`
}