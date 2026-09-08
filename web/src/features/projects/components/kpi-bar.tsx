import {
  Activity,
  CircleAlert,
  FileEdit,
  FileCheck2,
  FlaskConical,
  FolderKanban,
} from "lucide-react";
import { totalOpenIssues, type Project } from "../types";

interface KpiItem {
  icon: typeof FolderKanban;
  label: string;
  value: string;
  tone: "default" | "primary" | "success" | "danger";
  hint?: string;
}
interface KpiBarProps {
  projects: Project[];
}

export function KpiBar({ projects }: KpiBarProps) {
  const totalCases = projects.reduce((sum, p) => sum + p.casesTotal, 0);
  const executedCases = projects.reduce((sum, p) => sum + p.casesExecuted, 0);
  const executionRate = totalCases === 0 ? 0 : Math.round((executedCases / totalCases) * 100);
  const openCritical = projects.reduce(
    (sum, p) => sum + p.openIssues.critical + p.openIssues.serious,
    0,
  );
  const openTotal = projects.reduce((sum, p) => sum + totalOpenIssues(p.openIssues), 0);

  const items: KpiItem[] = [
    { icon: FolderKanban, label: "项目总数", value: String(projects.length), tone: "default" },
    {
      icon: FlaskConical,
      label: "测试执行中",
      value: String(projects.filter((p) => p.status === "测试执行中").length),
      tone: "primary",
    },
    {
      icon: FileEdit,
      label: "编制评审中",
      value: String(
        projects.filter((p) => p.status === "编制大纲中" || p.status === "大纲已评审").length,
      ),
      tone: "default",
    },
    {
      icon: FileCheck2,
      label: "已完成",
      value: String(projects.filter((p) => p.status === "已完成").length),
      tone: "success",
    },
    { icon: Activity, label: "用例执行率", value: `${executionRate}%`, tone: "primary" },
    {
      icon: CircleAlert,
      label: "未闭环问题",
      value: String(openTotal),
      tone: openCritical > 0 ? "danger" : "default",
      hint: openCritical > 0 ? `重大/严重 ${openCritical}` : undefined,
    },
  ] as const;

  return (
    <div className="border-border bg-card grid grid-cols-3 border sm:grid-cols-6">
      {items.map((item) => (
        <div
          key={item.label}
          className={`dash-reveal border-border flex min-h-20 flex-col justify-center gap-1.5 border-r px-4 last:border-r-0 max-sm:[&:nth-child(2n)]:border-r-0 ${
            item.tone === "danger" ? "bg-destructive/5" : ""
          }`}
        >
          <div className="flex items-center gap-1.5">
            <item.icon
              className={`size-3.5 ${
                item.tone === "danger"
                  ? "text-destructive"
                  : item.tone === "primary"
                    ? "text-primary"
                    : item.tone === "success"
                      ? "text-primary"
                      : "text-muted-foreground"
              }`}
              aria-hidden
            />
            <span className="text-muted-foreground text-xs">{item.label}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`font-mono text-2xl font-semibold ${
                item.tone === "danger" ? "text-destructive" : ""
              }`}
            >
              {/^\d+$/.test(item.value) ? (
                <span className="metric-count" data-value={item.value}>
                  {item.value}
                </span>
              ) : (
                item.value
              )}
            </span>
            {item.hint ? <span className="text-destructive text-xs">{item.hint}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
