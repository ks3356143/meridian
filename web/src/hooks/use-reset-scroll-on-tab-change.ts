import { useLayoutEffect, useRef } from "react";

type ScrollTarget = "window" | "workspace-route";

/**
 * 仅页面级内容 TAB 切换时回到顶部。
 * 同一列表的筛选 TAB、审查单选择、各自独立滚动的面板不要调用。
 */
export function useResetScrollOnTabChange(activeKey: string, target: ScrollTarget = "window") {
  const previousKey = useRef(activeKey);

  useLayoutEffect(() => {
    if (previousKey.current === activeKey) return;
    previousKey.current = activeKey;

    if (target === "workspace-route") {
      document
        .querySelector<HTMLElement>("main.workspace-route")
        ?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [activeKey, target]);
}
