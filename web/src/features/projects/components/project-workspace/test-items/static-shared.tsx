import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import styles from "./static-workbench.module.css";

export function ConfirmAction({
  title,
  description,
  onConfirm,
  children,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  children: ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction className={styles.dangerButton} onClick={onConfirm}>
            确认删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
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
