import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import styles from "./static-workbench.module.css";

export { ConfirmAction } from "@/components/shared/confirm-action";

export function SaveChip({ state }: { state: "saved" | "editing" | "saving" | "error" }) {
  return (
    <span className={styles.saveChip} data-state={state} aria-live="polite">
      {state === "saving" ? (
        <>
          <Loader2 className={styles.spin} aria-hidden />
          保存中
        </>
      ) : state === "editing" ? (
        <>
          <RefreshCw aria-hidden />
          待保存
        </>
      ) : state === "error" ? (
        <>
          <AlertTriangle aria-hidden />
          保存失败
        </>
      ) : (
        <>
          <CheckCircle2 aria-hidden />
          已自动保存
        </>
      )}
    </span>
  );
}
