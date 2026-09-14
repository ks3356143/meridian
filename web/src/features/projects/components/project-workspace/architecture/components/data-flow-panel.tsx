import { ArrowRight, GitBranch } from "lucide-react";
import { workspaceDataFlow } from "../model";
import { WorkspacePanel } from "./workspace-panel";

export function DataFlowPanel() {
  return (
    <WorkspacePanel
      icon={GitBranch}
      title="数据主链路"
      description="页面从权威数据链推导，文档输出与时间口径在生成阶段固化。"
      action={
        <div className="workspace-flow-crosscut">
          <span>校验</span>
          <span>权限</span>
          <span>快照</span>
        </div>
      }
    >
      <div className="workspace-flow-grid">
        {workspaceDataFlow.map((node, index) => (
          <div key={node.id} className="workspace-flow-node">
            {index > 0 ? <ArrowRight className="workspace-flow-arrow" aria-hidden /> : null}
            <div className="workspace-flow-card">
              <span className="text-sm font-semibold">{node.label}</span>
              <span className="mt-1 text-xs leading-snug text-muted-foreground">{node.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </WorkspacePanel>
  );
}
