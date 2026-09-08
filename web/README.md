# ChenMeridian Web

前端使用 Vite + React Router 8 SPA Data Mode，开发时通过 Vite 代理访问本地 Go 服务。

## 命令

```powershell
npm run dev             # 启动开发服务
npm run format          # oxfmt 格式化
npm run format:check    # 格式检查
npm run lint            # oxlint
npm run typecheck       # TypeScript 检查
npm run build           # 生产构建
npm run preview         # 预览生产构建
npm run check           # 全量前端检查
```

## 目录

- `src/api/`：HTTP 客户端与接口封装
- `src/components/provider/`：全局 Provider
- `src/components/router-util/`：路由通用状态
- `src/components/ui/`：shadcn/ui 基础组件
- `src/features/`：业务模块
- `src/layouts/`：页面布局
- `src/lib/`：通用工具
- `src/pages/`：路由页面组件
- `src/router/`：`createBrowserRouter` 路由定义
- `src/stores/`：Zustand 状态
- `src/styles/`：全局样式
