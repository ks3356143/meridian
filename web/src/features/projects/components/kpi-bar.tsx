import {
  Activity,
  CircleAlert,
  FileCheck2,
  FileEdit,
  FlaskConical,
  FolderKanban,
} from "lucide-react";
import { cn } from "cn";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { totalOpenIssues, type Project } from "../types";

type KpiTone = "info" | "primary" | "warning" | "success" | "chart" | "danger";

interface KpiItem {
  icon: typeof FolderKanban;
  label: string;
  value: string;
  tone: KpiTone;
  detail: string;
  progress?: number;
}

const toneStyles: Record<KpiTone, { card: string; icon: string; value: string; progress: string }> =
  {
    info: {
      card: "hover:bg-info/[0.045]",
      icon: "border-info/35 bg-info/12 text-info",
      value: "text-info",
      progress: "[&_[data-slot=progress-indicator]]:bg-info",
    },
    primary: {
      card: "hover:bg-primary/[0.045]",
      icon: "border-primary/35 bg-primary/12 text-primary",
      value: "text-primary",
      progress: "[&_[data-slot=progress-indicator]]:bg-primary",
    },
    warning: {
      card: "hover:bg-warning/[0.055]",
      icon: "border-warning/40 bg-warning/14 text-warning",
      value: "text-warning",
      progress: "[&_[data-slot=progress-indicator]]:bg-warning",
    },
    success: {
      card: "hover:bg-success/[0.045]",
      icon: "border-success/35 bg-success/12 text-success",
      value: "text-success",
      progress: "[&_[data-slot=progress-indicator]]:bg-success",
    },
    chart: {
      card: "hover:bg-chart-2/[0.045]",
      icon: "border-chart-2/35 bg-chart-2/12 text-chart-2",
      value: "text-chart-2",
      progress: "[&_[data-slot=progress-indicator]]:bg-chart-2",
    },
    danger: {
      card: "hover:bg-destructive/[0.045]",
      icon: "border-destructive/35 bg-destructive/12 text-destructive",
      value: "text-destructive",
      progress: "[&_[data-slot=progress-indicator]]:bg-destructive",
    },
  };

export function KpiBar({ projects }: { projects: Project[] }) {
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
      tone: "info",
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
      tone: "warning",
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
      tone: "chart",
      detail: `${executedCases}/${totalCases}`,
      progress: executionRate,
    },
    {
      icon: CircleAlert,
      label: "未闭环问题",
      value: String(openTotal),
      tone: "danger",
      detail: `重 ${openCritical} · 一般 ${normal} · 建议 ${suggestion}`,
    },
  ];

  return (
    <div aria-label="项目统计" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {items.map((item) => {
        const tone = toneStyles[item.tone];
        return (
          <Card
            key={item.label}
            size="sm"
            data-tone={item.tone}
            className={cn("dash-reveal group overflow-hidden", tone.card)}
          >
            <CardContent className="flex min-h-30 flex-col justify-between gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground text-xs font-semibold">{item.label}</span>
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-sm border",
                    tone.icon,
                  )}
                >
                  <item.icon className="size-4" aria-hidden />
                </span>
              </div>

              <div className="flex items-end justify-between gap-2">
                <span
                  className={cn(
                    "font-mono text-4xl leading-none font-bold tabular-nums",
                    tone.value,
                  )}
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
                <span className="text-muted-foreground max-w-24 text-right text-[10px] leading-tight">
                  {item.detail}
                </span>
              </div>

              <Progress value={item.progress ?? 0} className={cn("h-1", tone.progress)} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
