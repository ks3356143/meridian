import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { DETAIL_INFO, SECTION_LINKS } from "./test-item-detail-config";

export function useTestItemSectionNavigation({
  itemId,
  activeTab,
  scrollRef,
}: {
  itemId: string;
  activeTab: string;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const [activeSection, setActiveSection] = useState<string>(SECTION_LINKS[0]?.id ?? "");
  const jumpSpyLockRef = useRef(false);

  useEffect(() => {
    if (activeTab !== DETAIL_INFO) return;
    const container = scrollRef.current;
    if (!container) return;
    const route = container.closest<HTMLElement>("main.workspace-route");
    const scrollTargets = route && route !== container ? [container, route] : [container];
    const handleScroll = () => {
      if (jumpSpyLockRef.current) return;
      const nav = container.querySelector<HTMLElement>("[data-section-nav]");
      const activationLine =
        (nav?.getBoundingClientRect().bottom ?? container.getBoundingClientRect().top) + 10;
      let current: string = SECTION_LINKS[0]?.id ?? "";
      for (const section of SECTION_LINKS) {
        const element = container.querySelector<HTMLElement>(`#${section.id}`);
        if (element && element.getBoundingClientRect().top <= activationLine) current = section.id;
      }
      setActiveSection(current);
    };
    const releaseJumpLock = () => {
      jumpSpyLockRef.current = false;
    };
    for (const target of scrollTargets) {
      target.addEventListener("scroll", handleScroll, { passive: true });
      target.addEventListener("wheel", releaseJumpLock, { passive: true });
      target.addEventListener("touchstart", releaseJumpLock, { passive: true });
      target.addEventListener("keydown", releaseJumpLock);
      target.addEventListener("scrollend", releaseJumpLock);
    }
    handleScroll();
    return () => {
      for (const target of scrollTargets) {
        target.removeEventListener("scroll", handleScroll);
        target.removeEventListener("wheel", releaseJumpLock);
        target.removeEventListener("touchstart", releaseJumpLock);
        target.removeEventListener("keydown", releaseJumpLock);
        target.removeEventListener("scrollend", releaseJumpLock);
      }
      jumpSpyLockRef.current = false;
    };
  }, [activeTab, itemId, scrollRef]);

  const jumpTo = useCallback(
    (id: string) => {
      const container = scrollRef.current;
      const element = container?.querySelector<HTMLElement>(`#${id}`);
      if (!element) return;
      setActiveSection(id);
      jumpSpyLockRef.current = true;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      element.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    },
    [scrollRef],
  );

  return { activeSection, jumpTo };
}
