import { LoaderCircle } from "lucide-react";
import { cn } from "cn";
import styles from "./inline-loading.module.css";

/** 内联加载提示：可见 spinner + 文案，替代纯文字「加载中」。 */
export function InlineLoading({ label, className }: { label: string; className?: string }) {
  return (
    <p role="status" className={cn(styles.root, className)}>
      <LoaderCircle className={styles.spinner} aria-hidden />
      {label}
    </p>
  );
}
