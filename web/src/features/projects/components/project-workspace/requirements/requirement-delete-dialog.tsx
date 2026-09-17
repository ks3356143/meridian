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
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { RequirementRecord, RequirementSource } from "@/features/requirements/types";
import { requirementSourceLabel } from "./requirement-form";
import styles from "./requirement-delete-dialog.module.css";

export function RequirementDeleteDialog({
  requirement,
  source,
  submitting,
  error,
  hasUnsavedChanges,
  onOpenChange,
  onConfirm,
}: {
  requirement: RequirementRecord | null;
  source?: RequirementSource;
  submitting: boolean;
  error: Error | null;
  hasUnsavedChanges: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (requirement: RequirementRecord, reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <AlertDialog
      open={requirement !== null}
      onOpenChange={(open) => {
        if (!submitting) onOpenChange(open);
      }}
    >
      <AlertDialogContent className={styles.dialog}>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除已确认需求？</AlertDialogTitle>
          <AlertDialogDescription>
            将从当前已确认需求基线移除{" "}
            <strong>
              §{requirement?.chapterNumber} {requirement?.name}
            </strong>
            ，来源为 {source ? `${requirementSourceLabel(source)}${source.version}` : "来源文档"}。
            删除后会保留审计记录，不执行物理删除。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Alert variant="destructive" className={styles.warning}>
          <TriangleAlert aria-hidden />
          <AlertTitle>删除后的影响</AlertTitle>
          <AlertDescription>
            该需求将不再出现在已确认需求树和统计中；后续测试项模块落地后，其来源关系会标记为“来源需求已移除”。
            {hasUnsavedChanges ? " 当前详情有未保存修改，本次删除只作用于已保存内容。" : ""}
          </AlertDescription>
        </Alert>

        <Field>
          <FieldLabel htmlFor="requirement-delete-reason">删除原因（可选）</FieldLabel>
          <Textarea
            id="requirement-delete-reason"
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
            删除失败：{error.message}
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={submitting}
            onClick={(event) => {
              event.preventDefault();
              if (requirement) onConfirm(requirement, reason.trim());
            }}
          >
            <Trash2 data-icon="inline-start" aria-hidden />
            {submitting ? "删除中..." : "确认删除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
