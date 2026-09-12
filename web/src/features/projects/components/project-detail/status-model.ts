import { totalOpenIssues, type Project } from "../../types";

export type DetailTabValue =
  | "overview"
  | "profile"
  | "dut"
  | "requirements"
  | "test-items"
  | "rounds"
  | "issues"
  | "documents";

export type ReadinessState = "ready" | "partial" | "pending";

export interface ModuleReadiness {
  key: DetailTabValue;
  label: string;
  state: ReadinessState;
  primary: string;
  secondary: string;
  progress: number;
}

const STAGES: Project["status"][] = [
  "编制大纲中",
  "大纲已评审",
  "测试执行中",
  "回归验证中",
  "报告编制中",
  "已完成",
];

export function getProjectReadiness(project: Project): ModuleReadiness[] {
  const standardsReady = project.referenceStandards.length > 0;
  const membersReady = project.members.length > 0;
  const testReady = project.casesTotal > 0;
  const issues = totalOpenIssues(project.openIssues);

  return [
    {
      key: "profile",
      label: "项目资料",
      state: standardsReady && membersReady ? "ready" : "partial",
      primary: standardsReady
        ? `${project.referenceStandards.length} 项依据标准`
        : "依据标准未选择",
      secondary: membersReady ? `${project.members.length} 名成员` : "项目成员未设置",
      progress: (Number(standardsReady) + Number(membersReady)) * 50,
    },
    {
      key: "dut",
      label: "被测对象",
      state: "pending",
      primary: "软件概述待录入",
      secondary: "接口与静态环境待建模",
      progress: 0,
    },
    {
      key: "requirements",
      label: "需求追溯",
      state: "pending",
      primary: "来源文档待登记",
      secondary: "需求树未建立",
      progress: 0,
    },
    {
      key: "test-items",
      label: "测试设计",
      state: testReady ? "partial" : "pending",
      primary: testReady ? `${project.casesTotal} 条测试用例` : "测试用例未创建",
      secondary: "测试项类型覆盖待统计",
      progress: testReady ? 40 : 0,
    },
    {
      key: "rounds",
      label: "轮次执行",
      state: project.casesExecuted > 0 ? "partial" : "pending",
      primary: project.casesExecuted > 0 ? `${project.casesExecuted} 条执行记录` : "第 1 轮待创建",
      secondary: "动态环境与轮次范围待配置",
      progress: project.casesTotal > 0 ? (project.casesExecuted / project.casesTotal) * 100 : 0,
    },
    {
      key: "issues",
      label: "问题单",
      state: issues > 0 ? "partial" : "pending",
      primary: issues > 0 ? `${issues} 个未闭环问题` : "暂无未闭环问题",
      secondary: "问题回归链待接入",
      progress: 0,
    },
    {
      key: "documents",
      label: "文档产出",
      state: project.status === "报告编制中" || project.status === "已完成" ? "partial" : "pending",
      primary: "七类文档待生成",
      secondary: "模板与预检结果待接入",
      progress: project.status === "已完成" ? 70 : 0,
    },
  ];
}

export function getStageIndex(status: Project["status"]) {
  return Math.max(STAGES.indexOf(status), 0);
}

export function getProjectStages() {
  return STAGES;
}

export function workspacePath(projectCode: string, tab: DetailTabValue = "overview") {
  if (tab === "overview") {
    return `/projects/${projectCode}/workspace`;
  }

  if (tab === "rounds") {
    return `/projects/${projectCode}/workspace/rounds/round-1`;
  }

  return `/projects/${projectCode}/workspace/${tab}`;
}
