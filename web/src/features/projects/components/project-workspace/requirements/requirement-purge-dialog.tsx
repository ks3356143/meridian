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
import type { RequirementRecord, RequirementSource } from "@/features/requirements/types";
import { requirementSourceLabel } from "./requirement-form";
import styles from "./requirement-purge-dialog.module.css";

export function RequirementPurgeDialog({
  requirement,
  source,
  submitting,
  error,
  onOpenChange,
  onConfirm,
}: {
  requirement: RequirementRecord | null;
  source?: RequirementSource;
  submitting: boolean;
  error: Error | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (requirement: RequirementRecord, reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const trimmedReason = reason.trim();
  const reasonError = trimmedReason ? undefined : "彻底删除原因必填";

  return (
    <AlertDialog
      open={requirement !== null}
      onOpenChange={(open) => {
        if (!submitting) onOpenChange(open);
      }}
    >
      <AlertDialogContent className={styles.dialog}>
        <AlertDialogHeader>
          <AlertDialogTitle>确认彻底删除这条需求？</AlertDialogTitle>
          <AlertDialogDescription>
            将物理删除{" "}
            <strong>
              §{requirement?.chapterNumber} {requirement?.name}
            </strong>
            （来源：{source ? `${requirementSourceLabel(source)}${source.version}` : "来源文档"}
            ）。该操作不可恢复。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Alert variant="destructive" className={styles.warning}>
          <TriangleAlert aria-hidden />
          <AlertTitle>不可逆影响</AlertTitle>
          <AlertDescription>
            需求记录和它的审计事件会一起从数据库删除，之后不能恢复、复制或查看审计。测试项关联能力落地后，
            有关联测试项必须先变更为隐含需求来源，才允许执行本操作。
          </AlertDescription>
        </Alert>

        <Field data-invalid={reasonError ? true : undefined}>
          <FieldLabel htmlFor="requirement-purge-reason">
            彻底删除原因
            <span className={styles.requiredMark} aria-hidden>
              *
            </span>
          </FieldLabel>
          <Textarea
            id="requirement-purge-reason"
            value={reason}
            minRows={3}
            maxRows={6}
            maxLength={500}
            autoComplete="off"
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={reasonError ? "requirement-purge-reason-error" : undefined}
            disabled={submitting}
            onChange={(event) => setReason(event.target.value)}
          />
          <FieldError id="requirement-purge-reason-error">{reasonError}</FieldError>
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
            disabled={submitting || Boolean(reasonError)}
            onClick={(event) => {
              event.preventDefault();
              if (requirement && !reasonError) onConfirm(requirement, trimmedReason);
            }}
          >
            <Trash2 data-icon="inline-start" aria-hidden />
            {submitting ? "彻底删除中..." : "确认彻底删除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
