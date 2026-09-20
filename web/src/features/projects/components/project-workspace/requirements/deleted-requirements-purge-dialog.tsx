import { Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { RequirementRecord } from "@/features/requirements/types";
import styles from "./deleted-requirements-purge-dialog.module.css";

export function DeletedRequirementsPurgeDialog({
  open,
  requirements,
  all,
  submitting,
  error,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  requirements: RequirementRecord[];
  all: boolean;
  submitting: boolean;
  error: Error | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const trimmedReason = reason.trim();
  const reasonError = trimmedReason ? undefined : "彻底删除原因必填";

  const count = requirements.length;
  const visibleRequirements = requirements.slice(0, 5);
  const hiddenCount = Math.max(0, count - visibleRequirements.length);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!submitting) onOpenChange(nextOpen);
      }}
    >
      <AlertDialogContent className={styles.dialog}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {all ? "确认删除全部已删除需求？" : "确认批量删除已删除需求？"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            将物理删除 <strong>{count} 条已删除需求</strong>。该操作不可恢复。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Alert variant="destructive" className={styles.warning}>
          <TriangleAlert aria-hidden />
          <AlertTitle>不可逆影响</AlertTitle>
          <AlertDescription>
            <ul className={styles.list}>
              {visibleRequirements.map((requirement) => (
                <li key={requirement.id}>
                  §{requirement.chapterNumber} {requirement.name}
                </li>
              ))}
            </ul>
            {hiddenCount > 0 ? (
              <p className={styles.more}>另有 {hiddenCount} 条需求将一起删除。</p>
            ) : null}
            需求记录和它们的审计事件会一起从数据库删除，之后不能恢复、复制或查看审计。
          </AlertDescription>
        </Alert>

        <Field data-invalid={reasonError ? true : undefined}>
          <FieldLabel htmlFor="deleted-requirements-purge-reason">
            彻底删除原因
            <span className={styles.requiredMark} aria-hidden>
              *
            </span>
          </FieldLabel>
          <Textarea
            id="deleted-requirements-purge-reason"
            value={reason}
            minRows={3}
            maxRows={6}
            maxLength={500}
            autoComplete="off"
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={reasonError ? "deleted-requirements-purge-reason-error" : undefined}
            disabled={submitting}
            onChange={(event) => setReason(event.target.value)}
          />
          <FieldError id="deleted-requirements-purge-reason-error">{reasonError}</FieldError>
        </Field>

        {error ? (
          <div role="alert" className={styles.error}>
            彻底删除失败：{error.message}
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={submitting || count === 0 || Boolean(reasonError)}
            onClick={(event) => {
              event.preventDefault();
              if (count > 0 && !reasonError) onConfirm(trimmedReason);
            }}
          >
            <Trash2 data-icon="inline-start" aria-hidden />
            {submitting ? "彻底删除中..." : `彻底删除 ${count} 条`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
