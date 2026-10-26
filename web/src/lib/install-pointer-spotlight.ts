let installed = false;

/** 一个文档级监听器驱动所有 [data-spotlight] 表面，避免每个卡片各自绑定 pointermove。 */
export function installPointerSpotlight() {
  if (installed || typeof window === "undefined" || typeof document === "undefined") return;
  installed = true;

  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let active: HTMLElement | null = null;
  let frame = 0;
  let lastClientX = 0;
  let lastClientY = 0;
  let nextX = 0;
  let nextY = 0;

  const canRun = () => finePointer.matches && !reducedMotion.matches && !document.hidden;
  const clear = () => {
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    if (active) {
      active.style.removeProperty("--spotlight-x");
      active.style.removeProperty("--spotlight-y");
      active = null;
    }
  };
  const setActive = (surface: HTMLElement | null) => {
    if (surface === active) return;
    clear();
    active = surface;
  };
  const update = () => {
    frame = 0;
    if (!active || !canRun()) return;
    active.style.setProperty("--spotlight-x", `${nextX}px`);
    active.style.setProperty("--spotlight-y", `${nextY}px`);
  };
  const schedule = () => {
    if (!active || !canRun()) return;
    const rect = active.getBoundingClientRect();
    nextX = lastClientX - rect.left;
    nextY = lastClientY - rect.top;
    if (!frame) frame = requestAnimationFrame(update);
  };

  const onPointerOver = (event: PointerEvent) => {
    if (!canRun()) {
      clear();
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) return;
    setActive(target.closest<HTMLElement>("[data-spotlight]"));
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!active || !canRun()) return;
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    schedule();
  };
  const onPointerOut = (event: PointerEvent) => {
    if (!active) return;
    const related = event.relatedTarget as Node | null;
    if (related && active.contains(related)) return;
    clear();
  };

  document.addEventListener("pointerover", onPointerOver, true);
  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerout", onPointerOut, true);
  document.addEventListener("pointerleave", clear, true);
  document.addEventListener("scroll", schedule, { capture: true, passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", clear);
  finePointer.addEventListener("change", clear);
  reducedMotion.addEventListener("change", clear);
}
