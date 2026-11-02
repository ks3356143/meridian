# 模块化与前端铁律

## 模块化与按需加载铁律（2026-11-02 用户明确）

**背景**：项目已有 85 个 MD / 5673 行、Go 141 文件 / 28979 行、TS 249 文件 / 39793 行。单文件越大，AI 每次读取的成本越高、命中无关内容的概率越大。

### 一、文档按需加载，禁止整目录通读

1. **先查索引，再读正文**。入口只读 `srs/README.md` 的索引表和 `srs/12-跨会话记忆.md` 的当前交接段，不要一次性打开整个 `srs/`。
2. **顺着链接走**。索引里定位到 1–2 篇最相关的，只读那几篇；需要更细的口径时，再按该文里的相对链接继续下钻。
3. **禁止**：为了让 AI“了解全貌”而批量读取多个 MD；禁止把整篇 SRS 内容复制进对话或粘进大文件。
4. 每篇 MD 开头必须有 **3–5 行的「本文解决什么问题 + 上游链接 + 下游链接」**，让读者能判断要不要继续读。

### 二、单文件行数上限（超过就拆）

| 类型 | 上限 | 超标处理 |
|---|---|---|
| MD 文档 | **200 行** | 按主题拆子文件，父文件只留索引与链接 |
| Go 单文件 | **500 行**（测试文件 800 行） | 按职责拆：service / repo / handler / dto 分文件 |
| TSX 组件 | **400 行** | 拆子组件、抽 hooks、样式进 CSS Module |
| TS 非组件 | **300 行** | 按领域拆模块 |

- 拆分时**不改行为**，只搬代码；搬完必须跑对应验证。
- 新写代码前先看目标文件当前行数，预计会超标就**先拆再加**，不要写完再返工。
- 例外：自动生成的代码、迁移 SQL、第三方 vendored 代码不受此限；规则文档拆分到 `.claude/rules/`，单篇仍需 ≤200 行。

### 三、当前已知超标文件（待专项拆分，不阻塞日常）

```
internal/modules/requirements/service.go                    1491 行
internal/api/requirement_flow_test.go                       1511 行
internal/modules/testitems/service_test.go                  1464 行
web/.../requirements/requirements-tree.tsx                   1300 行
web/.../test-items/test-items-workbench.tsx                  1266 行
web/.../requirements/requirement-detail.tsx                  1038 行
internal/modules/assets/service.go                           1023 行
web/.../requirements/requirements-layout.tsx                 1017 行
```

拆分排期由用户决定，不要在日常任务里顺手大改。

### 四、汇报要求

每次动到上述文件或新增文件时，汇报里写明：**改动前多少行 → 改动后多少行**，是否触发拆分阈值。

## 前端铁律

能使用组件库组件的必须使用组件库不要手搓，手搓仅调整，能美化的都美化，前端布局和样式可以参考ui/ux pro max、frontend-design、taste-skills、garden-skills等

**性能优先铁律**：任何前端页面、组件、表格、树、弹窗和动效先按生产构建测量性能；本地工具也不允许用“能用/数据少”代替流畅。若当前成熟方案或必要视觉效果无法压到流畅，必须提供明确加载态（Skeleton / spinner / `aria-busy` / 进度面板），禁止让已显示页面长时间冻结或无反馈。性能验收统一以 `npm run build` + `npm run preview` 为准，开发服务器只验证功能。

1. 一定要美观好看，舒服
1. 做前端时候一定要看 [srs/07-前端体验.md](../../srs/07-前端体验.md) 里面美化要求
1. 组件自定义样式必须使用 Vite CSS Modules：组件样式写在同目录同名 `.module.css`，例如 `Button.tsx` 对应 `Button.module.css`；参考 [Vite CSS Modules](https://vite.dev/guide/features.html#css-modules)。
1. 组件必须 `import styles from './Button.module.css'`，自定义 `className` 使用 `styles.xxx`；变体使用 `styles.primary` / `styles.ghost`，状态使用 `data-state` + CSS 属性选择器。
1. 禁止把新增自定义视觉样式继续写入全局 CSS 大文件或散落在 TSX 长工具类里；Tailwind 只用于少量布局工具和 shadcn/Radix 既有组合，主题、变体、状态和业务视觉归 CSS Module。
1. CSS Module 按组件职责拆分，选择器使用 camelCase 类名；跨组件第三方子元素用 `:global()`，禁止用标签选择器扩大影响面。
1. 涉及 React 19 并发能力、渲染性能、重渲染、包体积或数据请求优化的，必须优先参考本机已安装技能 `react19-concurrent-patterns` 和 `vercel-react-best-practices`，再结合 [srs/21-前端性能优化策略.md](../../srs/21-前端性能优化策略.md) 做测量、修改和验收。Next.js、RSC 等不适用于本项目 Vite SPA 的规则只作思路参考，不得机械套用。
1. 涉及列表/详情数据分层、懒加载与加载态、表格与树虚拟化、富文本正文、图片资源的，必须先读 [srs/23-数据加载与渲染性能.md](../../srs/23-数据加载与渲染性能.md)；模块实施记录可查，但契约以该全局文件为准。
