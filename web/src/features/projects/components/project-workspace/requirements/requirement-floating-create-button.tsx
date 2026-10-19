import { Sparkles } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import styles from "./requirement-floating-create-button.module.css";

export function RequirementFloatingCreateButton({
  rootRef,
  sentinelRef,
  enabled,
  onClick,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  sentinelRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  onClick: () => void;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), {
      root,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [rootRef, sentinelRef]);

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
      tabIndex={visible ? undefined : -1}
      aria-label="创建并关联测试项"
      onClick={onClick}
    >
      <Sparkles data-icon="inline-start" aria-hidden />
      <span className={styles.floatingCreateLabel} aria-hidden>
        创建测试项
      </span>
    </Button>
  );
}
