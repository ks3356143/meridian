# API 模块化

## 目标

项目未来可能有 500 个以上 API，必须按业务域拆分，避免把接口堆在单个文件中。

## 分层

- `internal/api/`：只负责服务创建、路由挂载、全局中间件和 OpenAPI 配置。
- `internal/api/v1/`：API 版本入口，只注册各业务模块。
- `internal/api/v1/<module>/`：Huma 路由、DTO 和 handler。
- `internal/modules/<module>/`：业务模型、服务逻辑和仓储。

## 模块规划

- `health`：健康检查
- `auth`：认证
- `users`：用户
- `systems`：被测系统
- `projects`：测试项目与版本
- `test-items`：测试项
- `test-cases`：测试用例
- `test-tasks`：测试任务
- `executions`：执行记录
- `issues`：问题单
- `attachments`：附件
- `templates`：模板管理
- `reports`：报告生成
- `imports`：导入
- `settings`：配置
- `dashboard`：工作台统计

## 文件粒度

- `routes.go` 只注册路由和 OpenAPI 元信息。
- `dto.go` 放请求和响应结构。
- `handlers.go` 只处理 HTTP 输入输出，调用 service。
- `service.go` 不感知 HTTP。
- `repository.go` 只处理数据库访问。
- 单个文件超过约 300 行或 8 到 10 个接口时拆分。
- 每个 Huma Tag 对应一个业务域。
