import { CalendarClock, CircleAlert, ListChecks } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { totalOpenIssues, type Project } from "../types";

interface TodoPanelProps {
  projects: Project[];
}

const itemButtonClass =
  "hover:bg-primary/6 focus-visible:bg-primary/8 h-auto w-full justify-between rounded-none px-1 py-2.5 text-left text-[13px]";

export function TodoPanel({ projects }: TodoPanelProps) {
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

  return (
    <aside className="panel-surface border-border flex w-full shrink-0 flex-col rounded-sm border min-[1760px]:w-80">
      <section className="border-border border-b p-4">
        <div className="mb-3 flex items-center gap-2">
          <CircleAlert className="text-destructive size-4" aria-hidden />
          <h2 className="text-sm font-semibold">未闭环问题</h2>
        </div>
        <ul className="flex flex-col">
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
                  <span className="flex shrink-0 flex-col items-end">
                    <span
                      className={`font-mono text-sm font-semibold ${
                        item.urgent > 0 ? "text-destructive" : ""
                      }`}
                    >
                      {item.count}
                    </span>
                    {item.urgent > 0 ? (
                      <span className="text-destructive text-xs">重大/严重 {item.urgent}</span>
                    ) : null}
                  </span>
                </Link>
              </Button>
            </li>
          ))}
          {openIssues.length === 0 ? (
            <li className="text-muted-foreground py-4 text-center text-xs">当前没有未闭环问题</li>
          ) : null}
        </ul>
      </section>

      <section className="border-border border-b p-4">
        <div className="mb-3 flex items-center gap-2">
          <ListChecks className="text-primary size-4" aria-hidden />
          <h2 className="text-sm font-semibold">待执行用例</h2>
        </div>
        <ul className="flex flex-col">
          {pendingCases.map((p) => (
            <li key={p.id}>
              <Button asChild variant="ghost" className={itemButtonClass}>
                <Link to={`/projects/${p.id}`}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="text-muted-foreground block font-mono text-xs">{p.id}</span>
                  </span>
                  <span className="text-primary shrink-0 font-mono text-sm font-medium">
                    {p.casesTotal - p.casesExecuted}
                  </span>
                </Link>
              </Button>
            </li>
          ))}
          {pendingCases.length === 0 ? (
            <li className="text-muted-foreground py-4 text-center text-xs">全部用例已执行</li>
          ) : null}
        </ul>
      </section>

      <section className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock className="text-muted-foreground size-4" aria-hidden />
          <h2 className="text-sm font-semibold">最近更新</h2>
        </div>
        <ul className="flex flex-col">
          {[...projects]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, 4)
            .map((p) => (
              <li key={p.id}>
                <Button asChild variant="ghost" className={itemButtonClass}>
                  <Link to={`/projects/${p.id}`}>
                    <span className="text-muted-foreground font-mono text-xs">{p.id}</span>
                    <span className="text-muted-foreground font-mono text-xs">{p.updatedAt}</span>
                  </Link>
                </Button>
              </li>
            ))}
          {projects.length === 0 ? (
            <li className="text-muted-foreground py-4 text-center text-xs">暂无项目</li>
          ) : null}
        </ul>
      </section>
    </aside>
  );
}
