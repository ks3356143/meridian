# AGENTS.md

## 协作规则

1. 始终使用简体中文回复；README、架构设计、API 文档全部中文。
2. 每次会话开工先读取 [srs/12-跨会话记忆.md](srs/12-跨会话记忆.md)，恢复上次会话的任务与偏好。
3. 需求、模块边界和未确定事项先维护到 `srs/`，入口是 [srs/README.md](srs/README.md)。
4. 可复用坑位只记录到 [docs/项目记忆.md](docs/项目记忆.md)，格式固定为“现象、原因、规避方式”。
5. 每次准备截图前，先提示用户切换到支持图片输入的模型；确认后再生成和查看截图。
6. 用户说“下班”时：先跑当前改动对应验证，再检查 `git status`，只提交本次相关文件，Commit 信息用中文，最后执行 `git push origin`；验证失败或无远端时说明原因并停止。
7. ChenMeridian / Meridian 工具可以参考 [团队工具](http://47.108.230.220:8081/) 的理论、信息组织与交互思路；该条仅作为理念参考，不因此主动写代码或修改实现。

## 技术栈

- 后端：Go + Huma v2 + GORM + SQLite。
- SQLite 驱动：`github.com/glebarez/sqlite`，坚持 pure Go，不引入 CGO。
- 认证授权：bcrypt + JWT + Casbin RBAC。
- 数据主键：UUIDv7 字符串，由 Go 应用统一生成。
- 数据库结构：显式 SQL migration，禁止长期依赖 AutoMigrate。
- 前端：Vite + React 19 + React Router 8 SPA Data Mode + Tailwind CSS 4 + shadcn/ui/Radix。
- 组件库铁律：能使用成熟组件库的交互组件必须使用组件库。项目内优先 shadcn/ui 与 Radix UI；表格、路由、数据等场景使用 TanStack、React Router 等对应专业组件库。仅纯展示、布局或确无组件库能力时允许手写，且必须补齐无障碍、键盘操作和微动效。
- 路由：使用 `createBrowserRouter` 和 `RouterProvider`；页面用 lazy route，目录使用传统 `web/src`。
- 状态与数据：Zustand + TanStack Query + TanStack Table。
- 动效：GSAP + `@gsap/react`，动画必须尊重 reduced motion。
- 主题：默认浅色，支持深浅色切换。
- 提示：统一使用 `sonner`。
- 前端检查：`oxlint` + `oxfmt`，不使用 Prettier/ESLint。
- Word：原始 DOCX 模板 + 结构化数据 + Go 渲染 OOXML。

## 常用命令

```powershell
# 后端
gofmt -w cmd internal migrations
go test ./...
go vet ./...
go build -o bin/chenmeridian.exe ./cmd/chenmeridian

# 前端，在 web/ 执行
npm run check
npm run dev

# 联调地址
# 后端 API 文档：http://127.0.0.1:8787/docs
# 前端登录页：http://localhost:5173/login
```

## 验证铁律

每次代码修改后，先执行可运行验证，再汇报完成。汇报必须包含：

1. 已验证项。
2. 验证方法。
3. 剩余风险。

前端页面改动至少执行类型检查、lint、格式检查和构建；涉及视觉时用本机 Edge 截图检查。接口改动必须用真实 HTTP 请求验证。数据库改动必须有迁移和集成测试。

## 禁止操作

1. 禁止为了省事把新接口堆进单个大文件；API 按业务域拆分。
2. 禁止把 HTML 转 OOXML 作为 Word 生成主方案。
3. Playwright 页面检查使用本机 Edge channel，不下载独立 Chromium。

## 入口文档

- 需求索引：[srs/README.md](srs/README.md)
- 跨会话记忆：[srs/12-跨会话记忆.md](srs/12-跨会话记忆.md)
- 项目记忆：[docs/项目记忆.md](docs/项目记忆.md)
