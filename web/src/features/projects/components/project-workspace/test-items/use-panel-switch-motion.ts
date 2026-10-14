import type { RefObject } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

/**
 * 详情面板切换的入场动效（测试项详情与用例详情共用同一实现）：内容淡入上移，
 * 只动画传入节点的内部内容，滚动容器留在外面，否则滚动条跟着位移看起来在跳。
 */
export function usePanelSwitchMotion(ref: RefObject<HTMLElement | null>, switchKey: string) {
  useGSAP(
    () => {
      const element = ref.current;
      if (!element) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        element,
        { autoAlpha: 0, y: 8 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.28,
          ease: "power2.out",
          clearProps: "transform,opacity,visibility",
        },
      );
    },
    { dependencies: [switchKey], revertOnUpdate: true },
  );
}
