import { useLayoutEffect, type RefObject } from "react";

/**
 * 横向溢出的 Tab 条把 active 项滚进视野。
 * 只改 scrollLeft：scrollIntoView 会连带把文档纵向滚回顶部，窄屏切换体验很差。
 */
export function useRevealActiveTab(listRef: RefObject<HTMLElement | null>, activeKey: string) {
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const reveal = () => {
      const activeTab = list.querySelector<HTMLElement>(
        '[data-slot="tabs-trigger"][data-state="active"]',
      );
      if (!activeTab) return;
      const listRect = list.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();
      if (tabRect.left < listRect.left) {
        list.scrollLeft -= listRect.left - tabRect.left;
      } else if (tabRect.right > listRect.right) {
        list.scrollLeft += tabRect.right - listRect.right;
      }
    };

    reveal();
    // 字体换入后 Tab 宽度会变而 Tab 条自身宽度不变，ResizeObserver 不会触发，需要补一次。
    void document.fonts.ready.then(reveal);
    const observer = new ResizeObserver(reveal);
    observer.observe(list);
    return () => observer.disconnect();
  }, [listRef, activeKey]);
}
