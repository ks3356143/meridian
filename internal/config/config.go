package config

import (
	"os"
	"path/filepath"
)

const (
	defaultAddr   = "127.0.0.1:8787"
	defaultDBName = "meridian.db"
)

type Config struct {
	Addr   string
	DBPath string
}

func Load() Config {
	return Config{
		Addr:   envOr("CHENMERIDIAN_ADDR", defaultAddr),
		DBPath: envOr("CHENMERIDIAN_DB_PATH", filepath.Join("data", defaultDBName)),
	}
}

func envOr(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
