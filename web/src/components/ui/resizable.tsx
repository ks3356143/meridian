import { GripVertical } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { cn } from "cn";

function ResizablePanelGroup({ className, ...props }: React.ComponentProps<typeof Group>) {
  return <Group className={cn("h-full min-h-0", className)} {...props} />;
}

function ResizablePanel({ className, ...props }: React.ComponentProps<typeof Panel>) {
  return <Panel className={cn("h-full min-h-0", className)} {...props} />;
}

function ResizableHandle({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      className={cn(
        "workspace-resizable-handle group/handle relative flex w-1.5 items-center justify-center",
        className,
      )}
      {...props}
    >
      <GripVertical
        className="text-muted-foreground size-3.5 transition-colors duration-200 group-hover/handle:text-primary"
        aria-hidden
      />
    </Separator>
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
