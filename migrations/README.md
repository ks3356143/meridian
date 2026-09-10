# 数据库迁移

迁移使用显式 SQL，不长期依赖 GORM AutoMigrate。

## 约定

- Up 文件：`NNNN_描述.up.sql`
- Down 文件：`NNNN_描述.down.sql`
- 版本号按四位顺序递增，例如 `0003`。
- 启动时自动执行未应用的 up 文件；每个迁移在独立事务中执行。
- 已应用版本记录在 `schema_migrations` 表。

新增结构变更时，必须同步更新模型、集成测试和本目录迁移脚本。
