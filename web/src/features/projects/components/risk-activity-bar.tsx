import { ArrowRight, CircleAlert, ListChecks, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { totalOpenIssues, type Project } from "../types";

interface RiskActivityBarProps {
  projects: Project[];
}

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
          const variant = urgent > 0 ? "danger" : open > 0 ? "warning" : "info";
          return (
            <Button
              key={project.id}
              asChild
              className="panel-surface panel-interactive group border-border text-foreground hover:border-primary/35 h-auto min-h-20 w-full justify-between rounded-sm border p-3 text-left hover:translate-y-0"
            >
              <Link to={`/projects/${project.id}`}>
                <span className="min-w-0">
                  <span className="mb-1 flex items-center gap-2">
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {project.id}
                    </span>
                    <Badge variant={variant}>{reason}</Badge>
                  </span>
                  <span className="block truncate text-[13px] font-medium">{project.name}</span>
                  <span className="text-muted-foreground mt-1 flex items-center gap-2 text-[11px]">
                    {pending > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <ListChecks className="size-3" aria-hidden />
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
                  className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-all duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </Button>
          );
        })}
        {items.length === 0 ? (
          <div className="border-border bg-card text-muted-foreground flex min-h-20 items-center justify-center rounded-sm border text-xs">
            当前筛选结果没有风险或待执行信号
          </div>
        ) : null}
      </div>
    </section>
  );
}
