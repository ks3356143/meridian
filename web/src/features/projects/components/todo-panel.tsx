import { CalendarClock, CircleAlert, ListChecks } from "lucide-react";
import { Children, type ReactNode } from "react";
import { Link } from "react-router";
import { totalOpenIssues, type Project } from "../types";
import styles from "./todo-panel.module.css";

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
    <aside
      aria-label="待办摘要"
      className={`panel-surface border-border rounded-sm border ${styles.panel}`}
    >
      <TodoSection
        title="未闭环问题"
        icon={CircleAlert}
        tone="danger"
        emptyText="当前没有未闭环问题"
      >
        {openIssues.map((item) => (
          <li key={item.projectId}>
            <Link to={`/projects/${item.projectId}`} className={styles.item}>
              <span className={styles.itemMain}>
                <span className={styles.itemName}>{item.projectName}</span>
                <span className={styles.itemMeta}>
                  <span>{item.projectId}</span>
                  {item.urgent > 0 ? (
                    <>
                      <span className={styles.itemMetaDot}>·</span>
                      <span className={styles.itemUrgent}>重大/严重 {item.urgent}</span>
                    </>
                  ) : null}
                </span>
              </span>
              <span className={styles.badge} data-urgent={item.urgent > 0 ? "true" : "false"}>
                {item.count}
              </span>
            </Link>
          </li>
        ))}
      </TodoSection>

      <TodoSection title="待执行用例" icon={ListChecks} tone="primary" emptyText="全部用例已执行">
        {pendingCases.map((p) => (
          <li key={p.id}>
            <Link to={`/projects/${p.id}`} className={styles.item}>
              <span className={styles.itemMain}>
                <span className={styles.itemName}>{p.name}</span>
                <span className={styles.itemMeta}>
                  <span>{p.id}</span>
                </span>
              </span>
              <span className={styles.badge}>{p.casesTotal - p.casesExecuted}</span>
            </Link>
          </li>
        ))}
      </TodoSection>

      <TodoSection title="最近更新" icon={CalendarClock} tone="info" emptyText="暂无项目">
        {recentProjects.map((p) => (
          <li key={p.id}>
            <Link to={`/projects/${p.id}`} className={styles.item}>
              <span className={styles.itemMain}>
                <span className={styles.itemName}>{p.name}</span>
                <span className={styles.itemMeta}>
                  <span>{p.id}</span>
                  <span className={styles.itemMetaDot}>·</span>
                  <span>{p.updatedAt}</span>
                </span>
              </span>
            </Link>
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
  tone: "danger" | "primary" | "info";
  emptyText: string;
  children: ReactNode;
}) {
  const hasContent = Children.count(children) > 0;

  return (
    <section className={styles.section} data-tone={tone}>
      <span className={styles.bar} aria-hidden />
      <div className={styles.header}>
        <span className={styles.iconChip}>
          <Icon aria-hidden />
        </span>
        <h2 className={styles.title}>{title}</h2>
      </div>
      <ul className={styles.list}>
        {children}
        {!hasContent ? <li className={styles.empty}>{emptyText}</li> : null}
      </ul>
    </section>
  );
}
