import type { Project } from "@/features/projects/types";

export type OutlineStatus = "ready" | "partial" | "missing" | "auto";

export interface OutlineTask {
  label: string;
  description: string;
  to: string;
}

export interface OutlineSection {
  id: string;
  code: string;
  title: string;
  status: OutlineStatus;
  tasks: OutlineTask[];
}

export function buildSections(project: Project): OutlineSection[] {
  const hasStandards = project.referenceStandards.length > 0;
  const hasOrganization = project.organization.trim().length > 0;
  const hasMembers = project.members.length > 0;

  return [
    {
      id: "basis",
      code: "1",
      title: "测试依据",
      status: hasStandards && hasOrganization ? "ready" : "partial",
      tasks: [
        {
          label: "补齐委托方、研制方与测评中心",
          description: "三组联系方式进入大纲第 1 章任务来源和报告概述。",
          to: "/profile",
        },
        {
          label: "核对依据标准与引用文件",
          description: `当前已选 ${project.referenceStandards.length} 项，按排序进入依据文件表。`,
          to: "/profile",
        },
      ],
    },
    { id: "nature", code: "2", title: "测试性质", status: "auto", tasks: [] },
    { id: "purpose", code: "3", title: "测试目的", status: "auto", tasks: [] },
    {
      id: "schedule",
      code: "4",
      title: "测试时间和地点",
      status: "missing",
      tasks: [
        {
          label: "录入时间锚点与测评地点",
          description: "锚点驱动阶段时间线、动态测试地点和文档签署时间。",
          to: "/profile",
        },
      ],
    },
    {
      id: "dut",
      code: "5",
      title: "测试对象及环境",
      status: "partial",
      tasks: [
        {
          label: "完善软件概述与指标覆盖",
          description: "模块组成、功能指标和组成图进入对象章节。",
          to: "/dut",
        },
        {
          label: "录入接口说明与接口表",
          description: "接口叙述、示意图和外部接口信息表。",
          to: "/dut",
        },
        { label: "录入静态测试环境", description: "环境描述、软件项、硬件固件项。", to: "/dut" },
        {
          label: "录入首轮动态环境",
          description: "首轮动态环境、测评数据和差异分析。",
          to: "/rounds/round-1",
        },
      ],
    },
    {
      id: "content",
      code: "6",
      title: "测试内容、方法及要求",
      status: "missing",
      tasks: [
        {
          label: "建立需求树",
          description: "从来源文档整理需求，形成测试项追溯基础。",
          to: "/requirements",
        },
        {
          label: "设计测试项与方法",
          description: "按类型字典录入测试项、子项、充分性和通过准则。",
          to: "/test-items",
        },
      ],
    },
    { id: "metrics", code: "7", title: "测试度量数据及采集要求", status: "auto", tasks: [] },
    { id: "control", code: "8", title: "测试暂停、恢复与中止", status: "auto", tasks: [] },
    {
      id: "organization",
      code: "9",
      title: "测试组织及任务分工",
      status: hasMembers ? "ready" : "missing",
      tasks: [
        {
          label: "完善项目成员与执行角色",
          description: "负责人、测试人员、监测人员进入组织分工和记录签署。",
          to: "/profile",
        },
      ],
    },
    {
      id: "assurance",
      code: "10",
      title: "测试保障",
      status: "partial",
      tasks: [
        {
          label: "确认配置管理与质量保证口径",
          description: "人员、基线和评审信息由项目资料与时间线推导。",
          to: "/profile",
        },
      ],
    },
    { id: "security", code: "11", title: "测试安全与保密", status: "auto", tasks: [] },
    { id: "notes", code: "12", title: "有关问题的说明", status: "auto", tasks: [] },
    {
      id: "appendix",
      code: "13",
      title: "附件",
      status: "missing",
      tasks: [
        {
          label: "配置审查单与追溯附件",
          description: "附录随测试项、审查模板和追踪关系自动组装。",
          to: "/test-items",
        },
      ],
    },
  ];
}
