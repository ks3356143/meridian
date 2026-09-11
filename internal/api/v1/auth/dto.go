package auth

import "time"

type UserResponse struct {
	ID          string    `json:"id" doc:"用户 ID"`
	Username    string    `json:"username" doc:"用户名"`
	DisplayName string    `json:"displayName" doc:"显示名称"`
	CreatedAt   time.Time `json:"createdAt" doc:"创建时间"`
}

type LoginRequest struct {
	Username string `json:"username" doc:"用户名"`
	Password string `json:"password" doc:"密码"`
}

type LoginResponse struct {
	AccessToken string       `json:"accessToken" doc:"JWT 访问令牌"`
	TokenType   string       `json:"tokenType" enum:"Bearer" doc:"令牌类型"`
	ExpiresAt   time.Time    `json:"expiresAt" doc:"过期时间"`
	User        UserResponse `json:"user" doc:"当前用户"`
}

type LoginInput struct {
	Body LoginRequest
}

type LoginOutput struct {
	Body LoginResponse
}

type CurrentUserOutput struct {
	Body UserResponse
}
