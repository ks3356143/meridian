import type { Project, ProjectStatus } from "./types";

export const statusStyle: Record<ProjectStatus, string> = {
  编制大纲中: "bg-secondary text-secondary-foreground",
  大纲已评审: "bg-accent text-accent-foreground",
  测试执行中: "bg-primary/12 text-primary",
  回归验证中: "bg-chart-2/15 text-chart-2",
  报告编制中: "bg-chart-3/20 text-chart-3",
  已完成: "bg-muted text-muted-foreground",
};

export const levelStyle: Record<Project["level"], string> = {
  A: "text-destructive border-destructive/40",
  B: "text-chart-4 border-chart-4/40",
  C: "text-chart-2 border-chart-2/40",
  D: "text-muted-foreground border-border",
};
