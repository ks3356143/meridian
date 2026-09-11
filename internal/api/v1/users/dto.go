package users

import "time"

type ManagedUserResponse struct {
	ID          string    `json:"id" doc:"用户 ID"`
	Username    string    `json:"username" doc:"用户名"`
	DisplayName string    `json:"displayName" doc:"显示名称"`
	CreatedAt   time.Time `json:"createdAt" doc:"创建时间"`
}

type UserListOutput struct {
	Body struct {
		Users []ManagedUserResponse `json:"users"`
	}
}

type CreateUserRequest struct {
	Username    string `json:"username" doc:"用户名"`
	DisplayName string `json:"displayName" doc:"显示名称"`
	Password    string `json:"password" doc:"密码"`
}

type CreateUserInput struct {
	Body CreateUserRequest
}

type CreateUserOutput struct {
	Body ManagedUserResponse
}

type UpdateUserRequest struct {
	DisplayName string `json:"displayName" doc:"显示名称"`
	Password    string `json:"password" doc:"新密码（留空不修改）"`
}

type UpdateUserInput struct {
	ID   string `path:"id"`
	Body UpdateUserRequest
}

type UpdateUserOutput struct {
	Body ManagedUserResponse
}

type DeleteUserInput struct {
	ID string `path:"id"`
}
