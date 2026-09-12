import { BookMarked, Building2, Code2, UserRound, Users } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Project } from "../../types";
import type { DetailPanelTone } from "./tab-meta";

export function ProfileDetailTab({
  project,
  onOpenWorkspace,
}: {
  project: Project;
  onOpenWorkspace: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base leading-none font-semibold">项目资料状态</h2>
          <p className="text-muted-foreground mt-2 text-xs">按档案、环境、人员和依据分区扫描。</p>
        </div>
        <Button type="button" size="sm" onClick={onOpenWorkspace}>
          处理项目资料
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        <ProfileSection
          icon={Building2}
          tone="primary"
          title="基准档案"
          meta={`${project.organization ? "已登记" : "待补齐"} · ${project.owner}`}
        >
          <ProfileField label="研制单位" value={project.organization || "未设置"} />
          <ProfileField label="测评性质" value={project.nature} />
          <ProfileField label="测试平台" value={project.platform} />
          <ProfileField label="软件类型" value={project.softwareType} />
          <ProfileField label="密级" value={project.classification} />
          <ProfileField label="最近更新" value={project.updatedAt} mono />
        </ProfileSection>

        <ProfileSection
          icon={Code2}
          tone="info"
          title="环境配置"
          meta={`${project.languages.length + project.runtimeEnvironments.length + project.developmentEnvironments.length} 项配置`}
        >
          <ProfileChipGroup label="编程语言" values={project.languages} />
          <ProfileChipGroup label="运行环境" values={project.runtimeEnvironments} />
          <ProfileChipGroup label="开发环境" values={project.developmentEnvironments} />
        </ProfileSection>

        <ProfileSection
          icon={Users}
          tone="chart"
          title="项目人员"
          meta={`${project.members.length + 1} 人参与`}
        >
          <div className="bg-primary/10 border-primary/25 flex items-center gap-3 rounded-sm border p-3">
            <span className="text-primary bg-primary/12 flex size-8 items-center justify-center rounded-sm">
              <UserRound className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{project.owner}</p>
              <p className="text-muted-foreground mt-1 text-[11px]">项目负责人</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {project.members.map((member) => (
              <Badge
                key={member.id}
                variant={member.isOwner ? "primary" : "info"}
                className="max-w-full"
              >
                <span className="truncate">{member.displayName}</span>
              </Badge>
            ))}
          </div>
        </ProfileSection>

        <ProfileSection
          icon={BookMarked}
          tone="warning"
          title="依据标准"
          meta={`${project.referenceStandards.length} 项已选择`}
        >
          {project.referenceStandards.length ? (
            <ul className="flex flex-col gap-2.5">
              {project.referenceStandards.map((standard) => (
                <li
                  key={standard.id}
                  className="bg-card/65 border-border/70 rounded-sm border p-3 shadow-[inset_2px_0_0_var(--warning)]"
                >
                  <p className="truncate text-xs font-semibold">{standard.name}</p>
                  <p className="text-muted-foreground mt-1.5 truncate font-mono text-[11px]">
                    {[standard.code, standard.publishedDate].filter(Boolean).join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-xs">未选择依据标准</p>
          )}
        </ProfileSection>
      </div>
    </div>
  );
}

function ProfileSection({
  icon: Icon,
  title,
  meta,
  tone,
  children,
}: {
  icon: typeof Building2;
  title: string;
  meta: string;
  tone: DetailPanelTone;
  children: ReactNode;
}) {
  return (
    <section data-tonal-panel={tone} className="flex min-w-0 flex-col gap-4 p-4 pl-4.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="border-border/60 bg-card/70 flex size-9 shrink-0 items-center justify-center rounded-sm border">
            <Icon
              className={cn(
                "size-4",
                tone === "primary" && "text-primary",
                tone === "info" && "text-info",
                tone === "success" && "text-success",
                tone === "warning" && "text-warning",
                tone === "danger" && "text-destructive",
                tone === "chart" && "text-chart-2",
              )}
              aria-hidden
            />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm leading-none font-semibold">{title}</h3>
            <p className="text-muted-foreground mt-1.5 truncate text-[11px] leading-none">{meta}</p>
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
    </section>
  );
}

function ProfileField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-border/70 flex items-center justify-between gap-3 border-b py-2 last:border-b-0">
      <span className="text-muted-foreground shrink-0 text-[11px]">{label}</span>
      <span className={`min-w-0 truncate text-xs font-semibold ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function ProfileChipGroup({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[11px] font-semibold">{label}</p>
      {values.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((value) => (
            <Badge key={value} variant="info" className="max-w-full">
              <span className="truncate">{value}</span>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground mt-2 text-xs">未设置</p>
      )}
    </div>
  );
}
