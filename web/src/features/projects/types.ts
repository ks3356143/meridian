export type ProjectNature = "鉴定测评" | "第三方测评" | "二方测评";
export type ProjectPlatform = "FPGA" | "CPU/非嵌";
export type SoftwareType = "新研" | "改造" | "沿用";
export type ProjectClassification = "公开" | "内部" | "秘密" | "机密" | "绝密";
export type SecurityLevel = "A" | "B" | "C" | "D";
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

export interface ProjectMember {
  id: string;
  username: string;
  displayName: string;
  isOwner: boolean;
}

export interface ReferenceStandard {
  id: string;
  name: string;
  code: string;
  publishedDate: string;
  source: string;
  sortOrder: number;
  isEnabled: boolean;
}

export interface Project {
  id: string;
  name: string;
  nature: ProjectNature;
  platform: ProjectPlatform;
  softwareType: SoftwareType;
  classification: ProjectClassification;
  level: SecurityLevel;
  organization: string;
  owner: string;
  members: ProjectMember[];
  languages: string[];
  runtimeEnvironments: string[];
  developmentEnvironments: string[];
  referenceStandards: ReferenceStandard[];
  casesTotal: number;
  casesExecuted: number;
  openIssues: OpenIssues;
  status: ProjectStatus;
  updatedAt: string;
}

export function totalOpenIssues(issues: OpenIssues): number {
  return issues.critical + issues.serious + issues.normal + issues.suggestion;
}

export interface DictionaryOption {
  id: string;
  category: "language" | "runtime_environment" | "development_environment";
  name: string;
  sortOrder: number;
  isEnabled: boolean;
  isPreset: boolean;
}

export interface UserOption {
  id: string;
  username: string;
  displayName: string;
}

export interface ProjectOptions {
  dictionaries: DictionaryOption[];
  standards: ReferenceStandard[];
  users: UserOption[];
}

export type DictionaryCategory = DictionaryOption["category"];

export interface SaveDictionaryPayload {
  category: DictionaryCategory;
  name: string;
  sortOrder: number;
  isEnabled: boolean;
}

export interface SaveReferenceStandardPayload {
  name: string;
  code: string;
  publishedDate: string;
  source: string;
  sortOrder: number;
  isEnabled: boolean;
}

export interface CreateProjectPayload {
  identifierSuffix: string;
  name: string;
  nature: ProjectNature;
  platform: ProjectPlatform;
  softwareType: SoftwareType;
  classification: ProjectClassification;
  securityLevel: SecurityLevel;
  organization: string;
  ownerId: string;
  memberIds: string[];
  languages: string[];
  runtimeEnvironments: string[];
  developmentEnvironments: string[];
  referenceStandardIds: string[];
}
