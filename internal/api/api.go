package api

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
	"gorm.io/gorm"

	"chenmeridian/internal/api/v1"
	authservice "chenmeridian/internal/auth"
)

const Version = "0.0.1"

func New(db *gorm.DB, authService *authservice.Service) http.Handler {
	mux := http.NewServeMux()
	api := humago.New(mux, huma.DefaultConfig("ChenMeridian API", Version))

	v1.Register(api, v1.Dependencies{
		DB:         db,
		Auth:       authService,
		AppVersion: Version,
	})

	mux.Handle("/", http.RedirectHandler("/docs", http.StatusTemporaryRedirect))
	return authService.Middleware(mux)
}
