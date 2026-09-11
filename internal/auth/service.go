package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"chenmeridian/internal/modules/settings"
	"chenmeridian/internal/modules/users"
)

const (
	issuer           = "chenmeridian"
	secretSettingKey = "jwt_secret"
)

type Service struct {
	userService *users.Service
	settings    *settings.Service
	tokenTTL    time.Duration
	secret      []byte
}

type LoginResult struct {
	Token     string
	ExpiresAt time.Time
	User      users.User
}

func NewService(
	db *gorm.DB,
	userService *users.Service,
	settingsService *settings.Service,
	tokenTTL time.Duration,
) (*Service, error) {
	if tokenTTL <= 0 {
		return nil, fmt.Errorf("令牌有效期必须大于 0")
	}

	ctx := context.Background()
	secretValue, err := settingsService.GetOrCreate(ctx, secretSettingKey, func() (string, error) {
		buffer := make([]byte, 32)
		if _, err := rand.Read(buffer); err != nil {
			return "", fmt.Errorf("生成 JWT 密钥失败: %w", err)
		}
		return base64.StdEncoding.EncodeToString(buffer), nil
	})
	if err != nil {
		return nil, err
	}
	secret, err := base64.StdEncoding.DecodeString(secretValue)
	if err != nil || len(secret) < 32 {
		return nil, fmt.Errorf("JWT 密钥格式无效")
	}

	return &Service{
		userService: userService,
		settings:    settingsService,
		tokenTTL:    tokenTTL,
		secret:      secret,
	}, nil
}

func (s *Service) Login(ctx context.Context, username string, password string) (LoginResult, error) {
	user, err := s.userService.Authenticate(ctx, username, password)
	if err != nil {
		return LoginResult{}, err
	}

	now := time.Now()
	token, expiresAt, err := s.issueToken(Claims{
		UserID:   user.ID,
		Username: user.Username,
	}, now)
	if err != nil {
		return LoginResult{}, err
	}
	return LoginResult{Token: token, ExpiresAt: expiresAt, User: user}, nil
}

func (s *Service) CurrentUser(ctx context.Context) (users.User, error) {
	claims, ok := ClaimsFromContext(ctx)
	if !ok {
		return users.User{}, errors.New("请求上下文缺少认证信息")
	}
	return s.userService.FindByID(ctx, claims.UserID)
}

func (s *Service) ParseToken(token string) (Claims, error) {
	return s.parseToken(token)
}
