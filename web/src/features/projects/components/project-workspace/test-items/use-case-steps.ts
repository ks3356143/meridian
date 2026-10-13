import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { testItemsApi } from "@/features/test-items/api";
import type { CaseStepRecord } from "@/features/test-items/types";

/**
 * 用例步骤（切片 5a）：列表 + 增删改与三态切换。
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

  const createStepMutation = useMutation({
    mutationFn: () => testItemsApi.createCaseStep(caseId, ""),
    onSuccess: (created) => {
      patchSteps((list) => [...list, created].sort((left, right) => left.seq - right.seq));
    },
  });

  const updateStepMutation = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; expectText?: string; passed?: string }) =>
      testItemsApi.updateCaseStep(id, payload),
    onSuccess: (updated) => {
      patchSteps((list) => list.map((step) => (step.id === updated.id ? updated : step)));
      // 预期结果/通过状态的任何改动都会让服务端重算用例状态与执行时间（撤销同理）。
      onCaseChanged();
    },
  });

  const toggleStepMutation = useMutation({
    mutationFn: (id: string) => testItemsApi.toggleCaseStep(id),
    onSuccess: (updated) => {
      patchSteps((list) => list.map((step) => (step.id === updated.id ? updated : step)));
      onCaseChanged();
    },
  });

  const duplicateStepMutation = useMutation({
    mutationFn: (id: string) => testItemsApi.duplicateCaseStep(id),
    // 复制插在源步骤下方并重排序号，交给服务端口径：整表重取最稳。
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
    duplicateStepMutation,
    deleteStepMutation,
    moveStepMutation,
  };
}
