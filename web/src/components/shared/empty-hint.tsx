import type { ReactNode } from "react";
import { Fade } from "@animate-ui/react/primitives/effects/fade";
import { cn } from "cn";
import styles from "./empty-hint.module.css";

export type EmptyHintTone = "muted" | "amber" | "info";

/**
 * 空态 / 占位提示条：左 3px 竖线 + 轻底 + 说明文字，可带动作。
 * 与页面里"色条 + 轻底"的语言同源（hero 竖线、子项卡片色条、未完善行），比纯灰字更醒目但不喧宾夺主。
 */
export function EmptyHint({
  tone = "muted",
  action,
  className,
  children,
}: {
  tone?: EmptyHintTone;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Fade asChild initialOpacity={0.76}>
      <div className={cn(styles.hint, className)} data-tone={tone} role="note">
        <span className={styles.body}>{children}</span>
        {action ? <span className={styles.action}>{action}</span> : null}
      </div>
    </Fade>
  );
}
