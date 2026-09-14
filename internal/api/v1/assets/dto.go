package assets

import (
	"github.com/danielgtaylor/huma/v2"

	assetservice "chenmeridian/internal/modules/assets"
)

type WorkObjectListInput struct {
	Code string `path:"code" required:"true"`
}

type WorkObjectListOutput struct {
	Body []assetservice.WorkObjectResponse
}

type UploadForm struct {
	Files       []huma.FormFile `form:"files" contentType:"application/octet-stream" required:"true"`
	Source      string          `form:"source" required:"true"`
	ReceivedAt  string          `form:"receivedAt" required:"true"`
	ReceiveMode string          `form:"receiveMode" required:"true"`
}

type WorkObjectUploadInput struct {
	Code    string `path:"code" required:"true"`
	RawBody huma.MultipartFormFiles[UploadForm]
}

type WorkObjectUploadOutput struct {
	Body []assetservice.WorkObjectResponse
}

type ManualWorkObjectInput struct {
	Code string `path:"code" required:"true"`
	Body ManualWorkObjectRequest
}

type ManualWorkObjectRequest struct {
	ObjectKind  string `json:"objectKind" required:"true"`
	ObjectName  string `json:"objectName" required:"true"`
	Version     string `json:"version" required:"true"`
	Platform    string `json:"platform" required:"true"`
	Source      string `json:"source" required:"true"`
	ReceivedAt  string `json:"receivedAt" required:"true"`
	ReceiveMode string `json:"receiveMode" required:"true"`
}

type WorkObjectOutput struct {
	Body assetservice.WorkObjectResponse
}

type UpdateWorkObjectInput struct {
	ID   string `path:"id" required:"true"`
	Body UpdateWorkObjectRequest
}

type UpdateWorkObjectRequest struct {
	ObjectKind  string `json:"objectKind" required:"true"`
	ObjectName  string `json:"objectName" required:"true"`
	Version     string `json:"version" required:"true"`
	Platform    string `json:"platform" required:"true"`
	Source      string `json:"source" required:"true"`
	ReceivedAt  string `json:"receivedAt" required:"true"`
	ReceiveMode string `json:"receiveMode" required:"true"`
}

type VersionIDInput struct {
	ID string `path:"id" required:"true"`
}

type LifecycleActionInput struct {
	ID   string `path:"id" required:"true"`
	Body LifecycleActionRequest
}

type LifecycleActionRequest struct {
	Reason string `json:"reason" required:"true"`
}

type WorkObjectLifecycleOutput struct {
	Body []assetservice.LifecycleEventResponse
}
