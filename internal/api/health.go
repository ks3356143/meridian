package api

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

type HealthResponse struct {
	Status        string    `json:"status" enum:"ok" doc:"服务状态"`
	Version       string    `json:"version" doc:"应用版本"`
	SQLiteVersion string    `json:"sqliteVersion" doc:"SQLite 版本"`
	CheckedAt     time.Time `json:"checkedAt" doc:"检查时间"`
}

type HealthOutput struct {
	Body HealthResponse
}

func registerHealth(api huma.API, db *gorm.DB) {
	huma.Register(api, huma.Operation{
		OperationID: "get-health",
		Method:      http.MethodGet,
		Path:        "/api/v1/health",
		Summary:     "健康检查",
		Description: "检查应用服务状态，并通过 GORM 查询 SQLite 版本以验证数据库链路可用。",
		Tags:        []string{"系统"},
	}, func(ctx context.Context, input *struct{}) (*HealthOutput, error) {
		var sqliteVersion string
		if err := db.WithContext(ctx).Raw("SELECT sqlite_version()").Scan(&sqliteVersion).Error; err != nil {
			return nil, huma.Error500InternalServerError("数据库查询失败")
		}

		return &HealthOutput{
			Body: HealthResponse{
				Status:        "ok",
				Version:       version,
				SQLiteVersion: sqliteVersion,
				CheckedAt:     time.Now(),
			},
		}, nil
	})
}
