# ChenMeridian

本地测试管理工具，覆盖项目、测试项、用例、执行记录、问题单、测试报告和 Word 交付文档生成。

## 技术栈

- 后端：Go、Huma v2、GORM、pure Go SQLite、JWT
- 前端：Vite、React、React Router 8 SPA Data Mode、Tailwind CSS 4、shadcn/ui + Radix、TanStack Query/Table；动效 Animate UI + Motion（GSAP 兜底）
- 存储：SQLite 保存业务数据；`data/file-assets/` 保存接收文件；结构由显式 SQL migration 管理

## 本地运行

后端：

```powershell
go run ./cmd/chenmeridian
```

前端：

```powershell
cd web
npm run dev
```

常用地址：

- 后端 API 文档：`http://127.0.0.1:8787/docs`
- 健康检查：`http://127.0.0.1:8787/api/v1/health`
- 前端登录页：`http://localhost:5173/login`

初始账号：`admin / admin123`。

常用环境变量：

- `CHENMERIDIAN_DB_PATH`：SQLite 数据库路径，默认 `data/meridian.db`。
- `CHENMERIDIAN_ASSET_ROOT`：接收文件存储根目录，默认与数据库同目录下的 `file-assets`。

## 文档

- 需求与设计：[srs/README.md](srs/README.md)（项目规则入口：[CLAUDE.md](CLAUDE.md)）。
- 项目全景：[docs/项目记忆/项目全景.md](docs/项目记忆/项目全景.md)（定位、模块边界、数据模型、完成度与待确认口径）。
- 需求全景：[docs/项目记忆/需求全景.md](docs/项目记忆/需求全景.md)（按模块的需求结论、边界与已确认口径）。
- 可复用坑位：[docs/项目记忆.md](docs/项目记忆.md)（后端、前端、视觉交互、工具与跨会话）。

## 验证

后端：

```powershell
gofmt -w cmd internal migrations
go test ./...
go vet ./...
go build -o bin/chenmeridian.exe ./cmd/chenmeridian
```

前端：

```powershell
cd web
npm run check
```

文档（整理 srs/ 或 docs/ 后校验链接）：

```powershell
pwsh scripts/check-md-links.ps1
```

## 文档入口

- 需求与工程约定：[srs/README.md](srs/README.md)
- 可复用坑位：[docs/项目记忆.md](docs/项目记忆.md)
- 前端说明：[web/README.md](web/README.md)
- 迁移说明：[migrations/README.md](migrations/README.md)
