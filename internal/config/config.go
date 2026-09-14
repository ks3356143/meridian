package config

import (
	"os"
	"path/filepath"
	"time"
)

const (
	defaultAddr     = "127.0.0.1:8787"
	defaultDBName   = "meridian.db"
	defaultAssetDir = "file-assets"
	defaultTokenTTL = 8 * time.Hour
)

type Config struct {
	Addr      string
	DBPath    string
	AssetRoot string
	TokenTTL  time.Duration
}

func Load() Config {
	dbPath := envOr("CHENMERIDIAN_DB_PATH", filepath.Join("data", defaultDBName))
	return Config{
		Addr:      envOr("CHENMERIDIAN_ADDR", defaultAddr),
		DBPath:    dbPath,
		AssetRoot: envOr("CHENMERIDIAN_ASSET_ROOT", filepath.Join(filepath.Dir(dbPath), defaultAssetDir)),
		TokenTTL:  durationEnvOr("CHENMERIDIAN_TOKEN_TTL", defaultTokenTTL),
	}
}

func envOr(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func durationEnvOr(key string, fallback time.Duration) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}
