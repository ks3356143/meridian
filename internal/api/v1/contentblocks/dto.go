package contentblocks

import (
	"github.com/danielgtaylor/huma/v2"

	contentblocksservice "chenmeridian/internal/modules/contentblocks"
)

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

type AssetContentInput struct {
	Code    string `path:"code" pattern:"^R[0-9]{4,5}$" doc:"项目业务标识"`
	AssetID string `path:"assetId" minLength:"1" doc:"附件 ID"`
	Width   int    `query:"w" minimum:"16" maximum:"4096" doc:"缩略图最大宽度，省略时返回原图"`
}

type AssetUploadForm struct {
	File huma.FormFile `form:"file" contentType:"application/octet-stream" required:"true"`
}

type AssetUploadInput struct {
	Code    string `path:"code" pattern:"^R[0-9]{4,5}$" doc:"项目业务标识"`
	RawBody huma.MultipartFormFiles[AssetUploadForm]
}

type AssetUploadOutput struct {
	Body contentblocksservice.AssetUploadResponse
}
