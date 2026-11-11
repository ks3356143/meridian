import { useLayoutEffect, useRef } from "react";
import { cn } from "cn";
import { animate } from "@/lib/motion";
import styles from "./segmented-progress.module.css";

type SegmentedProgressTone = "primary" | "info" | "warning" | "success" | "danger" | "chart";

export function SegmentedProgress({
  value,
  tone = "primary",
  segments = 20,
  label,
  className,
}: {
  value: number;
  tone?: SegmentedProgressTone;
  segments?: number;
  label: string;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const active = Math.round((clamped / 100) * segments);
  const trackRef = useRef<HTMLDivElement>(null);
  const previousActive = useRef(0);

  // 一次性充能：首次挂载与进度前进时，新点亮的段从左到右依次淡入，不回放旧状态。
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const from = Math.min(previousActive.current, active);
    previousActive.current = active;
    const fresh = [...track.children].slice(from, active) as HTMLElement[];
    const controls = fresh.map((segment, index) =>
      animate(
        segment,
        { opacity: [0.28, 1] },
        { duration: 0.26, delay: index * 0.014, ease: "easeOut" },
      ),
    );
    return () => controls.forEach((control) => control.stop());
  }, [active]);

  return (
    <div
      ref={trackRef}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      data-tone={tone}
      className={cn(styles.track, className)}
    >
      {Array.from({ length: segments }, (_, index) => (
        <span
          key={index}
          className={styles.segment}
          data-active={index < active ? "true" : undefined}
        />
      ))}
    </div>
  );
}
