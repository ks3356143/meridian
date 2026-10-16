import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { RequirementBlockNode } from "@/features/requirements/types";
import { testItemsApi } from "@/features/test-items/api";
import type { CaseStepRecord, StepBlockView } from "@/features/test-items/types";

/** 无块记录时的空视图；服务端轻量响应（新增步骤等）不带 op/act 时用它兜底。 */
const EMPTY_STEP_BLOCK: StepBlockView = { doc: null, plainText: "", hasContent: false };

/**
 * 用例步骤（切片 5a/5b）：列表 + 增删改、三态切换与富文本块保存。
 * 步骤状态联动用例状态/执行时间由服务端负责，前端在成功回调里让工作台与详情缓存失效。
 */
export function useCaseSteps(caseId: string, onCaseChanged: () => void) {
  const queryClient = useQueryClient();
  const stepsKey = useMemo(() => ["test-cases", caseId, "steps"], [caseId]);

  const stepsQuery = useQuery({
    queryKey: stepsKey,
    queryFn: () => testItemsApi.caseSteps(caseId),
    enabled: caseId !== "",
  });

  const patchSteps = useCallback(
    (update: (list: CaseStepRecord[]) => CaseStepRecord[]) => {
      queryClient.setQueryData<CaseStepRecord[]>(stepsKey, (previous) =>
        previous ? update(previous) : previous,
      );
    },
    [queryClient, stepsKey],
  );

  /** 单行操作的服务端响应只带自己负责的字段：merge 保留本地已有的 op/act。 */
  const mergeStep = useCallback(
    (updated: CaseStepRecord) => {
      patchSteps((list) =>
        list.map((step) => (step.id === updated.id ? { ...step, ...updated } : step)),
      );
    },
    [patchSteps],
  );

  const createStepMutation = useMutation({
    mutationFn: () => testItemsApi.createCaseStep(caseId, ""),
    onSuccess: (created) => {
      patchSteps((list) =>
        [
          ...list,
          { ...created, op: created.op ?? EMPTY_STEP_BLOCK, act: created.act ?? EMPTY_STEP_BLOCK },
        ].sort((left, right) => left.seq - right.seq),
      );
    },
  });

  const updateStepMutation = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; expectText?: string; passed?: string }) =>
      testItemsApi.updateCaseStep(id, payload),
    onSuccess: (updated) => {
      mergeStep(updated);
      // 预期结果/通过状态的任何改动都会让服务端重算用例状态与执行时间（撤销同理）。
      onCaseChanged();
    },
  });

  const toggleStepMutation = useMutation({
    mutationFn: (id: string) => testItemsApi.toggleCaseStep(id),
    onSuccess: (updated) => {
      mergeStep(updated);
      onCaseChanged();
    },
  });

  const saveStepBlocksMutation = useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string;
      op?: RequirementBlockNode;
      act?: RequirementBlockNode;
    }) => testItemsApi.saveCaseStepBlocks(id, payload),
    onSuccess: (updated) => {
      mergeStep(updated);
      // 富文本保存同样会刷新执行时间（服务端「步骤改动自动写今天」口径）。
      onCaseChanged();
    },
  });

  const duplicateStepMutation = useMutation({
    mutationFn: (id: string) => testItemsApi.duplicateCaseStep(id),
    // 复制插在源步骤下方并重排序号，交给服务端口径：整表重取最稳。
    onSettled: () => void queryClient.invalidateQueries({ queryKey: stepsKey }),
  });

  const insertStepBeforeMutation = useMutation({
    mutationFn: (id: string) => testItemsApi.insertCaseStepBefore(id),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: stepsKey }),
  });

  const pasteStepMutation = useMutation({
    mutationFn: (sourceStepId: string) => testItemsApi.importCaseStep(caseId, sourceStepId),
    onSuccess: () => toast.success("已粘贴步骤（设计内容，执行数据不带）"),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: stepsKey }),
  });

  const deleteStepMutation = useMutation({
    mutationFn: (id: string) => testItemsApi.deleteCaseStep(id),
    onSuccess: () => toast.success("已删除步骤"),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: stepsKey }),
  });

  const moveStepMutation = useMutation({
    mutationFn: ({ id, targetIndex }: { id: string; targetIndex: number }) =>
      testItemsApi.moveCaseStep(id, targetIndex),
    onMutate: async ({ id, targetIndex }) => {
      await queryClient.cancelQueries({ queryKey: stepsKey });
      const previous = queryClient.getQueryData<CaseStepRecord[]>(stepsKey);
      patchSteps((list) => {
        const from = list.findIndex((step) => step.id === id);
        if (from < 0) return list;
        const next = [...list];
        const [moved] = next.splice(from, 1);
        next.splice(Math.max(0, Math.min(targetIndex, next.length)), 0, moved);
        return next.map((step, index) => ({ ...step, seq: index + 1, sortOrder: index }));
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(stepsKey, context.previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: stepsKey }),
  });

  return {
    stepsQuery,
    steps: stepsQuery.data ?? [],
    createStepMutation,
    updateStepMutation,
    toggleStepMutation,
    saveStepBlocksMutation,
    duplicateStepMutation,
    insertStepBeforeMutation,
    pasteStepMutation,
    deleteStepMutation,
    moveStepMutation,
  };
}
