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

type CreateReferenceStandardRequest struct {
	Name          string `json:"name" minLength:"1" maxLength:"160" doc:"文档名称"`
	Code          string `json:"code" minLength:"1" maxLength:"160" doc:"标识或版本"`
	PublishedDate string `json:"publishedDate" maxLength:"40" pattern:"^[0-9]{4}-[0-9]{2}-[0-9]{2}$" doc:"发布日期"`
	Source        string `json:"source" minLength:"1" maxLength:"160" doc:"来源单位"`
	SortOrder     int    `json:"sortOrder" minimum:"0" maximum:"9999" doc:"排序值"`
	IsEnabled     bool   `json:"isEnabled" doc:"是否启用"`
	IsDefault     bool   `json:"isDefault" doc:"是否作为新建项目默认依据标准"`
}

type UpdateReferenceStandardRequest struct {
	Name          string `json:"name" minLength:"1" maxLength:"160" doc:"文档名称"`
	Code          string `json:"code" minLength:"1" maxLength:"160" doc:"标识或版本"`
	PublishedDate string `json:"publishedDate,omitempty" maxLength:"40" pattern:"^$|^[0-9]{4}-[0-9]{2}-[0-9]{2}$" doc:"发布日期；为空时保留原值"`
	Source        string `json:"source" minLength:"1" maxLength:"160" doc:"来源单位"`
	SortOrder     int    `json:"sortOrder" minimum:"0" maximum:"9999" doc:"排序值"`
	IsEnabled     bool   `json:"isEnabled" doc:"是否启用"`
	IsDefault     bool   `json:"isDefault" doc:"是否作为新建项目默认依据标准"`
}

type ReferenceStandardOutput struct {
	Body projects.ReferenceStandardResponse
}

type ReferenceStandardListOutput struct {
	Body []projects.ReferenceStandardResponse
}

type CreateReferenceStandardInput struct {
	Body CreateReferenceStandardRequest
}

type UpdateReferenceStandardInput struct {
	ID   string `path:"id" minLength:"36" maxLength:"36" doc:"依据标准 ID"`
	Body UpdateReferenceStandardRequest
}
type SaveRelatedPartyRequest struct {
	Category  string `json:"category" enum:"client,developer,test_center" doc:"相关方类别"`
	Name      string `json:"name" minLength:"1" maxLength:"80" doc:"单位名称"`
	Contact   string `json:"contact,omitempty" maxLength:"80" doc:"联系人"`
	Phone     string `json:"phone,omitempty" maxLength:"40" doc:"联系电话"`
	Address   string `json:"address,omitempty" maxLength:"160" doc:"单位地址"`
	SortOrder int    `json:"sortOrder" minimum:"0" maximum:"9999" doc:"排序值"`
	IsEnabled bool   `json:"isEnabled" doc:"是否启用"`
}

type RelatedPartyOutput struct {
	Body projects.RelatedPartyResponse
}

type RelatedPartyListOutput struct {
	Body []projects.RelatedPartyResponse
}

type CreateRelatedPartyInput struct {
	Body SaveRelatedPartyRequest
}

type UpdateRelatedPartyInput struct {
	ID   string `path:"id" minLength:"36" maxLength:"36" doc:"相关方 ID"`
	Body SaveRelatedPartyRequest
}
