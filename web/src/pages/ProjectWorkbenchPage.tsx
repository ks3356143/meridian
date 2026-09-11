import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  FlaskConical,
  ListChecks,
  Play,
  ShieldAlert,
} from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { QueryError, QueryLoading } from "@/components/shared/query-state";
import { projectsApi } from "@/features/projects/api";
import { WorkbenchOverview } from "@/features/projects/components/workbench/workbench-overview";
import { levelVariant, statusVariant } from "@/features/projects/status-style";
import { gsap, useGSAP } from "@/lib/gsap";

const TABS = [
  { label: "概览", icon: ClipboardList },
  { label: "测试项", icon: ListChecks },
  { label: "用例", icon: FlaskConical },
  { label: "执行记录", icon: Play },
  { label: "问题单", icon: ShieldAlert },
  { label: "文档产出", icon: FileText },
] as const;

export function Component() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const projectQuery = useQuery({
    queryKey: ["projects", "detail", projectId],
    queryFn: () => projectsApi.detail(projectId ?? ""),
    enabled: Boolean(projectId),
  });
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["label"]>("概览");
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
    return <QueryLoading label="正在加载项目工作台" rows={6} />;
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <QueryError
        title="项目工作台加载失败"
        description="项目可能不存在，或后端服务当前不可用。"
        onRetry={() => projectQuery.refetch()}
      />
    );
  }

  const project = projectQuery.data;
  const rate = Math.round((project.casesExecuted / Math.max(project.casesTotal, 1)) * 100);

  return (
    <div ref={containerRef} className="flex flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground -ml-2 w-fit"
        onClick={() => navigate("/")}
      >
        <ArrowLeft data-icon="inline-start" />
        返回项目列表
      </Button>

      <PageHeader
        className="workbench-reveal"
        icon={ClipboardList}
        title={project.name}
        description={project.id}
        badge={
          <Badge variant={statusVariant[project.status]}>
            <span className="status-dot" aria-hidden />
            {project.status}
          </Badge>
        }
      />

      <div className="workbench-reveal flex flex-wrap items-center gap-2 text-xs">
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

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as (typeof TABS)[number]["label"])}
      >
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.label} value={tab.label}>
              <tab.icon aria-hidden />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="概览">
          <WorkbenchOverview project={project} rate={rate} />
        </TabsContent>
        {TABS.filter((tab) => tab.label !== "概览").map((tab) => (
          <TabsContent key={tab.label} value={tab.label}>
            <EmptyModuleTab icon={tab.icon} label={tab.label} />
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

function EmptyModuleTab({
  icon: Icon,
  label,
}: {
  icon: (typeof TABS)[number]["icon"];
  label: string;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="text-muted-foreground flex min-h-48 flex-col items-center justify-center gap-3">
        <span className="border-border bg-muted/50 flex size-11 items-center justify-center rounded-sm border">
          <Icon className="size-5" aria-hidden />
        </span>
        <p className="text-sm">「{label}」模块将在项目流程推进后接入。</p>
      </CardContent>
    </Card>
  );
}
