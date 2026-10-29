import { memo, useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ClipboardCopy,
  ClipboardPaste,
  CopyPlus,
  Keyboard,
  MessageSquarePlus,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { RequirementBlockNode } from "@/features/requirements/types";
import type { CaseStepRecord } from "@/features/test-items/types";
import { EditableCell } from "./editable-cell";
import { readStepClipboard, writeStepClipboard, type StepClipboard } from "./step-clipboard";
import { StepRichCell } from "./step-rich-cell";
import { caseStatusLabel } from "./test-items-design";
import { useCaseSteps } from "./use-case-steps";
import styles from "./test-case-panel.module.css";

function StepActionButton({
  label,
  disabled,
  destructive,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={styles.stepActionWrap}>
          <button
            type="button"
            className={styles.stepAction}
            data-variant={destructive ? "destructive" : undefined}
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
          >
            {children}
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

type StepBlockKind = "op" | "act";

type CaseStepRowProps = {
  step: CaseStepRecord;
  index: number;
  stepCount: number;
  projectCode: string;
  highlighted?: boolean;
  structurePending: boolean;
  canDeleteStep: boolean;
  onMove: (id: string, targetIndex: number) => void;
  onDuplicate: (id: string) => void;
  onInsertBefore: (id: string) => void;
  onSaveBlock: (id: string, kind: StepBlockKind, doc: RequirementBlockNode) => Promise<unknown>;
  onUpdateExpect: (step: CaseStepRecord, next: string) => Promise<unknown>;
  onTogglePassed: (step: CaseStepRecord) => Promise<unknown>;
  onCopy: (step: CaseStepRecord) => void;
  onRequestDelete: (step: CaseStepRecord) => void;
  onQuickIssue: (step: CaseStepRecord) => void;
};

/**
 * 单行步骤是重子树：未变化的行保持对象引用，父级 mutation/剪贴板状态变化不重渲染其它行的富文本。
 * 结构操作期间统一禁用，避免并发重排；叶子单元格各自维护保存相位。
 */
const CaseStepRow = memo(function CaseStepRowImpl({
  step,
  index,
  stepCount,
  projectCode,
  highlighted = false,
  structurePending,
  canDeleteStep,
  onMove,
  onDuplicate,
  onInsertBefore,
  onSaveBlock,
  onUpdateExpect,
  onTogglePassed,
  onCopy,
  onRequestDelete,
  onQuickIssue,
}: CaseStepRowProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (structurePending) return;
    const target = event.target as HTMLElement;
    const inEditor = target.isContentEditable;
    const modifier = event.ctrlKey || event.metaKey;
    const flushEditor = () => (document.activeElement as HTMLElement | null)?.blur();

    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      event.stopPropagation();
      const targetIndex = event.key === "ArrowUp" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= stepCount) return;
      flushEditor();
      onMove(step.id, targetIndex);
      return;
    }
    if (modifier && !event.shiftKey && event.key.toLowerCase() === "d") {
      event.preventDefault();
      event.stopPropagation();
      flushEditor();
      onDuplicate(step.id);
      return;
    }
    if (modifier && event.shiftKey && event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      flushEditor();
      onInsertBefore(step.id);
      return;
    }
    if (modifier && event.key === "Backspace" && !inEditor && canDeleteStep) {
      event.preventDefault();
      event.stopPropagation();
      onRequestDelete(step);
    }
  };

  return (
    <tr
      data-status={step.passed}
      data-step-id={step.id}
      data-search-hit={highlighted ? "true" : undefined}
      onKeyDown={handleKeyDown}
    >
      <td className={styles.stepSeq}>{step.seq}</td>
      <td>
        <StepRichCell
          block={step.op}
          label={`第 ${step.seq} 步输入及操作`}
          placeholder="填写操作步骤"
          projectCode={projectCode}
          onSave={(doc) => onSaveBlock(step.id, "op", doc)}
        />
      </td>
      <td>
        <EditableCell
          value={step.expectText}
          label={`第 ${step.seq} 步期望结果与评估标准`}
          placeholder="填写期望结果"
          multiline
          bordered
          onSave={(next) => onUpdateExpect(step, next)}
        />
      </td>
      <td>
        <StepRichCell
          block={step.act}
          label={`第 ${step.seq} 步实测结果`}
          placeholder="记录实测结果"
          projectCode={projectCode}
          onSave={(doc) => onSaveBlock(step.id, "act", doc)}
        />
      </td>
      <td aria-label="通过状态">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={styles.passButton}
              data-status={step.passed}
              aria-label={`第 ${step.seq} 步通过状态，点击切换`}
              onClick={() => void onTogglePassed(step)}
            >
              {caseStatusLabel(
                step.passed === "pass" ? "passed" : step.passed === "fail" ? "failed" : "pending",
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">点击切换：未执行 → 通过 → 未通过</TooltipContent>
        </Tooltip>
      </td>
      <td className={styles.stepActionsCell} aria-label="步骤操作">
        <div className={styles.stepActions}>
          <StepActionButton
            label={`上移第 ${step.seq} 步`}
            disabled={index === 0 || structurePending}
            onClick={() => onMove(step.id, index - 1)}
          >
            <ArrowUp aria-hidden />
          </StepActionButton>
          <StepActionButton
            label={`下移第 ${step.seq} 步`}
            disabled={index === stepCount - 1 || structurePending}
            onClick={() => onMove(step.id, index + 1)}
          >
            <ArrowDown aria-hidden />
          </StepActionButton>
          <StepActionButton
            label={`复制第 ${step.seq} 步`}
            disabled={structurePending}
            onClick={() => onDuplicate(step.id)}
          >
            <CopyPlus aria-hidden />
          </StepActionButton>
          <StepActionButton label={`复制第 ${step.seq} 步到剪贴板`} onClick={() => onCopy(step)}>
            <ClipboardCopy aria-hidden />
          </StepActionButton>
          <StepActionButton label={`记录第 ${step.seq} 步问题`} onClick={() => onQuickIssue(step)}>
            <MessageSquarePlus aria-hidden />
          </StepActionButton>
          <StepActionButton
            label={canDeleteStep ? `删除第 ${step.seq} 步` : "至少保留 1 个步骤"}
            destructive
            disabled={!canDeleteStep || structurePending}
            onClick={() => onRequestDelete(step)}
          >
            <Trash2 aria-hidden />
          </StepActionButton>
        </div>
      </td>
    </tr>
  );
});

/**
 * 用例「测试步骤」区块（切片 5a–5c）：六列表格、行操作与数字快捷键、跨用例剪贴板、删除确认。
 * 撤销栈留在用例详情面板（useCellUndo 是组件级栈），通过 recordChange 注入。
 */
function CaseStepsSectionInner({
  caseId,
  projectCode,
  onCaseChanged,
  recordChange,
  onOpenShortcuts,
  focusStep,
  onQuickIssue,
}: {
  caseId: string;
  projectCode: string;
  onCaseChanged: () => void;
  recordChange: (label: string, restore: () => Promise<unknown>) => void;
  onOpenShortcuts: () => void;
  focusStep?: { stepId: string; nonce: number } | null;
  onQuickIssue: (step: CaseStepRecord) => void;
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
  const canDeleteStep = steps.length > 1;

  // 查找命中后等步骤数据到齐再滚动；高亮由 focusStep 派生，切换用例或再次查找时自然更新。
  useEffect(() => {
    if (!focusStep || !stepsQuery.isSuccess) return;
    const row = document.querySelector(`[data-step-id="${CSS.escape(focusStep.stepId)}"]`);
    if (!row) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  }, [focusStep, stepsQuery.isSuccess, steps.length]);
  const structurePending =
    createStepMutation.isPending ||
    duplicateStepMutation.isPending ||
    insertStepBeforeMutation.isPending ||
    pasteStepMutation.isPending ||
    deleteStepMutation.isPending ||
    moveStepMutation.isPending;

  const updateStep = updateStepMutation.mutateAsync;
  const toggleStep = toggleStepMutation.mutateAsync;
  const saveStepBlocks = saveStepBlocksMutation.mutateAsync;
  const moveStep = moveStepMutation.mutate;
  const duplicateStep = duplicateStepMutation.mutate;
  const insertStepBefore = insertStepBeforeMutation.mutate;
  const moveStepTo = useCallback(
    (id: string, targetIndex: number) => moveStep({ id, targetIndex }),
    [moveStep],
  );
  const saveStepBlock = useCallback(
    (id: string, kind: StepBlockKind, doc: RequirementBlockNode) =>
      kind === "op" ? saveStepBlocks({ id, op: doc }) : saveStepBlocks({ id, act: doc }),
    [saveStepBlocks],
  );
  const updateExpect = useCallback(
    (target: CaseStepRecord, next: string) => {
      const previous = target.expectText;
      return updateStep({ id: target.id, expectText: next }).then(() => {
        if (previous !== next) {
          recordChange(`第 ${target.seq} 步期望结果与评估标准`, () =>
            updateStep({ id: target.id, expectText: previous }),
          );
        }
      });
    },
    [recordChange, updateStep],
  );
  const togglePassed = useCallback(
    async (target: CaseStepRecord) => {
      const previous = target.passed;
      await toggleStep(target.id);
      recordChange(`第 ${target.seq} 步通过状态`, () =>
        updateStep({ id: target.id, passed: previous }),
      );
    },
    [recordChange, toggleStep, updateStep],
  );
  const copyStep = useCallback((target: CaseStepRecord) => {
    const summary =
      target.op.plainText || target.act.plainText || target.expectText || `第 ${target.seq} 步`;
    const clip = { stepId: target.id, summary };
    writeStepClipboard(clip);
    setClipboard(clip);
    toast.success("已复制到剪贴板，可到其他用例「粘贴步骤」");
  }, []);
  const requestDelete = useCallback((target: CaseStepRecord) => {
    setPendingDelete({ id: target.id, seq: target.seq });
  }, []);

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
          disabled={structurePending}
          aria-busy={structurePending || undefined}
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
          <CaseStepRow
            key={step.id}
            step={step}
            index={index}
            stepCount={steps.length}
            projectCode={projectCode}
            highlighted={focusStep?.stepId === step.id}
            structurePending={structurePending}
            canDeleteStep={canDeleteStep}
            onMove={moveStepTo}
            onDuplicate={duplicateStep}
            onInsertBefore={insertStepBefore}
            onSaveBlock={saveStepBlock}
            onUpdateExpect={updateExpect}
            onTogglePassed={togglePassed}
            onCopy={copyStep}
            onRequestDelete={requestDelete}
            onQuickIssue={onQuickIssue}
          />
        ))}
      </tbody>
    </table>
  );

  return (
    <>
      <div className={styles.stepsToolbar}>
        <Button
          type="button"
          size="xs"
          variant="outline"
          className={styles.shortcutButton}
          onClick={onOpenShortcuts}
        >
          <Keyboard aria-hidden />
          快捷键
        </Button>
        <Button
          type="button"
          size="xs"
          disabled={structurePending}
          aria-busy={structurePending || undefined}
          onClick={() => createStepMutation.mutate()}
        >
          <Plus aria-hidden />
          新增步骤
        </Button>
      </div>
      {stepsBody}
      {clipboard ? (
        <div className={styles.pasteRow}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={styles.pasteHint}>剪贴板：{clipboard.summary}</span>
            </TooltipTrigger>
            <TooltipContent side="top">{clipboard.summary}</TooltipContent>
          </Tooltip>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={structurePending}
            aria-busy={structurePending || undefined}
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
