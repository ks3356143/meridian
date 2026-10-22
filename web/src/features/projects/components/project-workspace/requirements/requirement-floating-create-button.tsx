import { Sparkles } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import styles from "./requirement-floating-create-button.module.css";

function findScrollParent(node: HTMLElement) {
  let parent = node.parentElement;
  while (parent && parent !== document.body) {
    const overflowY = getComputedStyle(parent).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

export function RequirementFloatingCreateButton({
  triggerRef,
  enabled,
  onClick,
}: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  enabled: boolean;
  onClick: () => void;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    let frame = 0;
    const scrollParent = findScrollParent(trigger);

    const update = () => {
      const boundary = scrollParent?.getBoundingClientRect().top ?? 0;
      setShow(trigger.getBoundingClientRect().bottom <= boundary + 1);
    };
    const scheduleUpdate = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          update();
        });
    };

    update();
    window.addEventListener("scroll", scheduleUpdate, { capture: true, passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate, { capture: true });
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [triggerRef]);

  const visible = show && enabled;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      sheen
      className={styles.floatingCreate}
      data-visible={visible ? "true" : "false"}
      aria-hidden={!visible}
      inert={!visible}
      tabIndex={visible ? undefined : -1}
      aria-label="创建并关联测试项"
      onClick={onClick}
    >
      <Sparkles className={styles.floatingCreateIcon} aria-hidden />
      <span className={styles.floatingCreateLabel} aria-hidden>
        创建测试项
      </span>
    </Button>
  );
}
