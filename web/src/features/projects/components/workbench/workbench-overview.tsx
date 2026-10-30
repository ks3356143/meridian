import {
  BookOpen,
  FileCheck2,
  FileText,
  FlaskConical,
  ListChecks,
  Play,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { testItemsApi } from "@/features/test-items/api";
import { totalOpenIssues, type Project } from "@/features/projects/types";

type ModuleTone = "info" | "primary" | "warning" | "danger" | "chart" | "success";

const toneText: Record<ModuleTone, string> = {
  info: "text-info",
  primary: "text-primary",
  warning: "text-warning",
  danger: "text-destructive",
  chart: "text-chart-2",
  success: "text-success",
};

const toneIcon: Record<ModuleTone, string> = {
  info: "border-info/35 bg-info/12 text-info",
  primary: "border-primary/35 bg-primary/12 text-primary",
  warning: "border-warning/40 bg-warning/14 text-warning",
  danger: "border-destructive/35 bg-destructive/12 text-destructive",
  chart: "border-chart-2/35 bg-chart-2/12 text-chart-2",
  success: "border-success/35 bg-success/12 text-success",
};

export function WorkbenchOverview({ project, rate }: { project: Project; rate: number }) {
  const roundsQuery = useQuery({
    queryKey: ["projects", project.id, "test-rounds"],
    queryFn: () => testItemsApi.rounds(project.id),
    staleTime: 30_000,
  });
  const laterRoundCount = Math.max((roundsQuery.data?.length ?? 0) - 1, 0);
  const roundsValue = roundsQuery.isPending
    ? "…"
    : roundsQuery.isError
      ? "读取失败"
      : String(laterRoundCount);

  const modules: Array<{
    icon: typeof ListChecks;
    name: string;
    value: string | number;
    tone: ModuleTone;
    note?: string;
    unavailable?: boolean;
  }> = [
    { icon: ListChecks, name: "测试项", value: project.testItemsTotal, tone: "info" },
    { icon: FlaskConical, name: "测试用例", value: project.casesTotal, tone: "primary" },
    { icon: Play, name: "执行记录", value: project.casesExecuted, tone: "warning" },
    {
      icon: ShieldAlert,
      name: "未闭环问题",
      value: totalOpenIssues(project.openIssues),
      tone: "danger",
    },
    {
      icon: FileText,
      name: "文档产出",
      value: "暂未接入",
      tone: "chart",
      note: "文档模块尚未实现",
      unavailable: true,
    },
    {
      icon: FileCheck2,
      name: "第二轮及以后",
      value: roundsValue,
      tone: "success",
      note: roundsQuery.isError ? "轮次数据读取失败" : "不含首轮",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Card data-tone="info" className="overflow-hidden">
        <CardHeader>
          <CardTitle>项目基础信息</CardTitle>
          <CardDescription>供测评大纲首页和交付文档引用的基础元数据。</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-[13px] lg:grid-cols-4">
            <InfoItem label="项目标识" value={project.id} mono />
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
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => (
          <Card
            key={module.name}
            size="sm"
            data-tone={module.tone}
            data-unavailable={module.unavailable ? "true" : undefined}
            className="group overflow-hidden"
          >
            <CardContent className="flex min-h-20 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs font-medium">{module.name}</p>
                <p
                  className={cn(
                    "mt-1 font-mono leading-none font-semibold tabular-nums",
                    module.unavailable ? "text-sm tracking-wide" : "text-2xl",
                    toneText[module.tone],
                  )}
                >
                  {module.value}
                </p>
                {module.note ? (
                  <p className="text-muted-foreground mt-1.5 text-[10px] leading-none">
                    {module.note}
                  </p>
                ) : null}
              </div>
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-sm border",
                  toneIcon[module.tone],
                )}
              >
                <module.icon className="size-4" aria-hidden />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card data-tone="primary" className="overflow-hidden">
        <CardHeader>
          <CardTitle>执行进度</CardTitle>
          <CardDescription>
            {project.casesExecuted} / {project.casesTotal} 条执行记录
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={rate} className="h-2 flex-1" />
            <span className="font-mono text-sm font-semibold">{rate}%</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(280px,380px)]">
        <Card data-tone="warning" className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="text-warning size-4" aria-hidden />
              依据标准
            </CardTitle>
            <CardDescription>按排序值进入测评大纲依据文件章节。</CardDescription>
          </CardHeader>
          <CardContent>
            {project.referenceStandards.length ? (
              <ul className="flex flex-col gap-3 text-xs">
                {project.referenceStandards.map((standard) => (
                  <li key={standard.name} className="border-warning/40 border-l-2 pl-3">
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
          </CardContent>
        </Card>

        <Card data-tone="chart" className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="text-chart-2 size-4" aria-hidden />
              项目成员
            </CardTitle>
            <CardDescription>负责人与项目成员的归属关系。</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={mono ? "font-mono font-medium" : "font-medium"}>{value}</dd>
    </div>
  );
}
