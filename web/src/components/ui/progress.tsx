import * as React from "react";
import * as ProgressPrimitive from "@animate-ui/react/primitives/radix-ui/progress";
import { cn } from "cn";

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  // 首次挂载从 0 充能到真实值：Animate UI 的 Indicator 只在数值变化时做弹簧，initial:false 不吃首帧。
  const [charged, setCharged] = React.useState(false);
  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => setCharged(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const shown = charged ? (value ?? 0) : 0;

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn("bg-muted/70 relative h-1.5 w-full overflow-hidden rounded-none", className)}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="bg-primary h-full w-full flex-none origin-left"
        style={{ transform: `translateX(-${100 - shown}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
