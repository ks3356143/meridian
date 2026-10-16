import { ArrowRight, CircleAlert, ListChecks, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { totalOpenIssues, type Project } from "../types";
import styles from "./risk-activity-bar.module.css";

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

      <div className={styles.grid}>
        {items.map(({ project, urgent, open, pending }) => {
          const reason =
            urgent > 0 ? `重大/严重 ${urgent}` : open > 0 ? `未闭环 ${open}` : `待执行 ${pending}`;
          const tone = urgent > 0 ? "danger" : open > 0 ? "warning" : "info";

          return (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              data-tone={tone}
              className={styles.card}
            >
              <span className={styles.bar} aria-hidden />
              <span className={styles.main}>
                <span className={styles.topRow}>
                  <span className={styles.badge}>{reason}</span>
                  <span className={styles.ident}>{project.id}</span>
                </span>
                <span className={styles.name}>{project.name}</span>
                <span className={styles.footRow}>
                  {pending > 0 ? (
                    <span className={styles.footSignal}>
                      <ListChecks aria-hidden />
                      待执行 {pending}
                    </span>
                  ) : (
                    <span className={`${styles.footSignal} ${styles.footQuiet}`}>
                      <ShieldCheck aria-hidden />
                      无待执行
                    </span>
                  )}
                  <span className={styles.status}>{project.status}</span>
                </span>
              </span>
              <ArrowRight className={styles.arrow} aria-hidden />
            </Link>
          );
        })}
        {items.length === 0 ? (
          <div className={styles.empty}>当前筛选结果没有风险或待执行信号</div>
        ) : null}
      </div>
    </section>
  );
}
