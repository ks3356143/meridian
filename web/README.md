# ChenMeridian Web

前端是传统 Vite SPA，使用 React Router 8 Data Mode。运行和检查命令见根目录 [README.md](../README.md)。

## 分层

- `src/api/`：HTTP 客户端和跨模块系统接口。
- `src/components/ui/`：shadcn/ui 与 Radix 基础组件。
- `src/components/provider/`、`src/components/router-util/`：全局 Provider 和路由通用状态。
- `src/features/<模块>/api.ts`：业务接口封装。
- `src/features/<模块>/components/`：业务组件；复杂页面继续按功能子目录拆分。
- `src/pages/`：路由页面壳，负责路由参数、页面级编排和 `Component` 导出。
- `src/stores/`：Zustand 全局状态。
- `src/styles/`：主题、质感、品牌动效、表单状态和交互反馈分层样式。

## 约定

- 业务状态放 `features`，路由页不承载可复用业务组件。
- 交互组件优先使用 shadcn/ui 和 Radix；动画尊重 `prefers-reduced-motion`。
- 接口类型与 API 封装保存在对应模块内，不在页面里直接拼写请求。
