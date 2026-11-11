import { useLayoutEffect, type RefObject } from "react";
import { animate } from "@/lib/motion";

/**
 * 作用域内元素依次淡入上浮：透明度 + 轻位移 + 错峰，负责页面级入场编排；
 * 复杂动效（弹性、循环、测量驱动）走具体组件。
 */
export function useSubtleReveal(
  scopeRef: RefObject<HTMLElement | null>,
  selector: string,
  enabled = true,
) {
  useLayoutEffect(() => {
    const scope = scopeRef.current;
    if (!enabled || !scope) return;
    const elements = [...scope.querySelectorAll<HTMLElement>(selector)];
    // 绘制前先写首帧，避免元素以终态闪一帧再回落到入场态。
    elements.forEach((element) => {
      element.style.opacity = "0.45";
      element.style.transform = "translateY(10px)";
    });
    const controls = elements.map((element, index) =>
      animate(
        element,
        { opacity: [0.45, 1], y: [10, 0] },
        {
          duration: 0.34,
          delay: Math.min(index * 0.05, 0.3),
          ease: [0.23, 1, 0.32, 1],
        },
      ),
    );
    return () => controls.forEach((control) => control.stop());
  }, [scopeRef, selector, enabled]);
}
