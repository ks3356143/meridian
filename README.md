# ChenMeridian 测试管理工具

这是一个个人使用的测试管理工具，目标是覆盖测试项、测试用例、测试执行记录、测试报告和 Word 文档生成的主流程。

## 当前技术栈

- 后端：Go + Huma + GORM + SQLite
- SQLite 驱动：pure Go 的 `github.com/glebarez/sqlite`
- 前端：Vite + React + Tailwind + shadcn/ui
- 文档生成：基于原始 DOCX 模板渲染 OOXML

## 目录说明

- `cmd/chenmeridian/`：程序入口
- `internal/api/`：Huma 接口定义
- `internal/config/`：本地配置
- `internal/database/`：SQLite 连接与数据库基础能力
- `migrations/`：数据库显式迁移脚本
- `web/`：前端工程
- `data/`：SQLite 数据库与本地运行数据
- `attachments/`：测试附件
- `reports/`：生成的报告
- `templates/`：Word 模板
- `knowledge-base/`：真实交付文档与参考资料
- `srs/`：需求记录

## 本地运行

```bash
go run ./cmd/chenmeridian
```

默认地址：`http://127.0.0.1:8787`

可用地址：

- API 文档：`http://127.0.0.1:8787/docs`
- OpenAPI：`http://127.0.0.1:8787/openapi.json`
- 健康检查：`http://127.0.0.1:8787/api/v1/health`

## 环境变量

- `CHENMERIDIAN_ADDR`：监听地址，默认 `127.0.0.1:8787`
- `CHENMERIDIAN_DB_PATH`：SQLite 路径，默认 `data/meridian.db`
