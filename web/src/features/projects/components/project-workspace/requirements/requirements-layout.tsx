import type { ReactNode } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

export function RequirementsLayout({
  header,
  tree,
  detail,
  resizable,
}: {
  header: ReactNode;
  tree: ReactNode;
  detail: ReactNode;
  resizable: boolean;
}) {
  if (!resizable) {
    return (
      <div className="requirements-narrow-layout">
        {header}
        {tree}
        {detail}
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      id="requirements-workbench"
      resizeTargetMinimumSize={{ coarse: 36, fine: 24 }}
    >
      <ResizablePanel
        id="requirements-tree"
        className="requirements-tree-panel-frame"
        defaultSize="34%"
        minSize="20%"
        maxSize="46%"
      >
        {tree}
      </ResizablePanel>
      <ResizableHandle id="requirements-tree-separator" aria-label="调整需求树宽度" />
      <ResizablePanel id="requirements-detail" className="requirements-right-panel-frame">
        <div className="requirements-right-pane">
          {header}
          {detail}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
