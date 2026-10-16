import { memo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ClipboardCopy,
  ClipboardPaste,
  CopyPlus,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { EmptyHint } from "@/components/shared/empty-hint";
import { QueryError, QueryLoading } from "@/components/shared/query-state";
import type { CaseStepRecord } from "@/features/test-items/types";
import { EditableCell } from "./editable-cell";
import { readStepClipboard, writeStepClipboard, type StepClipboard } from "./step-clipboard";
import { StepRichCell } from "./step-rich-cell";
import { caseStatusLabel } from "./test-items-design";
import { useCaseSteps } from "./use-case-steps";
import styles from "./test-case-panel.module.css";

/**
 * 用例「测试步骤」区块（切片 5a–5c）：六列表格、行操作与数字快捷键、跨用例剪贴板、删除确认。
 * 撤销栈留在用例详情面板（useCellUndo 是组件级栈），通过 recordChange 注入。
 */
function CaseStepsSectionInner({
  caseId,
  projectCode,
  onCaseChanged,
  recordChange,
}: {
  caseId: string;
  projectCode: string;
  onCaseChanged: () => void;
  recordChange: (label: string, restore: () => Promise<unknown>) => void;
}) {
  const {
    stepsQuery,
    steps,
    createStepMutation,
    updateStepMutation,
    toggleStepMutation,
    saveStepBlocksMutation,
    duplicateStepMutation,
    insertStepBeforeMutation,
    pasteStepMutation,
    deleteStepMutation,
    moveStepMutation,
  } = useCaseSteps(caseId, onCaseChanged);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; seq: number } | null>(null);
  // 跨用例复制步骤的剪贴板（localStorage 持久，切用例 / 刷新 / 跨标签页保留）。
  const [clipboard, setClipboard] = useState<StepClipboard | null>(() => readStepClipboard());

  /**
   * 步骤行快捷键：Alt+↑/↓ 移动 · Ctrl+D 复制 · Ctrl+Shift+Enter 上方插入 · Ctrl+Backspace 删除。
   * 结构操作前先 blur：编辑态下先把未提交内容走同一条保存链路，再改结构（两者互不依赖）。
   * Ctrl+Backspace 在编辑器内保留文本删除，不抢键。
   */
  const handleStepKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
    step: CaseStepRecord,
    index: number,
  ) => {
    const target = event.target as HTMLElement;
    const inEditor = target.closest('[contenteditable="true"]') !== null;
    const modifier = event.ctrlKey || event.metaKey;
    const flushEditor = () => (document.activeElement as HTMLElement | null)?.blur();
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      event.stopPropagation();
      const targetIndex = event.key === "ArrowUp" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex > steps.length - 1) return;
      flushEditor();
      moveStepMutation.mutate({ id: step.id, targetIndex });
      return;
    }
    if (modifier && !event.shiftKey && event.key.toLowerCase() === "d") {
      event.preventDefault();
      event.stopPropagation();
      flushEditor();
      duplicateStepMutation.mutate(step.id);
      return;
    }
    if (modifier && event.shiftKey && event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      flushEditor();
      insertStepBeforeMutation.mutate(step.id);
      return;
    }
    if (modifier && event.key === "Backspace" && !inEditor) {
      event.preventDefault();
      event.stopPropagation();
      setPendingDelete({ id: step.id, seq: step.seq });
    }
  };

  const stepsBody = stepsQuery.isPending ? (
    <QueryLoading label="正在加载测试步骤" rows={3} />
  ) : stepsQuery.isError ? (
    <QueryError
      title="步骤加载失败"
      description="无法读取该用例的测试步骤。"
      onRetry={() => void stepsQuery.refetch()}
    />
  ) : steps.length === 0 ? (
    <EmptyHint
      tone="info"
      action={
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => createStepMutation.mutate()}
        >
          新增第一个步骤
        </Button>
      }
    >
      这个用例还没有步骤；步骤是执行与记录的取数单位，至少保留 1 行。
    </EmptyHint>
  ) : (
    <table className={styles.stepsTable}>
      <thead>
        <tr>
          <th scope="col">序号</th>
          <th scope="col">输入及操作</th>
          <th scope="col">期望结果与评估标准</th>
          <th scope="col">实测结果</th>
          <th scope="col">通过与否</th>
          <th scope="col">操作</th>
        </tr>
      </thead>
      <tbody>
        {steps.map((step, index) => (
          <tr
            key={step.id}
            data-status={step.passed}
            onKeyDown={(event) => handleStepKeyDown(event, step, index)}
          >
            <td className={styles.stepSeq}>{step.seq}</td>
            <td>
              <StepRichCell
                block={step.op}
                label={`第 ${step.seq} 步输入及操作`}
                placeholder="点击输入操作步骤"
                kind="op"
                projectCode={projectCode}
                onSave={(doc) => saveStepBlocksMutation.mutateAsync({ id: step.id, op: doc })}
              />
            </td>
            <td>
              <EditableCell
                value={step.expectText}
                label={`第 ${step.seq} 步期望结果与评估标准`}
                placeholder="点击填写期望结果与评估标准"
                multiline
                bordered
                onSave={(next) => {
                  const previous = step.expectText;
                  return updateStepMutation
                    .mutateAsync({ id: step.id, expectText: next })
                    .then(() => {
                      if (previous !== next) {
                        recordChange(`第 ${step.seq} 步期望结果与评估标准`, () =>
                          updateStepMutation.mutateAsync({ id: step.id, expectText: previous }),
                        );
                      }
                    });
                }}
              />
            </td>
            <td>
              <StepRichCell
                block={step.act}
                label={`第 ${step.seq} 步实测结果`}
                placeholder="点击记录实测结果"
                kind="act"
                projectCode={projectCode}
                onSave={(doc) => saveStepBlocksMutation.mutateAsync({ id: step.id, act: doc })}
              />
            </td>
            <td>
              <button
                type="button"
                className={styles.passButton}
                data-status={step.passed}
                title="点击切换：未执行 → 通过 → 未通过"
                onClick={() => {
                  const previous = step.passed;
                  void toggleStepMutation
                    .mutateAsync(step.id)
                    .then(() =>
                      recordChange(`第 ${step.seq} 步通过状态`, () =>
                        updateStepMutation.mutateAsync({ id: step.id, passed: previous }),
                      ),
                    );
                }}
              >
                {caseStatusLabel(
                  step.passed === "pass" ? "passed" : step.passed === "fail" ? "failed" : "pending",
                )}
              </button>
            </td>
            <td className={styles.stepActionsCell}>
              <div className={styles.stepActions}>
                <button
                  type="button"
                  className={styles.stepAction}
                  title="上移"
                  aria-label={`上移第 ${step.seq} 步`}
                  disabled={index === 0}
                  onClick={() => moveStepMutation.mutate({ id: step.id, targetIndex: index - 1 })}
                >
                  <ArrowUp aria-hidden />
                </button>
                <button
                  type="button"
                  className={styles.stepAction}
                  title="下移"
                  aria-label={`下移第 ${step.seq} 步`}
                  disabled={index === steps.length - 1}
                  onClick={() => moveStepMutation.mutate({ id: step.id, targetIndex: index + 1 })}
                >
                  <ArrowDown aria-hidden />
                </button>
                <button
                  type="button"
                  className={styles.stepAction}
                  title="复制步骤"
                  aria-label={`复制第 ${step.seq} 步`}
                  onClick={() => duplicateStepMutation.mutate(step.id)}
                >
                  <CopyPlus aria-hidden />
                </button>
                <button
                  type="button"
                  className={styles.stepAction}
                  title="复制到剪贴板（可粘贴到其他用例）"
                  aria-label={`复制第 ${step.seq} 步到剪贴板`}
                  onClick={() => {
                    const summary = step.op.plainText || step.expectText || `第 ${step.seq} 步`;
                    const clip = { stepId: step.id, summary };
                    writeStepClipboard(clip);
                    setClipboard(clip);
                    toast.success("已复制到剪贴板，可到其他用例「粘贴步骤」");
                  }}
                >
                  <ClipboardCopy aria-hidden />
                </button>
                <button
                  type="button"
                  className={styles.stepAction}
                  data-variant="destructive"
                  title="删除步骤"
                  aria-label={`删除第 ${step.seq} 步`}
                  onClick={() => setPendingDelete({ id: step.id, seq: step.seq })}
                >
                  <Trash2 aria-hidden />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <>
      <div className={styles.stepsToolbar}>
        <span className={styles.stepsHint}>
          行快捷键：Alt+↑/↓ 移动 · Ctrl+D 复制 · Ctrl+Shift+Enter 上方插入 · Ctrl+Backspace 删除
        </span>
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => createStepMutation.mutate()}
        >
          <Plus aria-hidden />
          新增步骤
        </Button>
      </div>
      {stepsBody}
      {clipboard ? (
        <div className={styles.pasteRow}>
          <span className={styles.pasteHint} title={clipboard.summary}>
            剪贴板：{clipboard.summary}
          </span>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => pasteStepMutation.mutate(clipboard.stepId)}
          >
            <ClipboardPaste aria-hidden />
            粘贴步骤
          </Button>
        </div>
      ) : null}

      {pendingDelete ? (
        <AlertDialog open onOpenChange={(open) => (open ? undefined : setPendingDelete(null))}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除第 {pendingDelete.seq} 步？</AlertDialogTitle>
              <AlertDialogDescription>
                删除后剩余步骤会重新编号；用例至少保留 1 个步骤。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                className={styles.dangerAction}
                onClick={() => deleteStepMutation.mutate(pendingDelete.id)}
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}

/** 步骤区块是重子树：用例详情面板状态变化（编辑态等）不该穿透重渲染它。 */
export const CaseStepsSection = memo(CaseStepsSectionInner);
