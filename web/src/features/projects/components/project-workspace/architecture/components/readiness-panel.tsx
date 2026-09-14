import { CircleCheck, CircleDashed, Loader } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { workspaceReadiness } from "../model";
import { WorkspacePanel } from "./workspace-panel";

const statusConfig = {
  done: { label: "已落地", value: 100, icon: CircleCheck },
  modeling: { label: "建模中", value: 45, icon: Loader },
  pending: { label: "待开发", value: 0, icon: CircleDashed },
} as const;

export function ReadinessPanel() {
  return (
    <WorkspacePanel
      icon={Loader}
      title="模块落地进度"
      description="架构首版只落壳与模型，业务能力分模块接入。"
      contentClassName="space-y-3"
    >
      {workspaceReadiness.map((item) => {
        const config = statusConfig[item.status];
        const Icon = config.icon;
        return (
          <div key={item.id} className="workspace-readiness-item">
            <div className="flex min-w-0 items-center gap-2">
              <Icon className="size-3.5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
              <Badge variant="outline" className="h-5 shrink-0 px-2 text-[11px]">
                {config.label}
              </Badge>
            </div>
            <Progress value={config.value} className="mt-2 h-1" />
          </div>
        );
      })}
    </WorkspacePanel>
  );
}
