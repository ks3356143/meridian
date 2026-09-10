package projects

import "chenmeridian/internal/modules/projects"

type CreateProjectRequest struct {
	IdentifierSuffix        string   `json:"identifierSuffix" minLength:"4" maxLength:"5" pattern:"^[0-9]{4,5}$" doc:"项目标识后缀，4 到 5 位数字"`
	Name                    string   `json:"name" minLength:"1" maxLength:"160" doc:"项目名称"`
	Nature                  string   `json:"nature" enum:"鉴定测评,第三方测评,二方测评" doc:"测评性质"`
	Platform                string   `json:"platform" enum:"FPGA,CPU/非嵌" doc:"测试平台"`
	SoftwareType            string   `json:"softwareType" enum:"新研,改造,沿用" doc:"软件类型"`
	Classification          string   `json:"classification" enum:"公开,内部,秘密,机密,绝密" doc:"密级"`
	SecurityLevel           string   `json:"securityLevel" enum:"A,B,C,D" doc:"安全等级"`
	Organization            string   `json:"organization,omitempty" maxLength:"160" doc:"研制单位（可选，进入项目后再设置）"`
	OwnerID                 string   `json:"ownerId" minLength:"1" doc:"项目负责人用户 ID"`
	MemberIDs               []string `json:"memberIds" doc:"项目成员用户 ID"`
	Languages               []string `json:"languages" minItems:"1" doc:"编程语言，可包含自定义值"`
	RuntimeEnvironments     []string `json:"runtimeEnvironments" minItems:"1" doc:"运行环境，可包含自定义值"`
	DevelopmentEnvironments []string `json:"developmentEnvironments" minItems:"1" doc:"开发环境，可包含自定义值"`
	ReferenceStandardIDs    []string `json:"referenceStandardIds" minItems:"1" doc:"依据标准 ID"`
}

type CreateProjectInput struct {
	Body CreateProjectRequest
}

type ProjectOutput struct {
	Body projects.ProjectResponse
}

type ProjectListOutput struct {
	Body []projects.ProjectResponse
}

type ProjectDetailInput struct {
	Code string `path:"code" minLength:"5" maxLength:"6" pattern:"^R[0-9]{4,5}$" doc:"项目标识"`
}

type ProjectOptionsOutput struct {
	Body projects.ProjectOptionsResponse
}
