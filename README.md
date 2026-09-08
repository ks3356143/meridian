# ChenMeridian 测试管理工具

个人使用的本地测试管理工具，目标覆盖测试项、测试用例、执行记录、问题单、测试报告和 Word 文档生成。

## 技术栈

- 后端：Go + Huma v2 + GORM + SQLite
- SQLite 驱动：pure Go 的 `github.com/glebarez/sqlite`
- 认证授权：bcrypt + JWT + Casbin RBAC
- 前端：Vite + React + React Router 8 SPA Data Mode + Tailwind CSS + shadcn/ui/Radix
- 状态与数据：Zustand + TanStack Query
- 动效：GSAP + `@gsap/react`
- 检查：OXC（`oxlint` + `oxfmt`）

## 本地运行

后端：

```powershell
go run ./cmd/chenmeridian
```

前端开发服务：

```powershell
cd web
npm run dev
```

地址：

- 后端 API 文档：`http://127.0.0.1:8787/docs`
- 健康检查：`http://127.0.0.1:8787/api/v1/health`
- 前端登录页：`http://localhost:5173/login`

初始账号：

- 用户名：`admin`
- 密码：`admin123`

可用环境变量覆盖初始账号、监听地址、数据库路径和令牌有效期。

## 验证命令

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

## 目录

- `cmd/chenmeridian/`：后端入口
- `internal/`：后端模块
- `migrations/`：显式数据库迁移
- `web/src/`：传统 Vite SPA 前端源码
- `srs/`：需求和工程约定
- `knowledge-base/`：真实交付文档和参考资料
- `docs/`：项目记忆和开发资料
- `data/`、`attachments/`、`templates/`、`reports/`：本地运行数据目录
