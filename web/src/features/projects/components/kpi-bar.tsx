import {
  Activity,
  CircleAlert,
  FileCheck2,
  FileEdit,
  FlaskConical,
  FolderKanban,
} from "lucide-react";
import { totalOpenIssues, type Project } from "../types";

interface KpiItem {
  icon: typeof FolderKanban;
  label: string;
  value: string;
  tone: "default" | "primary" | "success" | "danger";
  detail: string;
  progress?: number;
}
interface KpiBarProps {
  projects: Project[];
}

export function KpiBar({ projects }: KpiBarProps) {
  const totalCases = projects.reduce((sum, p) => sum + p.casesTotal, 0);
  const executedCases = projects.reduce((sum, p) => sum + p.casesExecuted, 0);
  const executionRate = totalCases === 0 ? 0 : Math.round((executedCases / totalCases) * 100);
  const executing = projects.filter((p) => p.status === "测试执行中").length;
  const drafting = projects.filter(
    (p) => p.status === "编制大纲中" || p.status === "大纲已评审",
  ).length;
  const completed = projects.filter((p) => p.status === "已完成").length;
  const critical = projects.reduce((sum, p) => sum + p.openIssues.critical, 0);
  const serious = projects.reduce((sum, p) => sum + p.openIssues.serious, 0);
  const normal = projects.reduce((sum, p) => sum + p.openIssues.normal, 0);
  const suggestion = projects.reduce((sum, p) => sum + p.openIssues.suggestion, 0);
  const openCritical = critical + serious;
  const openTotal = projects.reduce((sum, p) => sum + totalOpenIssues(p.openIssues), 0);

  const items: KpiItem[] = [
    {
      icon: FolderKanban,
      label: "项目总数",
      value: String(projects.length),
      tone: "default",
      detail: `执行 ${executing} · 完成 ${completed}`,
      progress: projects.length === 0 ? 0 : (completed / projects.length) * 100,
    },
    {
      icon: FlaskConical,
      label: "测试执行中",
      value: String(executing),
      tone: "primary",
      detail: `编制 ${drafting} · 其他 ${projects.length - drafting - executing - completed}`,
    },
    {
      icon: FileEdit,
      label: "编制评审中",
      value: String(drafting),
      tone: "default",
      detail: "大纲编制与已评审",
    },
    {
      icon: FileCheck2,
      label: "已完成",
      value: String(completed),
      tone: "success",
      detail:
        projects.length === 0
          ? "暂无项目"
          : `占比 ${Math.round((completed / projects.length) * 100)}%`,
      progress: projects.length === 0 ? 0 : (completed / projects.length) * 100,
    },
    {
      icon: Activity,
      label: "用例执行率",
      value: `${executionRate}%`,
      tone: "primary",
      detail: `${executedCases}/${totalCases}`,
      progress: executionRate,
    },
    {
      icon: CircleAlert,
      label: "未闭环问题",
      value: String(openTotal),
      tone: openCritical > 0 ? "danger" : "default",
      detail: `重 ${openCritical} · 一般 ${normal} · 建议 ${suggestion}`,
    },
  ] as const;

  return (
    <div className="panel-surface border-border grid grid-cols-2 rounded-sm border sm:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <div
          key={item.label}
          className={`dash-reveal group border-border relative flex min-h-24 flex-col justify-between gap-2 border-r border-b p-3 transition-[background-color,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] last:border-r-0 hover:bg-primary/5 max-xl:[&:nth-child(3n)]:border-r-0 max-sm:[&:nth-child(2n)]:border-r-0 ${
            item.tone === "danger" ? "bg-destructive/5 hover:bg-destructive/8" : ""
          }`}
        >
          <div
            className={`absolute inset-x-0 top-0 h-[2px] origin-left transition-transform duration-200 ${
              item.tone === "danger"
                ? "bg-destructive"
                : item.tone === "primary" || item.tone === "success"
                  ? "bg-primary"
                  : "bg-muted-foreground/30"
            }`}
            style={{ transform: `scaleX(${(item.progress ?? 0) / 100})` }}
            aria-hidden
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs">{item.label}</span>
            <item.icon
              className={`size-3.5 transition-transform duration-200 group-hover:scale-110 ${
                item.tone === "danger"
                  ? "text-destructive"
                  : item.tone === "primary" || item.tone === "success"
                    ? "text-primary"
                    : "text-muted-foreground"
              }`}
              aria-hidden
            />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`font-mono text-2xl leading-none font-semibold ${
                item.tone === "danger" ? "text-destructive" : ""
              }`}
            >
              {/^[\d.]+%?$/.test(item.value) ? (
                <span className="metric-count" data-value={item.value.replace(/[%.]/g, "")}>
                  {item.value.replace(/[%.]/g, "")}
                </span>
              ) : (
                item.value
              )}
              {item.value.endsWith("%") ? "%" : null}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block truncate text-[10px]">{item.detail}</span>
            <span className="bg-muted/70 mt-1.5 block h-1 w-full overflow-hidden">
              <span
                className={`block h-full origin-left transition-transform duration-500 ${
                  item.tone === "danger" ? "bg-destructive" : "bg-primary"
                }`}
                style={{ transform: `scaleX(${(item.progress ?? 0) / 100})` }}
              />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
