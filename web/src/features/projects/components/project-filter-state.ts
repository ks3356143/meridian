import type { ProjectPlatform, ProjectStatus, SecurityLevel } from "../types";

export interface ProjectFilterValues {
  keyword: string;
  status: ProjectStatus | "";
  level: SecurityLevel | "";
  platform: ProjectPlatform | "";
}

export const emptyProjectFilters: ProjectFilterValues = {
  keyword: "",
  status: "",
  level: "",
  platform: "",
};

export const projectStatusOptions: ProjectStatus[] = [
  "编制大纲中",
  "大纲已评审",
  "测试执行中",
  "回归验证中",
  "报告编制中",
  "已完成",
];

export const securityLevelOptions: SecurityLevel[] = ["A", "B", "C", "D"];

export const projectPlatformOptions: ProjectPlatform[] = ["FPGA", "CPU/非嵌"];

const storageKey = "chenmeridian.projects.filters.v1";

export function isProjectFilterActive(filters: ProjectFilterValues): boolean {
  return Boolean(filters.keyword.trim() || filters.status || filters.level || filters.platform);
}

export function loadProjectFilters(): ProjectFilterValues {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return emptyProjectFilters;

    const value = JSON.parse(raw) as Partial<ProjectFilterValues>;
    return {
      keyword: typeof value.keyword === "string" ? value.keyword : "",
      status: projectStatusOptions.includes(value.status as ProjectStatus)
        ? (value.status as ProjectStatus)
        : "",
      level: securityLevelOptions.includes(value.level as SecurityLevel)
        ? (value.level as SecurityLevel)
        : "",
      platform: projectPlatformOptions.includes(value.platform as ProjectPlatform)
        ? (value.platform as ProjectPlatform)
        : "",
    };
  } catch {
    return emptyProjectFilters;
  }
}

export function saveProjectFilters(filters: ProjectFilterValues): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(filters));
  } catch {
    // localStorage 可能被浏览器策略禁用，筛选功能本身仍可用。
  }
}
