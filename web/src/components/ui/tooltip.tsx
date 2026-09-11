import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "cn";

function TooltipProvider({
  delayDuration = 180,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />;
}

function Tooltip({ children, ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root {...props}>{children}</TooltipPrimitive.Root>
    </TooltipProvider>
  );
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "panel-surface border-border z-50 w-fit rounded-sm border px-2 py-1 text-xs font-medium text-foreground shadow-sm",
          "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=delayed-open]:duration-[160ms]",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-[120ms]",
          "data-[side=bottom]:data-[state=delayed-open]:slide-in-from-top-1 data-[side=bottom]:data-[state=closed]:slide-out-to-top-1",
          "data-[side=top]:data-[state=delayed-open]:slide-in-from-bottom-1 data-[side=top]:data-[state=closed]:slide-out-to-bottom-1",
          "motion-reduce:animate-none motion-reduce:transition-none",
          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
