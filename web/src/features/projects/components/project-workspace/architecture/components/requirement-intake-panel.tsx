import { FileSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { requirementIntakeSteps } from "../model";
import { WorkspacePanel } from "./workspace-panel";

const statusLabel = {
  done: "已定",
  modeling: "建模中",
  pending: "待开发",
} as const;

export function RequirementIntakePanel() {
  return (
    <WorkspacePanel
      icon={FileSearch}
      title="需求导入链路"
      description="从文档登记到版本比对的五步确认流。"
      contentClassName="space-y-0"
    >
      {requirementIntakeSteps.map((step, index) => (
        <div key={step.id} className="workspace-step-row">
          <span className="workspace-step-index font-mono">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold">{step.title}</span>
              <Badge variant="outline" className="h-5 shrink-0 px-2 text-[11px]">
                {statusLabel[step.status]}
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.detail}</p>
          </div>
        </div>
      ))}
    </WorkspacePanel>
  );
}
