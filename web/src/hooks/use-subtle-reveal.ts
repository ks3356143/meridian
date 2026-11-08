import { useEffect, type RefObject } from "react";
import { animate } from "@/lib/motion";

/** 作用域内元素依次淡入；只负责透明度，位移和复杂编排走具体组件。 */
export function useSubtleReveal(
  scopeRef: RefObject<HTMLElement | null>,
  selector: string,
  enabled = true,
) {
  useEffect(() => {
    const scope = scopeRef.current;
    if (!enabled || !scope) return;
    const elements = [...scope.querySelectorAll<HTMLElement>(selector)];
    const controls = elements.map((element, index) =>
      animate(
        element,
        { opacity: [0.88, 1] },
        { duration: 0.2, delay: index * 0.03, ease: "easeOut" },
      ),
    );
    return () => controls.forEach((control) => control.stop());
  }, [scopeRef, selector, enabled]);
}
