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

const (
	AdminUsername = "admin"
	AdminPassword = "admin123"
)

var (
	ErrInvalidCredentials = errors.New("用户名或密码错误")
	ErrUserNotFound       = errors.New("用户不存在")
	ErrUsernameTaken      = errors.New("用户名已存在")
	ErrLastUser           = errors.New("不能删除最后一个用户")
	ErrSelfDelete         = errors.New("不能删除当前登录用户")
	ErrUserInUse          = errors.New("该用户已被项目引用，请先从项目中移除")
	ErrAdminDelete        = errors.New("系统管理员账号不允许删除")
	ErrAdminPasswordFixed = errors.New("系统管理员密码固定，不允许修改")
)

type Service struct {
	repository *Repository
}

func NewService(db *gorm.DB) *Service {
	return &Service{repository: NewRepository(db)}
}

// EnsureAdmin 保证固定管理员存在，并在启动时将密码校正为 admin123。
func (s *Service) EnsureAdmin(ctx context.Context) error {
	passwordHash, err := HashPassword(AdminPassword)
	if err != nil {
		return err
	}

	user, err := s.repository.FindByUsername(ctx, AdminUsername)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		newID, err := id.New()
		if err != nil {
			return err
		}
		now := time.Now()
		if err := s.repository.Create(ctx, User{
			ID:           newID,
			Username:     AdminUsername,
			DisplayName:  "系统管理员",
			PasswordHash: passwordHash,
			CreatedAt:    now,
			UpdatedAt:    now,
		}); err != nil {
			return fmt.Errorf("创建初始管理员失败: %w", err)
		}
		return nil
	}
	if err != nil {
		return fmt.Errorf("查询初始管理员失败: %w", err)
	}

	needsUpdate := false
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(AdminPassword)) != nil {
		user.PasswordHash = passwordHash
		needsUpdate = true
	}
	if strings.TrimSpace(user.DisplayName) == "" {
		user.DisplayName = "系统管理员"
		needsUpdate = true
	}
	if needsUpdate {
		user.UpdatedAt = time.Now()
		if err := s.repository.Update(ctx, user); err != nil {
			return fmt.Errorf("校正初始管理员失败: %w", err)
		}
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

func (s *Service) List(ctx context.Context) ([]User, error) {
	users, err := s.repository.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("查询用户列表失败: %w", err)
	}
	return users, nil
}

func (s *Service) IsProtectedAdmin(ctx context.Context, userID string) (bool, error) {
	user, err := s.repository.FindByID(ctx, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, ErrUserNotFound
		}
		return false, fmt.Errorf("查询用户失败: %w", err)
	}
	return user.Username == AdminUsername, nil
}

type CreateInput struct {
	Username    string
	DisplayName string
	Password    string
}

func (s *Service) Create(ctx context.Context, input CreateInput) (User, error) {
	input.Username = strings.TrimSpace(input.Username)
	input.DisplayName = strings.TrimSpace(input.DisplayName)
	if input.Username == "" {
		return User{}, fmt.Errorf("用户名不能为空")
	}
	if input.DisplayName == "" {
		return User{}, fmt.Errorf("显示名称不能为空")
	}
	if len(input.Password) < 8 {
		return User{}, fmt.Errorf("密码至少需要 8 位")
	}
	if len(input.Password) > 128 {
		return User{}, fmt.Errorf("密码最多 128 位")
	}
	if len(input.Username) > 64 {
		return User{}, fmt.Errorf("用户名最多 64 个字符")
	}
	if len(input.DisplayName) > 64 {
		return User{}, fmt.Errorf("显示名称最多 64 个字符")
	}

	_, err := s.repository.FindByUsername(ctx, input.Username)
	if err == nil {
		return User{}, ErrUsernameTaken
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return User{}, fmt.Errorf("查询用户名失败: %w", err)
	}

	passwordHash, err := HashPassword(input.Password)
	if err != nil {
		return User{}, err
	}
	newID, err := id.New()
	if err != nil {
		return User{}, err
	}
	now := time.Now()
	user := User{
		ID:           newID,
		Username:     input.Username,
		DisplayName:  input.DisplayName,
		PasswordHash: passwordHash,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := s.repository.Create(ctx, user); err != nil {
		return User{}, fmt.Errorf("创建用户失败: %w", err)
	}
	return user, nil
}

type UpdateInput struct {
	DisplayName string
	Password    string
}

func (s *Service) Update(ctx context.Context, userID string, input UpdateInput) (User, error) {
	user, err := s.repository.FindByID(ctx, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return User{}, ErrUserNotFound
		}
		return User{}, fmt.Errorf("查询用户失败: %w", err)
	}
	if user.Username == AdminUsername && input.Password != "" {
		return User{}, ErrAdminPasswordFixed
	}

	input.DisplayName = strings.TrimSpace(input.DisplayName)
	if input.DisplayName != "" {
		user.DisplayName = input.DisplayName
	}
	if input.Password != "" {
		if len(input.Password) < 8 {
			return User{}, fmt.Errorf("密码至少需要 8 位")
		}
		if len(input.Password) > 128 {
			return User{}, fmt.Errorf("密码最多 128 位")
		}
		if len(input.DisplayName) > 64 {
			return User{}, fmt.Errorf("显示名称最多 64 个字符")
		}
		passwordHash, hashErr := HashPassword(input.Password)
		if hashErr != nil {
			return User{}, hashErr
		}
		user.PasswordHash = passwordHash
	}
	user.UpdatedAt = time.Now()

	if err := s.repository.Update(ctx, user); err != nil {
		return User{}, fmt.Errorf("更新用户失败: %w", err)
	}
	return user, nil
}

func (s *Service) Delete(ctx context.Context, userID string, currentClaimsUserID string) error {
	if userID == currentClaimsUserID {
		return ErrSelfDelete
	}

	user, err := s.repository.FindByID(ctx, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrUserNotFound
		}
		return fmt.Errorf("查询用户失败: %w", err)
	}
	if user.Username == AdminUsername {
		return ErrAdminDelete
	}

	count, err := s.repository.Count(ctx)
	if err != nil {
		return fmt.Errorf("查询用户数量失败: %w", err)
	}
	if count <= 1 {
		return ErrLastUser
	}

	if err := s.repository.Delete(ctx, userID); err != nil {
		return fmt.Errorf("删除用户失败: %w", err)
	}
	return nil
}

func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("生成密码哈希失败: %w", err)
	}
	return string(hash), nil
}
