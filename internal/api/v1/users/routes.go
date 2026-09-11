package users

import (
	"context"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	authservice "chenmeridian/internal/auth"
	"chenmeridian/internal/modules/projects"
	"chenmeridian/internal/modules/users"
)

type Handler struct {
	userService    *users.Service
	projectService *projects.Service
}

func Register(api huma.API, userService *users.Service, projectService *projects.Service, authSvc *authservice.Service) {
	handler := &Handler{userService: userService, projectService: projectService}

	huma.Register(api, huma.Operation{
		OperationID: "list-users",
		Method:      http.MethodGet,
		Path:        "/api/v1/users",
		Summary:     "获取用户列表",
		Tags:        []string{"用户管理"},
	}, handler.list)

	huma.Register(api, huma.Operation{
		OperationID: "create-user",
		Method:      http.MethodPost,
		Path:        "/api/v1/users",
		Summary:     "创建用户",
		Tags:        []string{"用户管理"},
	}, handler.create)

	huma.Register(api, huma.Operation{
		OperationID: "update-user",
		Method:      http.MethodPut,
		Path:        "/api/v1/users/{id}",
		Summary:     "更新用户",
		Tags:        []string{"用户管理"},
	}, handler.update)

	huma.Register(api, huma.Operation{
		OperationID: "delete-user",
		Method:      http.MethodDelete,
		Path:        "/api/v1/users/{id}",
		Summary:     "删除用户",
		Tags:        []string{"用户管理"},
	}, handler.delete)
}

func (h *Handler) list(ctx context.Context, input *struct{}) (*UserListOutput, error) {
	users, err := h.userService.List(ctx)
	if err != nil {
		return nil, huma.Error500InternalServerError("查询用户列表失败")
	}
	var responses []ManagedUserResponse
	for _, u := range users {
		responses = append(responses, toResponse(u))
	}
	if responses == nil {
		responses = []ManagedUserResponse{}
	}
	output := &UserListOutput{}
	output.Body.Users = responses
	return output, nil
}

func (h *Handler) create(ctx context.Context, input *CreateUserInput) (*CreateUserOutput, error) {
	user, err := h.userService.Create(ctx, users.CreateInput{
		Username:    input.Body.Username,
		DisplayName: input.Body.DisplayName,
		Password:    input.Body.Password,
	})
	if err != nil {
		if errors.Is(err, users.ErrUsernameTaken) {
			return nil, huma.Error409Conflict("用户名已存在")
		}
		return nil, huma.Error400BadRequest(err.Error())
	}
	return &CreateUserOutput{Body: toResponse(user)}, nil
}

func (h *Handler) update(ctx context.Context, input *UpdateUserInput) (*UpdateUserOutput, error) {
	user, err := h.userService.Update(ctx, input.ID, users.UpdateInput{
		DisplayName: input.Body.DisplayName,
		Password:    input.Body.Password,
	})
	if err != nil {
		if errors.Is(err, users.ErrUserNotFound) {
			return nil, huma.Error404NotFound("用户不存在")
		}
		return nil, huma.Error400BadRequest(err.Error())
	}
	return &UpdateUserOutput{Body: toResponse(user)}, nil
}

func (h *Handler) delete(ctx context.Context, input *DeleteUserInput) (*struct{}, error) {
	claims, ok := authservice.ClaimsFromContext(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("未登录")
	}

	// 检查用户是否被项目引用
	inUse, err := h.projectService.IsUserReferenced(ctx, input.ID)
	if err != nil {
		return nil, huma.Error500InternalServerError("检查用户引用失败")
	}
	if inUse {
		return nil, huma.Error409Conflict("该用户已被项目引用，请先从项目中移除")
	}

	if err := h.userService.Delete(ctx, input.ID, claims.UserID); err != nil {
		if errors.Is(err, users.ErrSelfDelete) {
			return nil, huma.Error400BadRequest("不能删除当前登录用户")
		}
		if errors.Is(err, users.ErrLastUser) {
			return nil, huma.Error400BadRequest("不能删除最后一个用户")
		}
		if errors.Is(err, users.ErrUserNotFound) {
			return nil, huma.Error404NotFound("用户不存在")
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, huma.Error404NotFound("用户不存在")
		}
		return nil, huma.Error500InternalServerError("删除用户失败")
	}
	return nil, nil
}

func toResponse(user users.User) ManagedUserResponse {
	return ManagedUserResponse{
		ID:          user.ID,
		Username:    user.Username,
		DisplayName: user.DisplayName,
		CreatedAt:   user.CreatedAt,
	}
}
