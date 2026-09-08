package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type tokenClaims struct {
	UserID   string `json:"uid"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func (s *Service) issueToken(userClaims Claims, now time.Time) (string, time.Time, error) {
	expiresAt := now.Add(s.tokenTTL)
	claims := tokenClaims{
		UserID:   userClaims.UserID,
		Username: userClaims.Username,
		Role:     userClaims.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuer,
			Subject:   userClaims.UserID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}

	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("签发令牌失败: %w", err)
	}
	return token, expiresAt, nil
}

func (s *Service) parseToken(token string) (Claims, error) {
	parsed, err := jwt.ParseWithClaims(
		token,
		&tokenClaims{},
		func(token *jwt.Token) (any, error) { return s.secret, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(issuer),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return Claims{}, fmt.Errorf("令牌无效: %w", err)
	}

	claims, ok := parsed.Claims.(*tokenClaims)
	if !ok || !parsed.Valid || claims.UserID == "" {
		return Claims{}, fmt.Errorf("令牌声明无效")
	}
	return Claims{UserID: claims.UserID, Username: claims.Username, Role: claims.Role}, nil
}
