# AGENTS.md

## 协作规则

1. 始终使用简体中文回复；README、架构设计、API 文档全部中文。
2. 每次会话开工先读取 [srs/12-跨会话记忆.md](srs/12-跨会话记忆.md)，恢复上次会话的任务与偏好。
3. 需求、模块边界和未确定事项先维护到 `srs/`，入口是 [srs/README.md](srs/README.md)。
4. 可复用坑位只记录到 [docs/项目记忆.md](docs/项目记忆.md)，格式固定为“现象、原因、规避方式”。
5. 浏览器视觉验证默认使用视觉模型：直接生成截图并查看截图，不再要求用户切换模型，也不再把 DOM 文本断言作为视觉验收结论。
6. 用户说“下班”时：先跑当前改动对应验证，再检查 `git status`，只提交本次相关文件，Commit 信息用中文，最后执行 `git push origin`；同时列出本次会话实际使用的 skills，检查其可用更新并提醒用户决定由代理更新还是用户更新，未获明确决定前不得升级、重装或删除 skills。验证失败或无远端时说明原因并停止。
7. ChenMeridian / Meridian 工具可以参考 [团队工具](http://47.108.230.220:8081/) 的理论、信息组织与交互思路；该条仅作为理念参考，不因此主动写代码或修改实现。
8. 用户说“开始工作”或要求打开前后端时：启动前必须分别检查全部后端 Go 依赖库（含 Huma v2、GORM、SQLite 驱动等）和全部前端 npm 依赖库是否有可用更新；有更新时升级到兼容的最新稳定版，更新 `go.mod`、`go.sum`、`package.json` 和 `package-lock.json`，完成对应构建或依赖一致性验证后再启动；无更新时直接构建启动或确认服务可用。启动阶段不扩展业务测试，由用户自行验证并反馈问题，收到问题再处理。
9. 尽量使用最新工具链与环境：PowerShell 7（pwsh）+ Windows Terminal，命令示例优先 pwsh 语法；文本检索用 ripgrep（rg）。
10. 必须看本文档的前端铁律，必须使用组件库。
11. 能用 MCP 坚决用 MCP：浏览器截图、视觉验证等任务开工先检查可用的 MCP 工具；能用就用。仅当当前会话确实没有对应 MCP 工具时，才允许用本机 Edge + Playwright 做截图和导航兑底，且必须说明原因。Playwright 不用于替代截图视觉判断。
12. 技术选型铁律：能使用成熟组件、成熟库或成熟方案，就必须使用，禁止先手搓。开发前先检查项目内已有封装，再搜索并核对官方文档、成熟开源库和主流生态方案；只有确无满足需求的成熟能力，或成熟方案需要过度改造时，才允许局部手写，并把原因、边界和验证方式记录到对应 SRS。
13. 浏览器自动化验证默认使用路由拦截夹具或专用测试项目，禁止在真实项目数据上触发保存、删除或状态变更；确需真实数据验证时必须先向用户说明范围并获得确认。
14. 终端执行器铁律：本项目运行在 Windows + PowerShell 环境，所有终端命令必须使用 `pwsh`。除非用户明确要求 POSIX、Git Bash 或 WSL，禁止把 `shell` 设置成 `bash`，也不得因复制示例或惯性误用 bash；一旦误用，必须停止当前命令、说明尚未执行，并立即改回 `pwsh` 重跑。

## 技术栈

- 后端：Go + Huma v2 + GORM + SQLite。
- SQLite 驱动：`github.com/glebarez/sqlite`，坚持 pure Go，不引入 CGO。
- 认证授权：bcrypt + JWT + Casbin RBAC。
- 数据主键：UUIDv7 字符串，由 Go 应用统一生成。
- 数据库结构：显式 SQL migration，禁止长期依赖 AutoMigrate。
- 前端：Vite + React 19 + React Router 8 SPA Data Mode + Tailwind CSS 4 + shadcn/ui/Radix + 炫酷组件库。
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
go list -u -m all
go get -u ./...
go mod tidy
gofmt -w cmd internal migrations
go test ./...
go vet ./...
go build -o bin/chenmeridian.exe ./cmd/chenmeridian

# 前端，在 web/ 执行
npm outdated
npm install
npm run check
npm run dev

# 联调地址
# 后端 API 文档：http://127.0.0.1:8787/docs
# 前端登录页：http://localhost:5173/login
```

## 依赖更新铁律

每次会话开工时（用户说“开始工作”或要求打开前后端），都必须先检查全部前后端依赖更新，禁止跳过检查直接启动或继续工作；若服务已经运行，依赖升级后必须重启服务。

1. 后端执行 `go list -u -m all`，检查全部 Go 依赖库，明确包含 Huma v2、GORM、SQLite 驱动等；有可用更新时执行 `go get -u ./...` 和 `go mod tidy`。优先升级到最新稳定版，仍须保持 pure Go SQLite 路线，不引入 CGO。
2. 前端在 `web/` 执行 `npm outdated`，检查全部 npm 依赖库，包含 React、Vite、React Router、Tailwind、TanStack、Radix、shadcn 相关依赖和构建工具等；有可用更新时升级到最新稳定版并更新 `package-lock.json`。React Router 相关包必须保持同一版本，不使用 `--force` 掩盖 peer dependency 冲突。
3. 依赖发生变化后，后端至少执行 `go test ./... -count=1`、`go vet ./...` 和 `go build -o bin/chenmeridian.exe ./cmd/chenmeridian`；前端至少执行 `npm run check`。验证通过后再启动服务。
4. 若最新版本与当前技术栈或运行环境不兼容，保留可用的最新兼容版本，并在汇报和当天跨会话记忆中记录未升级项、原因和后续处理条件。
5. 依赖检查结果和升级结果属于启动汇报内容；无更新时明确说明已检查，有更新时说明升级项和验证结果。

## Skills 更新提醒铁律

1. 每次用户说“下班”时，必须列出本次会话实际使用的 skills，并检查本地安装或插件市场是否有可用更新。
2. 必须提醒用户“这些 skills 需要你决定由代理更新还是由你更新”；在用户明确决定前，不得升级、重装、删除或替换 skills。
3. 无法自动检查更新来源时，必须说明检查限制，并至少列出本次使用的 skills 供用户决定。
4. 用户决定由代理更新后，再执行更新并验证技能可用；更新结果写入当次下班汇报。

## 验证铁律

每次代码修改后，先执行可运行验证，再汇报完成。汇报必须包含：

1. 已验证项。
2. 验证方法。
3. 剩余风险。
4. 用户人工浏览器审核步骤：前端可验证改动必须给出入口地址、前置状态、逐步操作和每步预期结果；纯后端或无浏览器界面的改动必须明确说明原因，并给出替代人工验证步骤。

前端页面改动至少执行类型检查、lint、格式检查和构建；涉及视觉时生成本机 Edge 截图，由视觉模型直接查看截图完成验收。接口改动必须用真实 HTTP 请求验证。数据库改动必须有迁移和集成测试。

## 禁止操作

1. 禁止为了省事把新接口堆进单个大文件；API 按业务域拆分。
2. 禁止把 HTML 转 OOXML 作为 Word 生成主方案。
3. 禁止在 MCP 截图/浏览器工具可用时手写自动化脚本；手写兑底仅限当前会话无对应 MCP 时，且必须使用本机 Edge channel 截图，不下载独立 Chromium，不用 DOM 文本断言替代视觉验收。

## 整理铁律

每完成一块功能，必须做一次 scoped 整理：

1. 删除本次产生的无用文件、临时文件、重复资源和死代码。
2. 精简并去重相关 MD；需求进 `srs/`，坑位进 `docs/项目记忆.md`，操作入口进 README，不重复堆内容。
3. 新增代码超过单文件职责、或继续往页面/大服务里堆逻辑时，按业务域、组件、API、仓储和样式分层拆分。
4. 检查目录命名、模块边界和公共抽象；只有重复或复杂度真实出现时才抽公共层。
5. 整理后必须跑对应验证；涉及文档与结构时检查链接和引用。

连续做多块功能时，在准备结束会话时主动提醒用户：“本次会话累计了多块功能，建议下班前做一次全局整理。”

## 前端铁律

能使用组件库组件的必须使用组件库不要手搓，手搓仅调整，能美化的都美化，前端布局和样式可以参考ui/ux pro max、frontend-design、taste-skills、garden-skills等

1. 一定要美观好看，舒服
1. 做前端时候一定要看 [srs/07-前端体验.md](srs/07-前端体验.md) 里面美化要求
1. 组件自定义样式必须使用 Vite CSS Modules：组件样式写在同目录同名 `.module.css`，例如 `Button.tsx` 对应 `Button.module.css`；参考 [Vite CSS Modules](https://vite.dev/guide/features.html#css-modules)。
1. 组件必须 `import styles from './Button.module.css'`，自定义 `className` 使用 `styles.xxx`；变体使用 `styles.primary` / `styles.ghost`，状态使用 `data-state` + CSS 属性选择器。
1. 禁止把新增自定义视觉样式继续写入全局 CSS 大文件或散落在 TSX 长工具类里；Tailwind 只用于少量布局工具和 shadcn/Radix 既有组合，主题、变体、状态和业务视觉归 CSS Module。
1. CSS Module 按组件职责拆分，选择器使用 camelCase 类名；跨组件第三方子元素用 `:global()`，禁止用标签选择器扩大影响面。
1. 涉及 React 19 并发能力、渲染性能、重渲染、包体积或数据请求优化的，必须优先参考本机已安装技能 `react19-concurrent-patterns` 和 `build-web-apps:react-best-practices`，再结合 [srs/21-前端性能优化策略.md](srs/21-前端性能优化策略.md) 做测量、修改和验收。Next.js、RSC 等不适用于本项目 Vite SPA 的规则只作思路参考，不得机械套用。

## 入口文档

- 需求索引：[srs/README.md](srs/README.md)
- 跨会话记忆：[srs/12-跨会话记忆.md](srs/12-跨会话记忆.md)
- 项目记忆：[docs/项目记忆.md](docs/项目记忆.md)
