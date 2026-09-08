import { CalendarClock, CircleAlert, ListChecks } from "lucide-react";
import { totalOpenIssues, type Project } from "../types";

interface TodoPanelProps {
  projects: Project[];
}

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
    <aside className="border-border bg-card flex w-80 shrink-0 flex-col border">
      <section className="border-border border-b p-4">
        <div className="mb-3 flex items-center gap-2">
          <CircleAlert className="text-destructive size-4" aria-hidden />
          <h2 className="text-sm font-semibold">未闭环问题</h2>
        </div>
        <ul className="flex flex-col">
          {openIssues.map((item) => (
            <li
              key={item.projectId}
              className="border-border/60 hover:bg-primary/5 flex cursor-pointer items-center justify-between gap-3 border-b px-1 py-2.5 text-[13px] transition-colors last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{item.projectName}</p>
                <p className="text-muted-foreground font-mono text-xs">{item.projectId}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end">
                <span
                  className={`font-mono text-sm font-semibold ${item.urgent > 0 ? "text-destructive" : ""}`}
                >
                  {item.count}
                </span>
                {item.urgent > 0 ? (
                  <span className="text-destructive text-xs">重大/严重 {item.urgent}</span>
                ) : null}
              </div>
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
            <li
              key={p.id}
              className="border-border/60 hover:bg-primary/5 flex cursor-pointer items-center justify-between gap-3 border-b px-1 py-2.5 text-[13px] transition-colors last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-muted-foreground font-mono text-xs">{p.id}</p>
              </div>
              <span className="text-primary shrink-0 font-mono text-sm font-medium">
                {p.casesTotal - p.casesExecuted}
              </span>
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
              <li
                key={p.id}
                className="border-border/60 flex items-center justify-between gap-3 border-b px-1 py-2 text-[13px] last:border-b-0"
              >
                <span className="text-muted-foreground font-mono text-xs">{p.id}</span>
                <span className="text-muted-foreground font-mono text-xs">{p.updatedAt}</span>
              </li>
            ))}
        </ul>
      </section>
    </aside>
  );
}
