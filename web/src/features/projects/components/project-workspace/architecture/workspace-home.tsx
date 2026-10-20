import { useOutletContext } from "react-router";
import { useRef, type CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { gsap, useGSAP } from "@/lib/gsap";
import type { ProjectWorkspaceOutletContext } from "../project-workspace-layout";
import { CurrentTaskPanel } from "./components/current-task-panel";
import { DataFlowPanel } from "./components/data-flow-panel";
import { ReadinessPanel } from "./components/readiness-panel";
import { RequirementIntakePanel } from "./components/requirement-intake-panel";
import { TestItemTreePanel } from "./components/test-item-tree-panel";

export function WorkspaceHome() {
  const { project, executionRate, openIssues } = useOutletContext<ProjectWorkspaceOutletContext>();
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .fromTo(
          "[data-home-hero]",
          { opacity: 0, y: 10, scale: 0.998, willChange: "transform, opacity" },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.34,
            clearProps: "transform,opacity,willChange",
          },
        )
        .fromTo(
          "[data-home-metric]",
          { opacity: 0.2, y: 6, willChange: "transform, opacity" },
          {
            opacity: 1,
            y: 0,
            duration: 0.24,
            stagger: 0.045,
            clearProps: "transform,opacity,willChange",
          },
          "-=0.28",
        )
        .fromTo(
          [".workspace-home-main", ".workspace-home-aside"],
          { opacity: 0.25, y: 8, willChange: "transform, opacity" },
          {
            opacity: 1,
            y: 0,
            duration: 0.3,
            stagger: 0.05,
            clearProps: "transform,opacity,willChange",
          },
          "-=0.2",
        );
    },
    { scope: containerRef },
  );

  return (
    <div ref={containerRef} className="workspace-home">
      <section
        className="workspace-home-hero"
        data-home-hero
        style={
          {
            "--workspace-progress": Math.min(1, Math.max(0, executionRate / 100)),
          } as CSSProperties
        }
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={project.status === "已完成" ? "default" : "secondary"}>
              {project.status}
            </Badge>
            <Badge variant="outline">{project.platform}</Badge>
            <Badge variant="outline">安全 {project.level}</Badge>
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-tight">从当前任务进入项目</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            阶段是推荐路径，不是流程牢笼；工作对象沉淀事实数据，文档与时间口径在生成阶段投影。
          </p>
        </div>
        <dl className="workspace-home-metrics">
          <div data-home-metric>
            <dt>用例执行</dt>
            <dd className="font-mono">{executionRate}%</dd>
          </div>
          <div data-home-metric>
            <dt>未闭环问题</dt>
            <dd className="font-mono">{openIssues}</dd>
          </div>
          <div data-home-metric>
            <dt>测试用例</dt>
            <dd className="font-mono">{project.casesTotal}</dd>
          </div>
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
