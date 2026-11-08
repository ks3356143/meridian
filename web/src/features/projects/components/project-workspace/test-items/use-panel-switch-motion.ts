import { useEffect, type RefObject } from "react";
import { animate } from "@/lib/motion";

/**
 * 详情面板切换只做轻微淡入，不截整表、不交叉淡化、不做纵向位移。
 * 旧面板由 React key 立即卸载，因此任何时刻都只有当前面板可见。
 */
export function usePanelSwitchMotion(ref: RefObject<HTMLElement | null>, switchKey: string) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const controls = animate(element, { opacity: [0.84, 1] }, { duration: 0.2, ease: "easeOut" });
    return () => controls.stop();
  }, [switchKey, ref]);
}
