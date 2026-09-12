import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleDashed,
  FileText,
  ListChecks,
  Settings2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import type { Project } from "@/features/projects/types";
import { buildSections, type OutlineStatus } from "./outline-model";

const statusMeta: Record<
  OutlineStatus,
  { label: string; variant: "success" | "warning" | "outline" | "info" }
> = {
  ready: { label: "已具备", variant: "success" },
  partial: { label: "待补齐", variant: "warning" },
  missing: { label: "未录入", variant: "outline" },
  auto: { label: "模板生成", variant: "info" },
};

export function OutlineWorkbench({ project }: { project: Project }) {
  const navigate = useNavigate();
  const sections = useMemo(() => buildSections(project), [project]);
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const activeSection = sections.find((section) => section.id === activeId) ?? sections[0];
  const readyCount = sections.filter(
    (section) => section.status === "ready" || section.status === "auto",
  ).length;
  const nextTask = sections
    .flatMap((section) => section.tasks.map((task) => ({ section, task })))
    .find((item) => item.section.status !== "ready" && item.section.status !== "auto");

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="panel-surface flex min-w-0 flex-col rounded-sm border">
        <div className="border-border border-b p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <BookOpen className="text-primary size-4 shrink-0" aria-hidden />
              <h2 className="truncate text-sm font-semibold">测评大纲目录</h2>
            </div>
            <Badge variant="primary" className="font-mono">
              {readyCount}/{sections.length}
            </Badge>
          </div>
          <Progress
            value={(readyCount / sections.length) * 100}
            className="mt-3 h-1.5"
            aria-label="测评大纲完善度"
          />
          <p className="text-muted-foreground mt-2 text-[11px]">
            按模板章节引导录入，不做空白文档。
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-2" role="tree" aria-label="测评大纲章节">
          {sections.map((section) => {
            const active = section.id === activeSection?.id;
            return (
              <Button
                key={section.id}
                role="treeitem"
                variant="ghost"
                size="sm"
                className={cn(
                  "mt-1 h-auto w-full justify-start px-2 py-2 text-left first:mt-0",
                  active && "bg-primary/12 font-semibold text-primary hover:bg-primary/10",
                )}
                aria-current={active ? "true" : undefined}
                onClick={() => setActiveId(section.id)}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground font-mono text-[11px]">
                      {section.code}
                    </span>
                    <span className="truncate text-xs font-medium">{section.title}</span>
                  </span>
                </span>
                <SectionStatusIcon status={section.status} />
              </Button>
            );
          })}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col gap-4">
        <section className="panel-surface relative overflow-hidden rounded-sm border">
          <span className="bg-primary absolute inset-y-0 left-0 w-1.5" aria-hidden />
          <div className="grid gap-4 p-4 pl-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-primary font-mono text-xs font-semibold">
                  {activeSection?.code}
                </span>
                <Badge variant={statusMeta[activeSection?.status ?? "missing"].variant}>
                  {statusMeta[activeSection?.status ?? "missing"].label}
                </Badge>
              </div>
              <h2 className="mt-2 text-xl leading-snug font-bold">{activeSection?.title}</h2>
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                本章内容由模板固定话术、项目基准数据和章节内容块组成。先补任务项，再在大纲预览中核对。
              </p>
            </div>
            <div className="border-border bg-muted/35 grid gap-3 p-3 lg:border-l lg:pl-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold">下一步</p>
                <Badge variant={nextTask ? "warning" : "success"}>
                  {nextTask ? "待录入" : "可预检"}
                </Badge>
              </div>
              <p className="min-h-8 text-xs leading-relaxed font-medium">
                {nextTask
                  ? nextTask.task.label
                  : "大纲所需数据已具备基础口径，可进入文档产出预检。"}
              </p>
              <Button
                size="sm"
                type="button"
                onClick={() =>
                  navigate(
                    nextTask
                      ? `/projects/${project.id}/workspace${nextTask.task.to}`
                      : `/projects/${project.id}/workspace/documents`,
                  )
                }
              >
                {nextTask ? "去录入" : "去预检"}
                <ArrowRight data-icon="inline-end" aria-hidden />
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Card data-tone="primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="text-primary size-4" aria-hidden />
                本章录入任务
              </CardTitle>
              <CardDescription>任务完成后，大纲目录树和生成预检同步更新。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {activeSection?.tasks.length ? (
                activeSection.tasks.map((task) => (
                  <article
                    key={task.label}
                    className="border-border bg-primary/4 flex min-w-0 flex-col gap-2 rounded-sm border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-xs font-semibold">{task.label}</h3>
                      <Button
                        variant="ghost"
                        size="xs"
                        type="button"
                        onClick={() => navigate(`/projects/${project.id}/workspace${task.to}`)}
                      >
                        进入
                        <ArrowRight data-icon="inline-end" aria-hidden />
                      </Button>
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {task.description}
                    </p>
                  </article>
                ))
              ) : (
                <p className="text-muted-foreground text-xs">
                  本章由模板固定话术生成，无需人工录入。
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card data-tone="info" size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="text-info size-4" aria-hidden />
                  当前项目口径
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-xs">
                <InfoRow label="测评性质" value={project.nature} />
                <InfoRow label="测试平台" value={project.platform} />
                <InfoRow label="安全等级" value={project.level} />
                <InfoRow label="依据标准" value={`${project.referenceStandards.length} 项`} />
                <Separator />
                <p className="text-muted-foreground leading-relaxed">
                  这些字段直接进入大纲封面、测试性质、对象信息和策略章节。
                </p>
              </CardContent>
            </Card>

            <Card data-tone="chart" size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="text-chart-2 size-4" aria-hidden />
                  大纲预览策略
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-xs">
                <PreviewItem>已选章节实时拼装骨架</PreviewItem>
                <PreviewItem>富文本章节显示块预览</PreviewItem>
                <PreviewItem>生成前执行阻断项预检</PreviewItem>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="mt-1"
                  onClick={() => navigate(`/projects/${project.id}/workspace/documents`)}
                >
                  查看文档产出
                  <ArrowRight data-icon="inline-end" aria-hidden />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionStatusIcon({ status }: { status: OutlineStatus }) {
  if (status === "ready" || status === "auto") {
    return <CheckCircle2 className="text-success size-3.5 shrink-0" aria-hidden />;
  }
  if (status === "partial") {
    return <CircleDashed className="text-warning size-3.5 shrink-0" aria-hidden />;
  }
  return <CircleDashed className="text-muted-foreground size-3.5 shrink-0" aria-hidden />;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}

function PreviewItem({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="bg-chart-2 size-1.5 shrink-0 rounded-full" aria-hidden />
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}
