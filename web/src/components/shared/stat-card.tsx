import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SegmentedProgress } from "@/components/shared/segmented-progress";
import { TruncatedText } from "@/components/shared/truncated-text";
import styles from "./stat-card.module.css";

export type StatTone = "info" | "primary" | "success" | "chart" | "warning";

/** 页面统计卡：标签 + 图标头，数值 + 说明底，可选分段进度；配色由 data-tone 驱动。 */
export function StatCard({
  tone,
  icon: Icon,
  label,
  value,
  detail,
  progress,
}: {
  tone: StatTone;
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail?: string;
  progress?: number;
}) {
  return (
    <Card size="sm" data-tone={tone} className="overflow-hidden">
      <CardContent className={styles.content}>
        <div className={styles.head}>
          <span className={styles.label}>{label}</span>
          <span className={styles.iconBox}>
            <Icon aria-hidden />
          </span>
        </div>
        <div className={styles.valueRow}>
          <span className={styles.value}>{value}</span>
          {detail ? <TruncatedText value={detail} className={styles.detail} /> : null}
        </div>
        {progress === undefined ? null : (
          <SegmentedProgress value={progress} tone={tone} label={`${label}占比`} />
        )}
      </CardContent>
    </Card>
  );
}
