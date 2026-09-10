import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { projectsApi } from "@/features/projects/api";
import { levelVariant, statusVariant } from "@/features/projects/status-style";
import type { Project } from "@/features/projects/types";
import { gsap, useGSAP } from "@/lib/gsap";

const TABS = ["概览", "测试项", "用例", "执行记录", "问题单", "文档产出"] as const;

export function Component() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const projectQuery = useQuery({
    queryKey: ["projects", "detail", projectId],
    queryFn: () => projectsApi.detail(projectId ?? ""),
    enabled: Boolean(projectId),
  });
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("概览");
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from(".workbench-reveal", {
        opacity: 0,
        y: 14,
        duration: 0.45,
        stagger: 0.06,
        ease: "power3.out",
      });
    },
    { scope: containerRef },
  );

  if (projectQuery.isPending) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <span className="text-muted-foreground text-sm">正在加载项目工作台</span>
      </div>
    );
  }

  if (projectQuery.isError || !projectQuery.data) {
    return <Navigate to="/" replace />;
  }

  const project = projectQuery.data;
  const rate = Math.round((project.casesExecuted / Math.max(project.casesTotal, 1)) * 100);

  return (
    <div ref={containerRef} className="flex flex-col gap-5">
      <header className="workbench-reveal flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground -ml-2 w-fit"
          onClick={() => navigate("/")}
        >
          <ArrowLeft data-icon="inline-start" />
          返回项目列表
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            <span className="text-muted-foreground mr-2 font-mono text-lg">{project.id}</span>
            {project.name}
          </h1>
          <Badge variant={statusVariant[project.status]}>
            <span className="status-dot" aria-hidden />
            {project.status}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Tag label="性质" value={project.nature} />
          <Tag label="软件" value={project.softwareType} />
          <Tag label="密级" value={project.classification} />
          <Badge variant={levelVariant[project.level]}>安全等级 {project.level}</Badge>
          <Tag label="平台" value={project.platform} />
          <Tag label="研制单位" value={project.organization || "未设置"} />
          <Tag label="负责人" value={project.owner} />
          <Tag label="用例" value={`${project.casesExecuted}/${project.casesTotal} · ${rate}%`} />
          <span className="text-muted-foreground font-mono">更新 {project.updatedAt}</span>
        </div>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as (typeof TABS)[number])}
      >
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
          {TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="概览">
          <OverviewTab project={project} />
        </TabsContent>
        {TABS.filter((tab) => tab !== "概览").map((tab) => (
          <TabsContent key={tab} value={tab}>
            <div className="panel-surface border-border flex min-h-48 items-center justify-center rounded-sm border">
              <p className="text-muted-foreground text-sm">「{tab}」模块将在项目流程推进后接入。</p>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function Tag({ label, value }: { label: string; value: string }) {
  return (
    <Badge variant="outline" className="bg-card/70">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </Badge>
  );
}

function OverviewTab({ project }: { project: Project }) {
  const modules = [
    { name: "测试项", value: "0" },
    { name: "测试用例", value: String(project.casesTotal) },
    { name: "执行记录", value: String(project.casesExecuted) },
    { name: "问题单", value: "0" },
    { name: "文档产出", value: "0" },
    { name: "回归轮次", value: "0" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <section className="panel-surface border-border rounded-sm border p-4">
        <h2 className="mb-3 text-sm font-semibold">项目基础信息</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-[13px] lg:grid-cols-4">
          <InfoItem label="项目标识" value={project.id} />
          <InfoItem label="测评性质" value={project.nature} />
          <InfoItem label="测试平台" value={project.platform} />
          <InfoItem label="软件类型" value={project.softwareType} />
          <InfoItem label="密级" value={project.classification} />
          <InfoItem label="安全等级" value={project.level} />
          <InfoItem label="研制单位" value={project.organization || "未设置"} />
          <InfoItem label="项目负责人" value={project.owner} />
          <InfoItem label="编程语言" value={project.languages.join("、") || "--"} />
          <InfoItem label="运行环境" value={project.runtimeEnvironments.join("、") || "--"} />
          <InfoItem label="开发环境" value={project.developmentEnvironments.join("、") || "--"} />
          <InfoItem label="项目状态" value={project.status} />
        </dl>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_minmax(260px,360px)]">
        <div className="panel-surface border-border grid grid-cols-2 gap-px rounded-sm border bg-border/60 lg:grid-cols-3">
          {modules.map((m) => (
            <div
              key={m.name}
              className="group bg-card hover:bg-primary/4 flex min-h-20 flex-col justify-center gap-1 p-4 transition-[background-color,box-shadow] duration-200 hover:shadow-[inset_2px_0_0_var(--primary)]"
            >
              <span className="text-muted-foreground text-xs">{m.name}</span>
              <span className="font-mono text-xl font-semibold">{m.value}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <section className="panel-surface border-border rounded-sm border p-4">
            <h2 className="mb-3 text-sm font-semibold">依据标准</h2>
            {project.referenceStandards.length ? (
              <ul className="flex flex-col gap-2 text-xs">
                {project.referenceStandards.map((standard) => (
                  <li key={standard.name} className="border-border border-l-2 pl-3">
                    <span className="font-medium">{standard.name}</span>
                    <span className="text-muted-foreground mt-0.5 block">
                      {[standard.code, standard.publishedDate, standard.source]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-xs">未选择依据标准</p>
            )}
          </section>

          <section className="panel-surface border-border rounded-sm border p-4">
            <h2 className="mb-3 text-sm font-semibold">项目成员</h2>
            <ul className="flex flex-wrap gap-2">
              {project.members.map((member) => (
                <li key={member.id}>
                  <Badge variant={member.isOwner ? "primary" : "outline"}>
                    {member.displayName}
                    {member.isOwner ? " · 负责人" : ""}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
