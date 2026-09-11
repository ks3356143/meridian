package auth

import "context"

type contextKey struct{}

type Claims struct {
	UserID   string `json:"uid"`
	Username string `json:"username"`
}

func WithClaims(ctx context.Context, claims Claims) context.Context {
	return context.WithValue(ctx, contextKey{}, claims)
}

func ClaimsFromContext(ctx context.Context) (Claims, bool) {
	value, ok := ctx.Value(contextKey{}).(Claims)
	return value, ok
}
