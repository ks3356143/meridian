import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import styles from "./crossfade-icon.module.css";

/** 两枚图标叠放，按状态做 150ms 透明度交叉；动画只动 opacity，reduced-motion 直切。 */
export function CrossfadeIcon({
  primary: Primary,
  secondary: Secondary,
  showSecondary,
  className,
}: {
  primary: LucideIcon;
  secondary: LucideIcon;
  showSecondary: boolean;
  className?: string;
}) {
  return (
    <span className={cn(styles.root, className)} aria-hidden>
      <Primary className={styles.icon} data-visible={showSecondary ? "false" : "true"} />
      <Secondary className={styles.icon} data-visible={showSecondary ? "true" : "false"} />
    </span>
  );
}
