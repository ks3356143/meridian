import { cn } from "cn";
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

  return (
    <div
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
