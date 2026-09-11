import { CalendarClock, CircleAlert, ListChecks } from "lucide-react";
import { Children, type ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { totalOpenIssues, type Project } from "../types";

const itemButtonClass =
  "hover:bg-primary/6 focus-visible:bg-primary/8 h-auto w-full justify-between rounded-none px-1 py-2.5 text-left text-[13px]";

const sectionStyles = {
  danger: {
    bar: "bg-destructive",
    icon: "border-destructive/35 bg-destructive/12 text-destructive",
  },
  primary: {
    bar: "bg-primary",
    icon: "border-primary/35 bg-primary/12 text-primary",
  },
  info: {
    bar: "bg-info",
    icon: "border-info/35 bg-info/12 text-info",
  },
} as const;

export function TodoPanel({ projects }: { projects: Project[] }) {
  const openIssues = projects
    .filter((p) => totalOpenIssues(p.openIssues) > 0)
    .map((p) => ({
      projectId: p.id,
      projectName: p.name,
      count: totalOpenIssues(p.openIssues),
      urgent: p.openIssues.critical + p.openIssues.serious,
    }))
    .sort((a, b) => b.urgent - a.urgent || b.count - a.count)
    .slice(0, 5);

  const pendingCases = projects
    .filter((p) => p.casesExecuted < p.casesTotal && p.status !== "已完成")
    .sort((a, b) => b.casesTotal - b.casesExecuted - (a.casesTotal - a.casesExecuted))
    .slice(0, 5);

  const recentProjects = [...projects]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 4);

  return (
    <aside className="panel-surface border-border relative flex w-full shrink-0 flex-col overflow-hidden rounded-sm border min-[1760px]:w-80">
      <TodoSection
        title="未闭环问题"
        icon={CircleAlert}
        tone="danger"
        emptyText="当前没有未闭环问题"
      >
        {openIssues.map((item) => (
          <li key={item.projectId}>
            <Button asChild variant="ghost" className={itemButtonClass}>
              <Link to={`/projects/${item.projectId}`}>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.projectName}</span>
                  <span className="text-muted-foreground block font-mono text-xs">
                    {item.projectId}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <Badge variant={item.urgent > 0 ? "danger" : "secondary"} className="font-mono">
                    {item.count}
                  </Badge>
                  {item.urgent > 0 ? (
                    <span className="text-destructive text-[10px]">重大/严重 {item.urgent}</span>
                  ) : null}
                </span>
              </Link>
            </Button>
          </li>
        ))}
      </TodoSection>

      <TodoSection title="待执行用例" icon={ListChecks} tone="primary" emptyText="全部用例已执行">
        {pendingCases.map((p) => (
          <li key={p.id}>
            <Button asChild variant="ghost" className={itemButtonClass}>
              <Link to={`/projects/${p.id}`}>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="text-muted-foreground block font-mono text-xs">{p.id}</span>
                </span>
                <Badge variant="primary" className="font-mono">
                  {p.casesTotal - p.casesExecuted}
                </Badge>
              </Link>
            </Button>
          </li>
        ))}
      </TodoSection>

      <TodoSection title="最近更新" icon={CalendarClock} tone="info" emptyText="暂无项目">
        {recentProjects.map((p) => (
          <li key={p.id}>
            <Button asChild variant="ghost" className={itemButtonClass}>
              <Link to={`/projects/${p.id}`}>
                <span className="text-muted-foreground min-w-0 truncate font-mono text-xs">
                  {p.id}
                </span>
                <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                  {p.updatedAt}
                </span>
              </Link>
            </Button>
          </li>
        ))}
      </TodoSection>
    </aside>
  );
}

function TodoSection({
  title,
  icon: Icon,
  tone,
  emptyText,
  children,
}: {
  title: string;
  icon: typeof CircleAlert;
  tone: keyof typeof sectionStyles;
  emptyText: string;
  children: ReactNode;
}) {
  const style = sectionStyles[tone];
  const hasContent = Children.count(children) > 0;

  return (
    <section className="border-border relative border-b p-4 pl-5 last:border-b-0">
      <span className={cn("absolute inset-y-0 left-0 w-[3px]", style.bar)} aria-hidden />
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className={cn("flex size-7 items-center justify-center rounded-sm border", style.icon)}
        >
          <Icon className="size-3.5" aria-hidden />
        </span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <ul className="flex flex-col">
        {children}
        {!hasContent ? (
          <li className="text-muted-foreground py-4 text-center text-xs">{emptyText}</li>
        ) : null}
      </ul>
    </section>
  );
}
