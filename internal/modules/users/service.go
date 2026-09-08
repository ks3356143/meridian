package users

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"chenmeridian/internal/id"
)

var (
	ErrInvalidCredentials = errors.New("用户名或密码错误")
	ErrUserNotFound       = errors.New("用户不存在")
)

type Service struct {
	repository *Repository
}

func NewService(db *gorm.DB) *Service {
	return &Service{repository: NewRepository(db)}
}

// EnsureAdmin 只在用户表为空时创建初始管理员，不在每次启动时覆盖密码。
func (s *Service) EnsureAdmin(ctx context.Context, username string, password string) error {
	username = strings.TrimSpace(username)
	if username == "" {
		return fmt.Errorf("初始管理员用户名不能为空")
	}
	if len(password) < 8 {
		return fmt.Errorf("初始管理员密码至少需要 8 位")
	}

	count, err := s.repository.Count(ctx)
	if err != nil {
		return fmt.Errorf("查询用户数量失败: %w", err)
	}
	if count > 0 {
		return nil
	}

	passwordHash, err := HashPassword(password)
	if err != nil {
		return err
	}
	newID, err := id.New()
	if err != nil {
		return err
	}
	now := time.Now()
	if err := s.repository.Create(ctx, User{
		ID:           newID,
		Username:     username,
		DisplayName:  "系统管理员",
		PasswordHash: passwordHash,
		Role:         "admin",
		CreatedAt:    now,
		UpdatedAt:    now,
	}); err != nil {
		return fmt.Errorf("创建初始管理员失败: %w", err)
	}
	return nil
}

func (s *Service) Authenticate(ctx context.Context, username string, password string) (User, error) {
	user, err := s.repository.FindByUsername(ctx, strings.TrimSpace(username))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return User{}, ErrInvalidCredentials
		}
		return User{}, fmt.Errorf("查询用户失败: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return User{}, ErrInvalidCredentials
	}
	return user, nil
}

func (s *Service) FindByID(ctx context.Context, userID string) (User, error) {
	user, err := s.repository.FindByID(ctx, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return User{}, ErrUserNotFound
		}
		return User{}, fmt.Errorf("查询用户失败: %w", err)
	}
	return user, nil
}

func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("生成密码哈希失败: %w", err)
	}
	return string(hash), nil
}
