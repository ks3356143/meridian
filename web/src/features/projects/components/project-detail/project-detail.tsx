import {
  Activity,
  ArrowLeft,
  ExternalLink,
  FolderKanban,
  Layers,
  ListChecks,
  ShieldAlert,
} from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { gsap, useGSAP } from "@/lib/gsap";
import { levelVariant, statusVariant } from "../../status-style";
import { totalOpenIssues, type Project } from "../../types";
import {
  getProjectReadiness,
  getProjectStages,
  getStageIndex,
  workspacePath,
  type DetailTabValue,
} from "./status-model";
import { ProjectDetailTabs } from "./project-detail-tabs";

export function ProjectDetail({ project }: { project: Project }) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<DetailTabValue>("overview");
  const executionRate = Math.round((project.casesExecuted / Math.max(project.casesTotal, 1)) * 100);
  const openIssues = totalOpenIssues(project.openIssues);
  const modules = getProjectReadiness(project);
  const readyModules = modules.filter((module) => module.state === "ready").length;
  const stages = getProjectStages();
  const stageIndex = getStageIndex(project.status);

  useGSAP(
    () => {
      if (!containerRef.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.fromTo(
        ".project-detail-enter",
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.34, stagger: 0.06, ease: "power3.out" },
      );
      gsap.fromTo(
        ".project-detail-enter-item",
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.28, stagger: 0.035, ease: "power3.out" },
      );
    },
    { scope: containerRef },
  );

  return (
    <div ref={containerRef} className="flex min-w-0 flex-col gap-5">
      <header className="project-detail-hero project-detail-enter panel-surface relative overflow-hidden rounded-sm border">
        <span
          className="from-primary via-info to-warning absolute inset-y-0 left-0 w-2 bg-gradient-to-b"
          aria-hidden
        />
        <div className="relative z-10 grid gap-5 p-4 pl-6 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex items-start gap-3">
              <Button
                variant="ghost"
                size="icon-sm"
                className="mt-0.5"
                aria-label="返回项目列表"
                onClick={() => navigate("/")}
              >
                <ArrowLeft aria-hidden />
              </Button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-primary font-mono text-sm font-bold tracking-wide">
                    {project.id}
                  </span>
                  <Badge variant={statusVariant[project.status]}>
                    <span className="status-dot" aria-hidden />
                    {project.status}
                  </Badge>
                  <Badge variant={levelVariant[project.level]}>安全 {project.level}</Badge>
                </div>
                <h1 className="mt-2.5 text-xl leading-snug font-bold tracking-tight break-words sm:text-2xl">
                  {project.name}
                </h1>
              </div>
            </div>

            <dl className="bg-card/45 border-border/70 grid grid-cols-2 gap-3 rounded-sm border p-3 backdrop-blur-[2px] sm:grid-cols-3 xl:grid-cols-4">
              <MetadataItem label="性质" value={project.nature} />
              <MetadataItem label="平台" value={project.platform} />
              <MetadataItem label="软件" value={project.softwareType} />
              <MetadataItem label="密级" value={project.classification} />
              <MetadataItem label="负责人" value={project.owner} />
              <MetadataItem label="研制单位" value={project.organization || "未设置"} />
              <MetadataItem
                label="执行"
                value={`${project.casesExecuted}/${project.casesTotal} · ${executionRate}%`}
                mono
              />
              <MetadataItem
                label="未闭环"
                value={String(openIssues)}
                mono
                tone={openIssues > 0 ? "danger" : "default"}
              />
            </dl>
          </div>

          <aside className="bg-card/58 border-primary/28 flex min-w-0 flex-col gap-4 rounded-sm border p-4 shadow-[0_1px_2px_rgb(20_42_30_/0.05),0_10px_22px_-16px_var(--primary)] backdrop-blur-[2px]">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-muted-foreground text-[11px] font-semibold">当前阶段</p>
                <p className="mt-1.5 truncate text-sm font-bold">{project.status}</p>
              </div>
              <span className="text-primary border-primary/30 bg-primary/12 flex size-11 shrink-0 items-center justify-center rounded-sm border">
                <FolderKanban className="size-5" aria-hidden />
              </span>
            </div>
            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground text-[11px]">阶段推进</span>
                <span className="text-primary font-mono text-xs font-bold">
                  {stageIndex + 1}/{stages.length}
                </span>
              </div>
              <Progress
                value={((stageIndex + 1) / stages.length) * 100}
                className="mt-2 h-1.5"
                aria-label="项目阶段推进"
              />
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={() => navigate(workspacePath(project.id))}
            >
              <ExternalLink data-icon="inline-start" aria-hidden />
              进入工作区
            </Button>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              {project.status === "编制大纲中" ? "默认定位：大纲编制" : "默认定位：执行总览"}
            </p>
          </aside>
        </div>

        <div className="border-border/75 relative z-10 grid gap-3 border-t p-4 sm:grid-cols-2 xl:grid-cols-4">
          <HeroMetric
            icon={Layers}
            tone="primary"
            label="资料就绪"
            value={`${readyModules}/${modules.length}`}
            detail={readyModules === modules.length ? "模块已具备" : "仍有模块待补齐"}
          />
          <HeroMetric
            icon={ListChecks}
            tone="info"
            label="用例执行"
            value={`${project.casesExecuted}/${project.casesTotal}`}
            detail={`执行率 ${executionRate}%`}
          />
          <HeroMetric
            icon={ShieldAlert}
            tone={openIssues > 0 ? "danger" : "success"}
            label="未闭环问题"
            value={String(openIssues)}
            detail={openIssues > 0 ? "需要跟踪处理" : "当前无未闭环项"}
          />
          <HeroMetric
            icon={Activity}
            tone="chart"
            label="最近更新"
            value={project.updatedAt}
            detail="项目状态快照"
          />
        </div>
      </header>

      <div className="project-detail-enter min-w-0">
        <ProjectDetailTabs project={project} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
}

function MetadataItem({
  label,
  value,
  mono,
  tone = "default",
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <div className="border-border/70 min-w-0 flex flex-col gap-1.5 border-l pl-2.5">
      <dt className="text-muted-foreground text-[11px] leading-none">{label}</dt>
      <dd
        className={cn(
          "truncate text-xs leading-none font-semibold",
          mono && "font-mono tabular-nums",
          tone === "danger" ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function HeroMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Layers;
  label: string;
  value: string;
  detail: string;
  tone: "primary" | "info" | "success" | "danger" | "chart";
}) {
  return (
    <div
      data-tonal-panel={tone}
      className="project-detail-enter-item flex min-w-0 items-center gap-3 p-3 pl-3.5"
    >
      <span className="border-border/60 bg-card/65 flex size-9 shrink-0 items-center justify-center rounded-sm border">
        <Icon
          className={cn(
            "size-4",
            tone === "primary" && "text-primary",
            tone === "info" && "text-info",
            tone === "success" && "text-success",
            tone === "danger" && "text-destructive",
            tone === "chart" && "text-chart-2",
          )}
          aria-hidden
        />
      </span>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[11px] leading-none">{label}</p>
        <p
          className={cn(
            "mt-1.5 truncate text-base leading-none font-bold",
            tone === "danger" ? "text-destructive" : "text-foreground",
            (label === "资料就绪" || label === "用例执行") && "font-mono tabular-nums",
          )}
        >
          {value}
        </p>
        <p className="text-muted-foreground mt-1.5 truncate text-[11px] leading-none">{detail}</p>
      </div>
    </div>
  );
}
