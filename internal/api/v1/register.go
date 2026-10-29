package v1

import (
	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"

	authservice "chenmeridian/internal/auth"

	assetapi "chenmeridian/internal/api/v1/assets"
	"chenmeridian/internal/api/v1/auth"
	contentblockapi "chenmeridian/internal/api/v1/contentblocks"
	"chenmeridian/internal/api/v1/health"
	projectapi "chenmeridian/internal/api/v1/projects"
	quickissueapi "chenmeridian/internal/api/v1/quickissues"
	requirementapi "chenmeridian/internal/api/v1/requirements"
	testitemapi "chenmeridian/internal/api/v1/testitems"
	userapi "chenmeridian/internal/api/v1/users"
	assetservice "chenmeridian/internal/modules/assets"
	contentblockservice "chenmeridian/internal/modules/contentblocks"
	"chenmeridian/internal/modules/officecli"
	projectservice "chenmeridian/internal/modules/projects"
	quickissueservice "chenmeridian/internal/modules/quickissues"
	requirementservice "chenmeridian/internal/modules/requirements"
	testitemservice "chenmeridian/internal/modules/testitems"
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
	contentBlockService := contentblockservice.NewService(deps.DB, contentAssetRoot(deps.AssetRoot))
	contentblockapi.Register(api, contentBlockService)
	requirementapi.Register(api, requirementservice.NewService(deps.DB, deps.AssetRoot).WithBodyBuilder(requirementBodyBuilder{
		blocks: contentBlockService,
		source: officecli.NewClient(""),
	}))
	testitemapi.Register(api, testitemservice.NewService(deps.DB).WithBlocks(contentBlockService))
	quickissueapi.Register(api, quickissueservice.NewService(deps.DB))
	userapi.Register(api, userservice.NewService(deps.DB), projectservice.NewService(deps.DB), deps.Auth)
}
