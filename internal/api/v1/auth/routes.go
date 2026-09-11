package auth

import (
	"context"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	authservice "chenmeridian/internal/auth"
	"chenmeridian/internal/modules/users"
)

type Handler struct {
	service *authservice.Service
}

func Register(api huma.API, service *authservice.Service) {
	handler := &Handler{service: service}

	huma.Register(api, huma.Operation{
		OperationID: "login",
		Method:      http.MethodPost,
		Path:        "/api/v1/auth/login",
		Summary:     "登录",
		Description: "使用用户名和密码登录，成功后返回 JWT 访问令牌。",
		Tags:        []string{"认证授权"},
	}, handler.login)

	huma.Register(api, huma.Operation{
		OperationID: "get-current-user",
		Method:      http.MethodGet,
		Path:        "/api/v1/auth/me",
		Summary:     "获取当前用户",
		Description: "根据 JWT 获取当前登录用户信息。",
		Tags:        []string{"认证授权"},
	}, handler.currentUser)
}

func (h *Handler) login(ctx context.Context, input *LoginInput) (*LoginOutput, error) {
	result, err := h.service.Login(ctx, input.Body.Username, input.Body.Password)
	if err != nil {
		if errors.Is(err, users.ErrInvalidCredentials) {
			return nil, huma.Error401Unauthorized("用户名或密码错误")
		}
		return nil, huma.Error500InternalServerError("登录失败")
	}

	return &LoginOutput{
		Body: LoginResponse{
			AccessToken: result.Token,
			TokenType:   "Bearer",
			ExpiresAt:   result.ExpiresAt,
			User:        toUserResponse(result.User),
		},
	}, nil
}

func (h *Handler) currentUser(ctx context.Context, input *struct{}) (*CurrentUserOutput, error) {
	user, err := h.service.CurrentUser(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("登录状态无效")
	}
	return &CurrentUserOutput{Body: toUserResponse(user)}, nil
}

func toUserResponse(user users.User) UserResponse {
	return UserResponse{
		ID:          user.ID,
		Username:    user.Username,
		DisplayName: user.DisplayName,
		CreatedAt:   user.CreatedAt,
	}
}
