import * as React from "react";
import * as ProgressPrimitive from "radix-ui/progress";
import { cn } from "cn";
import styles from "./progress.module.css";

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn("bg-muted/70 relative h-1.5 w-full overflow-hidden rounded-none", className)}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn("bg-primary h-full w-full flex-none origin-left", styles.indicator)}
        style={{ "--progress-offset": `-${100 - (value ?? 0)}%` } as React.CSSProperties}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
