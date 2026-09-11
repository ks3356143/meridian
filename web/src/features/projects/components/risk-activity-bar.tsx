import { ArrowRight, CircleAlert, ListChecks, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { totalOpenIssues, type Project } from "../types";

interface RiskActivityBarProps {
  projects: Project[];
}

const toneStyles = {
  danger: {
    bar: "bg-destructive",
    border: "hover:border-destructive/45",
    icon: "text-destructive",
  },
  warning: {
    bar: "bg-warning",
    border: "hover:border-warning/50",
    icon: "text-warning",
  },
  info: {
    bar: "bg-info",
    border: "hover:border-info/45",
    icon: "text-info",
  },
} as const;

export function RiskActivityBar({ projects }: RiskActivityBarProps) {
  const items = projects
    .map((project) => {
      const urgent = project.openIssues.critical + project.openIssues.serious;
      const open = totalOpenIssues(project.openIssues);
      const pending =
        project.status === "已完成" ? 0 : Math.max(project.casesTotal - project.casesExecuted, 0);
      return { project, urgent, open, pending };
    })
    .filter((item) => item.urgent > 0 || item.open > 0 || item.pending > 0)
    .sort(
      (a, b) =>
        b.urgent - a.urgent ||
        b.open - a.open ||
        b.pending - a.pending ||
        b.project.updatedAt.localeCompare(a.project.updatedAt),
    )
    .slice(0, 4);

  return (
    <section aria-label="风险与活动摘要" className="dash-reveal">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CircleAlert className="text-warning size-3.5" aria-hidden />
          <h2 className="text-sm font-semibold">风险与活动</h2>
        </div>
        <span className="text-muted-foreground font-mono text-xs">
          {items.length ? `TOP ${items.length}` : "无待处理信号"}
        </span>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {items.map(({ project, urgent, open, pending }) => {
          const reason =
            urgent > 0 ? `重大/严重 ${urgent}` : open > 0 ? `未闭环 ${open}` : `待执行 ${pending}`;
          const tone = urgent > 0 ? "danger" : open > 0 ? "warning" : "info";
          const toneStyle = toneStyles[tone];

          return (
            <Button
              key={project.id}
              asChild
              variant="outline"
              data-risk-card={tone}
              className={cn(
                "border-border bg-card text-foreground group relative h-auto min-h-24 w-full justify-between overflow-hidden rounded-sm border p-3 pl-4 text-left",
                toneStyle.border,
              )}
            >
              <Link to={`/projects/${project.id}`}>
                <span
                  className={cn("absolute inset-y-0 left-0 w-[4px]", toneStyle.bar)}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="mb-1.5 flex items-center gap-2">
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {project.id}
                    </span>
                    <Badge variant={tone}>{reason}</Badge>
                  </span>
                  <span className="block truncate text-[13px] font-medium">{project.name}</span>
                  <span className="text-muted-foreground mt-1 flex items-center gap-2 text-[11px]">
                    {pending > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <ListChecks className={cn("size-3", toneStyle.icon)} aria-hidden />
                        {pending}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck className="size-3" aria-hidden />
                        无待执行
                      </span>
                    )}
                    <span>{project.status}</span>
                  </span>
                </span>
                <ArrowRight
                  className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-colors duration-200"
                  aria-hidden
                />
              </Link>
            </Button>
          );
        })}
        {items.length === 0 ? (
          <div className="border-border bg-card text-muted-foreground col-span-full flex min-h-20 w-full items-center justify-center rounded-sm border text-xs">
            当前筛选结果没有风险或待执行信号
          </div>
        ) : null}
      </div>
    </section>
  );
}
