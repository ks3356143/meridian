import { useEffect, useRef } from "react";

type ScrollTarget = "window" | "workspace-route";

/**
 * 仅页面级内容 TAB 切换时平滑回到顶部。
 * 同一列表的筛选 TAB、审查单选择、各自独立滚动的面板不要调用。
 */
export function useResetScrollOnTabChange(activeKey: string, target: ScrollTarget = "window") {
  const previousKey = useRef(activeKey);

  useEffect(() => {
    if (previousKey.current === activeKey) return;
    previousKey.current = activeKey;
    const behavior: ScrollBehavior = "smooth";

    let innerFrame = 0;
    // 等新 TAB 的内容完成布局再滚，避免内容高度骤变把平滑滚动打断成瞬移。
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => {
        if (target === "workspace-route") {
          document
            .querySelector<HTMLElement>("main.workspace-route")
            ?.scrollTo({ top: 0, left: 0, behavior });
          return;
        }
        window.scrollTo({ top: 0, left: 0, behavior });
      });
    });

    return () => {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
    };
  }, [activeKey, target]);
}
