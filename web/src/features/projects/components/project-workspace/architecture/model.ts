import type { Project } from "../../../types";

export type ArchitectureTaskTone = "primary" | "info" | "warning" | "danger";

export interface WorkspaceArchitectureTask {
  id: string;
  title: string;
  detail: string;
  path: string;
  action: string;
  badge: string;
  tone: ArchitectureTaskTone;
}

export interface WorkspaceTestTreeNode {
  id: string;
  name: string;
  kind: "folder" | "test-item" | "test-sub-item";
  kindLabel: string;
  platforms: Array<"common" | "cpu" | "fpga">;
  children?: WorkspaceTestTreeNode[];
}

export interface WorkspaceReadinessItem {
  id: string;
  label: string;
  status: "done" | "modeling" | "pending";
}

export interface WorkspaceRequirementIntakeStep {
  id: string;
  title: string;
  detail: string;
  status: "done" | "modeling" | "pending";
}

export interface WorkspaceDataFlowNode {
  id: string;
  label: string;
  detail: string;
}

export function getWorkspaceArchitectureTasks(project: Project): WorkspaceArchitectureTask[] {
  const tasks: WorkspaceArchitectureTask[] = [
    {
      id: "work-objects",
      title: "登记工作对象与版本",
      detail: "SRS、研制总要求、任务书、技术要求和代码包先登记为工作对象，不强制先建系统层级。",
      path: "profile",
      action: "登记资料",
      badge: "基础数据",
      tone: "primary",
    },
    {
      id: "requirement-intake",
      title: "导入并确认软件需求",
      detail: "登记工作对象后转换解析候选需求，批量确认章节、描述、类型、平台和来源。",
      path: "requirements",
      action: "进入需求池",
      badge: "当前主链路",
      tone: "info",
    },
    {
      id: "test-item-tree",
      title: "搭建测试项组织树",
      detail:
        "按分系统、配置项、功能域自建文件夹；DC、SA、CR、CW 与动态测试在同一棵树实施，不强制静态先行。",
      path: "test-items",
      action: "设计测试项",
      badge: "设计主线",
      tone: "primary",
    },
    {
      id: "trace-matrix",
      title: "建立需求到用例追踪",
      detail: "需求与测试项多对多关联，测试子项默认生成用例，覆盖状态统一计算。",
      path: "requirements",
      action: "查看矩阵",
      badge: "追踪闭环",
      tone: "info",
    },
    {
      id: "document-output",
      title: "生成文档并统一时间口径",
      detail:
        "业务基本完成后，以用户给定锚点试算封面、签署、章节、记录等全量时间槽位，预览确认后固化快照。",
      path: "documents",
      action: "进入交付",
      badge: "生成阶段",
      tone: "primary",
    },
  ];

  if (project.openIssues.critical + project.openIssues.serious > 0) {
    tasks.unshift({
      id: "issue-closure",
      title: "处理严重问题闭环",
      detail: "优先确认重大或严重问题的研制方意见、影响域与回归验证结果。",
      path: "issues",
      action: "处理问题",
      badge: "风险置顶",
      tone: "danger",
    });
  }

  return tasks;
}

export const workspaceTestItemTree: WorkspaceTestTreeNode[] = [
  {
    id: "bcd-subsystem",
    name: "BCD星分系统",
    kind: "folder",
    kindLabel: "分系统",
    platforms: ["common"],
    children: [
      {
        id: "bcd-command",
        name: "指令生成与发控配置项",
        kind: "folder",
        kindLabel: "配置项",
        platforms: ["cpu"],
        children: [
          {
            id: "bcd-dc",
            name: "文档审查",
            kind: "test-item",
            kindLabel: "DC",
            platforms: ["cpu"],
          },
          {
            id: "bcd-sa",
            name: "静态分析",
            kind: "test-item",
            kindLabel: "SA",
            platforms: ["cpu"],
          },
          {
            id: "bcd-cr",
            name: "代码审查",
            kind: "test-item",
            kindLabel: "CR",
            platforms: ["cpu"],
          },
          {
            id: "bcd-function",
            name: "功能测试",
            kind: "folder",
            kindLabel: "动态",
            platforms: ["cpu"],
            children: [
              {
                id: "bcd-command-function",
                name: "指令生成功能",
                kind: "folder",
                kindLabel: "功能域",
                platforms: ["cpu"],
                children: [
                  {
                    id: "bcd-command-sub-item",
                    name: "指令编码子功能",
                    kind: "test-sub-item",
                    kindLabel: "子项",
                    platforms: ["cpu"],
                  },
                ],
              },
            ],
          },
          {
            id: "bcd-interface",
            name: "接口测试",
            kind: "test-item",
            kindLabel: "IF",
            platforms: ["cpu"],
          },
        ],
      },
      {
        id: "a-command",
        name: "A星配置项",
        kind: "folder",
        kindLabel: "配置项",
        platforms: ["fpga"],
      },
    ],
  },
];

export const workspaceReadiness: WorkspaceReadinessItem[] = [
  { id: "nav", label: "五组一级导航", status: "done" },
  { id: "task-home", label: "当前任务首屏", status: "done" },
  { id: "work-objects", label: "工作对象与版本", status: "modeling" },
  { id: "requirement", label: "需求导入与版本比对", status: "modeling" },
  { id: "test-tree", label: "测试项组织树", status: "modeling" },
  { id: "static", label: "四类静态测试工作流", status: "pending" },
  { id: "time", label: "文档时间口径引擎", status: "pending" },
  { id: "document", label: "生成参数与快照", status: "pending" },
];

export const requirementIntakeSteps: WorkspaceRequirementIntakeStep[] = [
  {
    id: "register",
    title: "登记来源文档",
    detail: "SRS、研制总要求、任务书、技术要求统一进入接收资产。",
    status: "modeling",
  },
  {
    id: "parse",
    title: "转换并解析",
    detail: ".doc 转 .docx，抽取章节、段落、表格与平台线索。",
    status: "pending",
  },
  {
    id: "confirm",
    title: "批量确认候选需求",
    detail: "确认章节号、名称、类型、平台、来源工作对象和描述。",
    status: "pending",
  },
  {
    id: "trace",
    title: "建立分层追踪",
    detail: "顶层需求、软件需求、测试项、测试子项与用例分层关联。",
    status: "pending",
  },
  {
    id: "diff",
    title: "新版本比对",
    detail: "标记新增、修改、删除，并推导受影响测试项与回归范围。",
    status: "pending",
  },
];

export const workspaceDataFlow: WorkspaceDataFlowNode[] = [
  { id: "project", label: "项目", detail: "委托与配置容器" },
  { id: "work-object", label: "工作对象", detail: "SRS / 顶层依据 / 代码包" },
  { id: "requirement", label: "软件需求", detail: "章节号 / 名称 / 描述 / 类型" },
  { id: "test-item-tree", label: "测试项树", detail: "文件夹 / 测试项 / 子项" },
  { id: "test-case", label: "测试用例", detail: "默认由子项生成" },
  { id: "round", label: "轮次", detail: "执行分组 / 回归范围" },
  { id: "issue", label: "问题单", detail: "与用例多对多" },
  { id: "document", label: "文档生成", detail: "输出范围 / 时间口径 / 快照" },
];
