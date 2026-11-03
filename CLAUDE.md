# CLAUDE.md

> 本文件是 ChenMeridian 唯一的 Agent 规则入口。规则正文按主题拆分在 `.claude/rules/`，Claude Code 每次会话启动时自动加载，单篇不超过 200 行。开工先读本文件与 [srs/12-跨会话记忆.md](srs/12-跨会话记忆.md)，再按需下钻。

## 规则索引

- [.claude/rules/01-collaboration.md](.claude/rules/01-collaboration.md) —— 15 条协作规则与实现自主。
- [.claude/rules/02-engineering.md](.claude/rules/02-engineering.md) —— 技术栈、常用命令、依赖更新铁律、Skills 提醒、验证铁律。
- [.claude/rules/03-efficiency.md](.claude/rules/03-efficiency.md) —— 执行效率铁律、禁止操作、整理铁律。
- [.claude/rules/04-frontend.md](.claude/rules/04-frontend.md) —— 模块化与按需加载、前端铁律。
- [.claude/rules/05-knowledge.md](.claude/rules/05-knowledge.md) —— 知识库采集与取用规则。

## Claude 侧固定入口

- 持久记忆：`C:\Users\31429\.claude\projects\E--Chentools---ChenMeridian\memory\MEMORY.md`（用户画像、工具偏好、迁移与工具指针）。只放跨会话事实与指针，不复制 SRS 正文；项目事实以 `srs/` 为准，坑位以 `docs/项目记忆/` 为准。
- 自定义技能：`chenmeridian-session-workflow`（开工/下班流程）、`chenmeridian-frontend-delivery`（前端交付），位于全局 `~/.claude/skills`。
- 项目 MCP：仓库根 [.mcp.json](.mcp.json)（shadcn/radix）；全局 MCP 含 officecli（指向 CherryStudio mise）、ms-office-mcp 等；桌面 GUI 统一用 `agent-desktop` CLI，不再配置 windows-mcp。
- 技能以全局 `~/.claude/skills` 为准。

## 入口文档

- 需求索引：[srs/README.md](srs/README.md)
- 跨会话记忆：[srs/12-跨会话记忆.md](srs/12-跨会话记忆.md)
- 项目记忆索引：[docs/项目记忆.md](docs/项目记忆.md)
- 项目全景：[docs/项目记忆/项目全景.md](docs/项目记忆/项目全景.md)
- 需求全景：[docs/项目记忆/需求全景.md](docs/项目记忆/需求全景.md)
- 可复用坑位：[docs/项目记忆/](docs/项目记忆/)（后端与数据库、前端工程、前端视觉与交互、工具与跨会话）
