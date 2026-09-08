package v1

import (
	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	authservice "chenmeridian/internal/auth"

	"chenmeridian/internal/api/v1/auth"
	"chenmeridian/internal/api/v1/health"
)

type Dependencies struct {
	DB         *gorm.DB
	Auth       *authservice.Service
	AppVersion string
}

func Register(api huma.API, deps Dependencies) {
	health.Register(api, deps.DB, deps.AppVersion)
	auth.Register(api, deps.Auth)
}
