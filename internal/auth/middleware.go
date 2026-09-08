package auth

import (
	"encoding/json"
	"net/http"
	"strings"
)

var publicAPIPaths = map[string]struct{}{
	"/api/v1/auth/login": {},
	"/api/v1/health":     {},
}

type problemResponse struct {
	Title  string `json:"title"`
	Status int    `json:"status"`
	Detail string `json:"detail"`
}

func (s *Service) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/api/v1/") {
			next.ServeHTTP(w, r)
			return
		}
		if _, public := publicAPIPaths[r.URL.Path]; public {
			next.ServeHTTP(w, r)
			return
		}

		authorization := r.Header.Get("Authorization")
		if !strings.HasPrefix(authorization, "Bearer ") {
			writeProblem(w, http.StatusUnauthorized, "未登录", "请先登录后再访问接口")
			return
		}

		claims, err := s.ParseToken(strings.TrimPrefix(authorization, "Bearer "))
		if err != nil {
			writeProblem(w, http.StatusUnauthorized, "登录状态无效", "登录状态已过期，请重新登录")
			return
		}

		allowed, err := s.Authorize(claims, r.URL.Path, r.Method)
		if err != nil {
			writeProblem(w, http.StatusInternalServerError, "授权检查失败", "服务器执行授权策略失败")
			return
		}
		if !allowed {
			writeProblem(w, http.StatusForbidden, "没有权限", "当前角色不能访问该接口")
			return
		}

		next.ServeHTTP(w, r.WithContext(WithClaims(r.Context(), claims)))
	})
}

func writeProblem(w http.ResponseWriter, status int, title string, detail string) {
	w.Header().Set("Content-Type", "application/problem+json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(problemResponse{Title: title, Status: status, Detail: detail})
}
