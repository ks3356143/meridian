import { Sparkles } from "lucide-react";
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
import type { RequirementRecord } from "@/features/requirements/types";
import styles from "./requirement-create-test-items-dialog.module.css";

export type TestItemCreateScope = "all" | "selected";

export function RequirementCreateTestItemsDialog({
  open,
  requirements,
  scope,
  submitting,
  error,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  requirements: RequirementRecord[];
  scope: TestItemCreateScope;
  submitting: boolean;
  error: Error | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const visibleRequirements = requirements.slice(0, 4);
  const hiddenCount = Math.max(0, requirements.length - visibleRequirements.length);

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
            {scope === "all" ? "一键创建全部测试项？" : "为选中需求创建测试项？"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {`将检查 ${requirements.length} 条已确认需求。服务端会跳过已有关联测试项和待补描述的需求，只创建缺失项。`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {visibleRequirements.length > 0 ? (
          <ul className={styles.list} aria-label="批量创建检查范围">
            {visibleRequirements.map((requirement) => (
              <li key={requirement.id}>
                §{requirement.chapterNumber} {requirement.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>当前没有已确认需求。</p>
        )}
        {hiddenCount > 0 ? (
          <p className={styles.more}>另有 {hiddenCount} 条需求将一起检查。</p>
        ) : null}

        <Alert className={styles.rule}>
          <Sparkles aria-hidden />
          <AlertTitle>创建规则</AlertTitle>
          <AlertDescription>
            测试项类型按需求主类型映射；创建和关联在同一事务内完成，实际结果会在完成后汇总提示。
          </AlertDescription>
        </Alert>

        {error ? (
          <div role="alert" className={styles.error}>
            批量创建失败：{error.message}
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              type="button"
              disabled={submitting || requirements.length === 0}
              onClick={(event) => {
                event.preventDefault();
                onConfirm();
              }}
            >
              <Sparkles data-icon="inline-start" aria-hidden />
              {submitting ? "创建中..." : "开始创建"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
