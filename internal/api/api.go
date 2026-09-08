package api

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
	"gorm.io/gorm"
)

const version = "0.0.1"

func New(db *gorm.DB) http.Handler {
	mux := http.NewServeMux()
	api := humago.New(mux, huma.DefaultConfig("ChenMeridian API", version))

	registerRoutes(api, db)

	mux.Handle("/", http.RedirectHandler("/docs", http.StatusTemporaryRedirect))
	return mux
}

func registerRoutes(api huma.API, db *gorm.DB) {
	registerHealth(api, db)
}
