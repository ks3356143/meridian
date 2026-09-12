import { ClipboardList } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Project } from "../../types";
import { getProjectReadiness, getProjectStages, getStageIndex } from "./status-model";
import { DETAIL_TABS, MODULE_TONES } from "./tab-meta";
import { StateChip } from "./status-panel";

export function OverviewDetailTab({
  project,
  onEnterWorkspace,
}: {
  project: Project;
  onEnterWorkspace: () => void;
}) {
  const modules = getProjectReadiness(project);
  const focusModuleKey = modules.find((module) => module.state !== "ready")?.key;

  return (
    <section className="panel-surface flex flex-col gap-5 rounded-sm border p-4 sm:p-5">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h2 className="text-base leading-none font-semibold">阶段与模块状态</h2>
        <Button type="button" size="sm" onClick={onEnterWorkspace}>
          进入工作区
        </Button>
      </div>
      <StageStrip project={project} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {modules.map((module) => (
          <ModuleStatusTile
            key={module.key}
            module={module}
            isFocus={module.key === focusModuleKey}
          />
        ))}
      </div>
    </section>
  );
}

function StageStrip({ project }: { project: Project }) {
  const stages = getProjectStages();
  const activeIndex = getStageIndex(project.status);

  return (
    <ol className="detail-stage-strip" aria-label="项目阶段">
      {stages.map((stage, index) => {
        const active = index === activeIndex;
        const done = index < activeIndex;
        return (
          <li
            key={stage}
            className={cn(
              "detail-stage-item",
              active && "detail-stage-active",
              done && "detail-stage-done",
              !active && !done && "detail-stage-upcoming",
            )}
            aria-current={active ? "step" : undefined}
          >
            <span className="detail-stage-index">{String(index + 1).padStart(2, "0")}</span>
            <span className="truncate">{stage}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ModuleStatusTile({
  module,
  isFocus,
}: {
  module: ReturnType<typeof getProjectReadiness>[number];
  isFocus: boolean;
}) {
  const tab = DETAIL_TABS.find((item) => item.value === module.key);
  const Icon = tab?.icon ?? ClipboardList;

  return (
    <div
      data-tonal-panel={MODULE_TONES[module.key]}
      data-module-state={module.state}
      data-module-focus={isFocus ? "true" : undefined}
      className="detail-module-card flex min-w-0 flex-col gap-3 p-3.5 pl-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 shrink-0" aria-hidden />
          <p className="truncate text-xs font-semibold">{module.label}</p>
        </div>
        <StateChip state={module.state}>
          {module.state === "ready" ? "已具备" : module.state === "partial" ? "部分具备" : "待补齐"}
        </StateChip>
      </div>
      <Progress
        value={module.progress}
        className="detail-status-progress h-1"
        aria-label={`${module.label}完成度`}
      />
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{module.primary}</p>
        <p className="text-muted-foreground mt-1 truncate text-[11px]">{module.secondary}</p>
      </div>
    </div>
  );
}
