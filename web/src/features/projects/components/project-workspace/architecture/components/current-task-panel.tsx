import { ArrowRight, CircleCheck } from "lucide-react";
import { useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import type { Project } from "../../../../types";
import { getWorkspaceArchitectureTasks, type ArchitectureTaskTone } from "../model";
import { WorkspacePanel } from "./workspace-panel";

const toneClassName: Record<ArchitectureTaskTone, string> = {
  primary: "workspace-task-primary",
  info: "workspace-task-info",
  warning: "workspace-task-warning",
  danger: "workspace-task-danger",
};

export function CurrentTaskPanel({ project }: { project: Project }) {
  const navigate = useNavigate();
  const tasks = getWorkspaceArchitectureTasks(project);

  return (
    <WorkspacePanel
      icon={CircleCheck}
      title="当前任务"
      description="按项目状态、资料准备度和问题风险生成作业队列。"
      action={<Badge variant="outline">架构基线</Badge>}
      contentClassName="space-y-2"
    >
      {tasks.map((task) => (
        <article key={task.id} className="workspace-task-row">
          <span className={cn("workspace-task-rail", toneClassName[task.tone])} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold">{task.title}</h3>
              <Badge variant="outline" className="h-5 px-2 text-[11px]">
                {task.badge}
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{task.detail}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => navigate(`/projects/${project.id}/workspace/${task.path}`)}
          >
            {task.action}
            <ArrowRight data-icon="inline-end" aria-hidden />
          </Button>
        </article>
      ))}
    </WorkspacePanel>
  );
}
