import { Boxes } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { workspaceTestItemTree, type WorkspaceTestTreeNode } from "../model";
import { WorkspacePanel } from "./workspace-panel";

export function TestItemTreePanel() {
  return (
    <WorkspacePanel
      icon={Boxes}
      title="测试项组织树"
      description="分系统、配置项、功能域只是用户自建文件夹，报告数量在生成时选择。"
      contentClassName="space-y-1.5"
    >
      {workspaceTestItemTree.map((node) => (
        <ScopeNodeItem key={node.id} node={node} level={0} />
      ))}
    </WorkspacePanel>
  );
}

function ScopeNodeItem({ node, level }: { node: WorkspaceTestTreeNode; level: number }) {
  return (
    <div>
      <div
        className="workspace-tree-row"
        style={{ paddingInlineStart: `${level * 1.25 + 0.75}rem` }}
      >
        <span className="workspace-tree-kind">{node.kindLabel}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{node.name}</span>
        <span className="flex shrink-0 gap-1">
          {node.platforms.map((platform) => (
            <Badge key={platform} variant="secondary" className="h-5 px-1.5 text-[10px] uppercase">
              {platform === "common" ? "公共" : platform}
            </Badge>
          ))}
        </span>
      </div>
      {node.children?.map((child) => (
        <ScopeNodeItem key={child.id} node={child} level={level + 1} />
      ))}
    </div>
  );
}
