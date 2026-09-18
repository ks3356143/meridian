import { TriangleAlert, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { RequirementRecord } from "@/features/requirements/types";
import styles from "./requirement-bulk-delete-dialog.module.css";

export function RequirementBulkDeleteDialog({
  open,
  requirements,
  submitting,
  error,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  requirements: RequirementRecord[];
  submitting: boolean;
  error: Error | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  const count = requirements.length;
  const visibleRequirements = requirements.slice(0, 4);
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
          <AlertDialogTitle>确认批量删除已确认需求？</AlertDialogTitle>
          <AlertDialogDescription>
            将从当前已确认需求基线移除 <strong>{count} 条需求</strong>
            ，保留审计记录，不执行物理删除。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Alert variant="destructive" className={styles.warning}>
          <TriangleAlert aria-hidden />
          <AlertTitle>删除范围</AlertTitle>
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
          </AlertDescription>
        </Alert>

        <Field>
          <FieldLabel htmlFor="requirement-bulk-delete-reason">删除原因（可选）</FieldLabel>
          <Textarea
            id="requirement-bulk-delete-reason"
            value={reason}
            minRows={3}
            maxRows={6}
            maxLength={500}
            autoComplete="off"
            disabled={submitting}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>

        {error ? (
          <div role="alert" className={styles.error}>
            批量删除失败：{error.message}
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              type="button"
              variant="destructive"
              disabled={submitting || count === 0}
              onClick={(event) => {
                event.preventDefault();
                onConfirm(reason.trim());
              }}
            >
              <Trash2 data-icon="inline-start" aria-hidden />
              {submitting ? "删除中..." : `删除 ${count} 条需求`}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
