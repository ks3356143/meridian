# 技术栈与工程验证

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
- 动效优先级（2026-11-09 用户口径，动效是基本必要项——默认必须有，讨论的是形式与强度不是要不要做）：① Animate UI（`@animate-ui/react`，免费开源，已装）成熟原语直接用；② 参考 Motion UI（motion.dev/ui，Motion+ 付费）的设计，用 Motion（`motion` 包，免费 MIT，已装）免费 API 实现，**禁止安装付费私有包、禁止复制源码**；③ 网上设计参考与 OpenDesign 参考，借鉴手法、落地仍走 ①②；④ GSAP 兜底（几何测量、时间轴编排、品牌持续视觉，现仅剩三处）。Animate UI 已自带的能力（texts、carousel、cursor、scroll-progress、pinned-list）优先用 Animate UI 版本，不得重复自造。
- 手搓的边界：自写 CSS `@keyframes`、手写动画状态机属于手搓，禁止；用 Motion 免费 API 实现属于允许范围。完整边界见 [srs/07-前端体验/03-品牌与动效/01-动效原则与验收.md](../../srs/07-前端体验/03-品牌与动效/01-动效原则与验收.md)。
- 拖拽排序：`@dnd-kit/core` + `@dnd-kit/sortable`（内置键盘传感器与无障碍，禁止手搓拖拽）。
- 主题：默认浅色，支持深浅色切换。
- 提示：统一使用 `sonner`。
- 前端检查：`oxlint` + `oxfmt`，不使用 Prettier/ESLint。
- Word：原始 DOCX 模板 + 结构化数据 + Go 渲染 OOXML。
- 外部文档引擎：OfficeCLI（可选、非核心依赖、不常驻进程），只承担模板合并、OpenXML schema 校验和 DOCX 页面预览；边界、集成约定与前置验证见 [srs/03-技术路线.md](../../srs/03-技术路线.md)。

## 工具偏好（2026-11-03）

- 内容检索用 `rg`（ripgrep），找文件用 `fd`，不用系统自带 `grep` / `find` / `dir`。
- 终端统一 `pwsh`，不混 bash 语法。
- 本机已装 bun、python、node、go、rust，mise shims 在 `C:\Users\31429\AppData\Roaming\CherryStudio\Toolchain\mise\shims`；按任务选更快更合适的运行时。
- 工具只提升效率，不改技术栈：前端依赖安装与构建仍用 `npm` + `package-lock.json`，不擅自换成 bun / pnpm。

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

# 文档，在仓库根目录执行（整理 srs/ 或 docs/ 后校验 Markdown 相对链接）
pwsh scripts/check-md-links.ps1

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
5. 同一时机必须检查 OfficeCLI 更新：用 `npm view @officecli/officecli version` 对比本机 `officecli --version`，有更新即升级到最新稳定版；升级后顺手过一遍 `officecli --help`、`officecli help docx`（`xlsx`/`pptx` 同理）和本地 skill 文件，把新增命令、快捷能力与版本变化记入 [srs/03-技术路线.md](../../srs/03-技术路线.md)。OfficeCLI 一旦接入文档生成链路，升级后必须补跑保真度回归（dump → 回放 → `validate` → 截图对比）再交付。
6. 依赖检查结果和升级结果属于启动汇报内容；无更新时明确说明已检查，有更新时说明升级项和验证结果。

## Skills 更新提醒铁律

1. 每次用户说“下班”时，必须列出本次会话实际使用的 skills，并检查本地安装或插件市场是否有可用更新（Claude 侧可用 `claude plugin list`、`claude plugin update <plugin>`；个人技能直接检查 `~/.claude/skills` 来源）。
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
