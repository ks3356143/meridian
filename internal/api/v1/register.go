package v1

import (
	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	authservice "chenmeridian/internal/auth"

	assetapi "chenmeridian/internal/api/v1/assets"
	"chenmeridian/internal/api/v1/auth"
	"chenmeridian/internal/api/v1/health"
	projectapi "chenmeridian/internal/api/v1/projects"
	requirementapi "chenmeridian/internal/api/v1/requirements"
	userapi "chenmeridian/internal/api/v1/users"
	assetservice "chenmeridian/internal/modules/assets"
	projectservice "chenmeridian/internal/modules/projects"
	requirementservice "chenmeridian/internal/modules/requirements"
	userservice "chenmeridian/internal/modules/users"
)

type Dependencies struct {
	DB         *gorm.DB
	Auth       *authservice.Service
	AssetRoot  string
	AppVersion string
}

func Register(api huma.API, deps Dependencies) {
	health.Register(api, deps.DB, deps.AppVersion)
	auth.Register(api, deps.Auth)
	projectapi.Register(api, projectservice.NewService(deps.DB))
	assetapi.Register(api, assetservice.NewService(deps.DB, deps.AssetRoot))
	requirementapi.Register(api, requirementservice.NewService(deps.DB, deps.AssetRoot))
	userapi.Register(api, userservice.NewService(deps.DB), projectservice.NewService(deps.DB), deps.Auth)
}
