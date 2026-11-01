import type { RefObject } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

/**
 * 详情面板切换只做轻微淡入，不截整表、不交叉淡化、不做纵向位移。
 * 旧面板由 React key 立即卸载，因此任何时刻都只有当前面板可见。
 */
export function usePanelSwitchMotion(ref: RefObject<HTMLElement | null>, switchKey: string) {
  useGSAP(
    () => {
      const element = ref.current;
      if (!element) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        element,
        { opacity: 0.84 },
        {
          opacity: 1,
          duration: 0.2,
          ease: "power2.out",
          clearProps: "opacity",
        },
      );
    },
    { dependencies: [switchKey], revertOnUpdate: true },
  );
}
