package testitems

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	testitemsservice "chenmeridian/internal/modules/testitems"
)

type IssueListOutput struct {
	Body struct {
		Items []testitemsservice.Issue `json:"items"`
	}
}

type IssueOutput struct {
	Body testitemsservice.Issue
}

type IssueIDInput struct {
	ID string `path:"id"`
}

type IssueListInput struct {
	Code    string `path:"code"`
	RoundID string `query:"roundId" doc:"轮次 id；传 all 或省略时返回全部"`
}

type CreateIssueInput struct {
	Code string `path:"code"`
	Body struct {
		RoundID        string `json:"roundId,omitempty"`
		TestItemID     string `json:"testItemId"`
		SheetID        string `json:"sheetId,omitempty"`
		SheetName      string `json:"sheetName,omitempty"`
		CheckID        string `json:"checkId,omitempty"`
		CheckTitle     string `json:"checkTitle,omitempty"`
		TargetDocument string `json:"targetDocument,omitempty"`
		Title          string `json:"title"`
		Description    string `json:"description,omitempty"`
		DefectType     string `json:"defectType,omitempty"`
		Level          string `json:"level,omitempty"`
		ClosureMethod  string `json:"closureMethod,omitempty"`
	}
}

type UpdateIssueInputBody struct {
	ID   string `path:"id"`
	Body struct {
		Title         *string `json:"title,omitempty"`
		Description   *string `json:"description,omitempty"`
		Level         *string `json:"level,omitempty"`
		ClosureMethod *string `json:"closureMethod,omitempty"`
		Status        *string `json:"status,omitempty"`
		ClosureNote   *string `json:"closureNote,omitempty"`
	}
}

func registerIssues(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "list-issues",
		Method:      http.MethodGet,
		Path:        "/api/v1/projects/{code}/issues",
		Summary:     "问题单列表",
		Description: "按项目与轮次列出正式问题单；当前主要来源为 DC 文档审查不通过项。",
		Tags:        []string{"问题单"},
	}, func(ctx context.Context, input *IssueListInput) (*IssueListOutput, error) {
		projectID, err := handler.projectID(ctx, input.Code)
		if err != nil {
			return nil, toAPIError(err, "项目不存在")
		}
		issues, err := handler.service.ListIssues(ctx, projectID, input.RoundID)
		if err != nil {
			return nil, toAPIError(err, "查询问题单失败")
		}
		output := &IssueListOutput{}
		output.Body.Items = nonNil(issues)
		return output, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "create-issue",
		Method:      http.MethodPost,
		Path:        "/api/v1/projects/{code}/issues",
		Summary:     "立问题单",
		Description: "从 DC 审查不通过项创建正式问题单；同一检查项只允许一个未关闭问题单。",
		Tags:        []string{"问题单"},
	}, func(ctx context.Context, input *CreateIssueInput) (*IssueOutput, error) {
		projectID, err := handler.projectID(ctx, input.Code)
		if err != nil {
			return nil, toAPIError(err, "项目不存在")
		}
		issue, err := handler.service.CreateIssue(ctx, testitemsservice.CreateIssueInput{
			ProjectID: projectID, RoundID: input.Body.RoundID, TestItemID: input.Body.TestItemID,
			SheetID: input.Body.SheetID, SheetName: input.Body.SheetName,
			CheckID: input.Body.CheckID, CheckTitle: input.Body.CheckTitle,
			TargetDoc: input.Body.TargetDocument, Title: input.Body.Title,
			Description: input.Body.Description, DefectType: input.Body.DefectType,
			Level: input.Body.Level, ClosureMethod: input.Body.ClosureMethod,
			CreatedBy: currentUserID(ctx),
		})
		if err != nil {
			return nil, toAPIError(err, "创建问题单失败")
		}
		return &IssueOutput{Body: issue}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "get-issue",
		Method:      http.MethodGet,
		Path:        "/api/v1/issues/{id}",
		Summary:     "问题单详情",
		Tags:        []string{"问题单"},
	}, func(ctx context.Context, input *IssueIDInput) (*IssueOutput, error) {
		issue, err := handler.service.GetIssue(ctx, input.ID)
		if err != nil {
			return nil, toAPIError(err, "查询问题单失败")
		}
		return &IssueOutput{Body: issue}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "update-issue",
		Method:      http.MethodPatch,
		Path:        "/api/v1/issues/{id}",
		Summary:     "更新问题单",
		Description: "更新问题单内容，或关闭/重新打开；关闭必须填写整改说明。",
		Tags:        []string{"问题单"},
	}, func(ctx context.Context, input *UpdateIssueInputBody) (*IssueOutput, error) {
		issue, err := handler.service.UpdateIssue(ctx, input.ID, testitemsservice.UpdateIssueInput{
			Title: input.Body.Title, Description: input.Body.Description, Level: input.Body.Level,
			ClosureMethod: input.Body.ClosureMethod, Status: input.Body.Status,
			ClosureNote: input.Body.ClosureNote, UpdatedBy: currentUserID(ctx),
		})
		if err != nil {
			return nil, toAPIError(err, "更新问题单失败")
		}
		return &IssueOutput{Body: issue}, nil
	})
}
