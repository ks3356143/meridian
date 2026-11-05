import { cn } from "cn";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import styles from "./hud-dialog-header.module.css";

/** 紧凑型 HUD 弹窗头部：标题左、kicker 右，一行说明，整体高度低于默认头部。 */
export function HudDialogHeader({
  kicker,
  title,
  description,
  className,
}: {
  kicker: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <DialogHeader className={cn(styles.header, className)}>
      <div className={styles.row}>
        <DialogTitle>{title}</DialogTitle>
        <span className={styles.kicker}>{kicker}</span>
      </div>
      {description ? <DialogDescription>{description}</DialogDescription> : null}
    </DialogHeader>
  );
}
