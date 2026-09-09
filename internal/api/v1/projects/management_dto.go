package projects

import "chenmeridian/internal/modules/projects"

type SaveDictionaryRequest struct {
	Category  string `json:"category" enum:"language,runtime_environment,development_environment" doc:"技术字典类型"`
	Name      string `json:"name" minLength:"1" maxLength:"80" doc:"展示名"`
	SortOrder int    `json:"sortOrder" minimum:"0" maximum:"9999" doc:"排序值"`
	IsEnabled bool   `json:"isEnabled" doc:"是否启用"`
}

type DictionaryOutput struct {
	Body projects.DictionaryItemResponse
}

type DictionaryListOutput struct {
	Body []projects.DictionaryItemResponse
}

type CreateDictionaryInput struct {
	Body SaveDictionaryRequest
}

type UpdateDictionaryInput struct {
	ID   string `path:"id" minLength:"36" maxLength:"36" doc:"技术字典 ID"`
	Body SaveDictionaryRequest
}

type SaveReferenceStandardRequest struct {
	Name          string `json:"name" minLength:"1" maxLength:"160" doc:"文档名称"`
	Code          string `json:"code" maxLength:"160" doc:"标识或版本"`
	PublishedDate string `json:"publishedDate" maxLength:"40" pattern:"^$|^[0-9]{4}-[0-9]{2}-[0-9]{2}$" doc:"发布日期"`
	Source        string `json:"source" maxLength:"160" doc:"来源单位"`
	SortOrder     int    `json:"sortOrder" minimum:"0" maximum:"9999" doc:"排序值"`
	IsEnabled     bool   `json:"isEnabled" doc:"是否启用"`
}

type ReferenceStandardOutput struct {
	Body projects.ReferenceStandardResponse
}

type ReferenceStandardListOutput struct {
	Body []projects.ReferenceStandardResponse
}

type CreateReferenceStandardInput struct {
	Body SaveReferenceStandardRequest
}

type UpdateReferenceStandardInput struct {
	ID   string `path:"id" minLength:"36" maxLength:"36" doc:"依据标准 ID"`
	Body SaveReferenceStandardRequest
}
