export type ProjectNature = "鉴定测试" | "第三方测试" | "分析评测";
export type ProjectTestType = "配置项测试" | "系统测试";
export type SecurityLevel = "A" | "B" | "C" | "D";
export type ProjectPlatform = "CPU" | "FPGA" | "桌面";
export type ProjectStatus =
  | "编制大纲中"
  | "大纲已评审"
  | "测试执行中"
  | "回归验证中"
  | "报告编制中"
  | "已完成";

export interface OpenIssues {
  critical: number;
  serious: number;
  normal: number;
  suggestion: number;
}

export interface Project {
  id: string;
  name: string;
  nature: ProjectNature;
  testType: ProjectTestType;
  level: SecurityLevel;
  platform: ProjectPlatform;
  organization: string;
  owner: string;
  casesTotal: number;
  casesExecuted: number;
  openIssues: OpenIssues;
  status: ProjectStatus;
  updatedAt: string;
}

export function totalOpenIssues(issues: OpenIssues): number {
  return issues.critical + issues.serious + issues.normal + issues.suggestion;
}
