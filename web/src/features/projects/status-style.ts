import type { Project, ProjectStatus } from "./types";

export type ProjectBadgeVariant =
  | "secondary"
  | "outline"
  | "primary"
  | "success"
  | "info"
  | "warning"
  | "ghost"
  | "danger";

export const statusVariant: Record<ProjectStatus, ProjectBadgeVariant> = {
  编制大纲中: "secondary",
  大纲已评审: "info",
  测试执行中: "primary",
  回归验证中: "info",
  报告编制中: "warning",
  已完成: "success",
};

export const levelVariant: Record<Project["level"], ProjectBadgeVariant> = {
  A: "danger",
  B: "warning",
  C: "info",
  D: "outline",
};
