import { useOutletContext } from "react-router";
import { useRef, type CSSProperties } from "react";
import { Activity, CircleAlert, ListChecks, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { gsap, useGSAP } from "@/lib/gsap";
import type { ProjectWorkspaceOutletContext } from "../project-workspace-layout";
import { CurrentTaskPanel } from "./components/current-task-panel";
import { DataFlowPanel } from "./components/data-flow-panel";
import { ReadinessPanel } from "./components/readiness-panel";
import { RequirementIntakePanel } from "./components/requirement-intake-panel";
import { TestItemTreePanel } from "./components/test-item-tree-panel";
import styles from "./workspace-home.module.css";

export function WorkspaceHome() {
  const { project, executionRate, openIssues } = useOutletContext<ProjectWorkspaceOutletContext>();
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap
        .timeline({ defaults: { ease: "power2.out" } })
        .fromTo(
          "[data-home-hero]",
          { opacity: 0.9 },
          {
            opacity: 1,
            duration: 0.2,
            clearProps: "transform,opacity,willChange",
          },
        )
        .fromTo(
          "[data-home-metric]",
          { opacity: 0.88 },
          {
            opacity: 1,
            duration: 0.18,
            stagger: 0.02,
            clearProps: "transform,opacity,willChange",
          },
          "-=0.16",
        )
        .fromTo(
          [".workspace-home-main", ".workspace-home-aside"],
          { opacity: 0.88 },
          {
            opacity: 1,
            duration: 0.18,
            stagger: 0.03,
            clearProps: "transform,opacity,willChange",
          },
          "-=0.12",
        );
    },
    { scope: containerRef },
  );

  return (
    <div ref={containerRef} className="workspace-home">
      <section
        className={styles.hero}
        data-home-hero
        style={
          {
            "--workspace-progress": Math.min(1, Math.max(0, executionRate / 100)),
          } as CSSProperties
        }
      >
        <div className={styles.heroMain}>
          <div className={styles.eyebrowRow}>
            <Badge variant={project.status === "已完成" ? "default" : "secondary"}>
              {project.status}
            </Badge>
            <Badge variant="outline">{project.platform}</Badge>
            <Badge variant="outline">安全 {project.level}</Badge>
          </div>

          <div className={styles.titleBlock}>
            <span className={styles.kicker}>WORKBENCH · 作业台</span>
            <div className={styles.titleRow}>
              <span className={styles.titleAccent} aria-hidden />
              <h2 className={styles.title}>从当前任务进入项目</h2>
            </div>
          </div>

          <p className={styles.description}>
            阶段是推荐路径，不是流程牢笼；工作对象沉淀事实数据，文档与时间口径在生成阶段投影。
          </p>
        </div>

        <dl className={styles.metrics}>
          <MetricTile icon={Activity} label="用例执行" value={`${executionRate}%`} tone="primary" />
          <MetricTile
            icon={CircleAlert}
            label="未闭环问题"
            value={openIssues}
            tone={openIssues > 0 ? "warning" : "neutral"}
          />
          <MetricTile icon={ListChecks} label="测试用例" value={project.casesTotal} tone="info" />
        </dl>
      </section>

      <div className="workspace-home-grid">
        <div className="workspace-home-main">
          <CurrentTaskPanel project={project} />
          <DataFlowPanel />
        </div>
        <aside className="workspace-home-aside">
          <TestItemTreePanel />
          <RequirementIntakePanel />
          <ReadinessPanel />
        </aside>
      </div>
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  tone: "primary" | "warning" | "info" | "neutral";
}) {
  return (
    <div className={styles.metricItem} data-home-metric data-tone={tone}>
      <span className={styles.metricIcon} aria-hidden>
        <Icon />
      </span>
      <div className={styles.metricCopy}>
        <dt>{label}</dt>
        <dd className="font-mono">{value}</dd>
      </div>
    </div>
  );
}
