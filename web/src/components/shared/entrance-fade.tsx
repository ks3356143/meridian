import type { ComponentProps } from "react";
import { Fade } from "@animate-ui/react/primitives/effects/fade";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * 入场用 Fade：系统开启「减少动态效果」时直接呈现终态，不播入场。
 * 库内交互动效（弹层、Tab 高度等）不受影响，仍按项目规范全量播放。
 */
export function EntranceFade({
  initialOpacity = 0,
  transition,
  ...props
}: ComponentProps<typeof Fade>) {
  const reduced = prefersReducedMotion();
  return (
    <Fade
      {...props}
      initialOpacity={reduced ? 1 : initialOpacity}
      transition={reduced ? { duration: 0 } : transition}
    />
  );
}
