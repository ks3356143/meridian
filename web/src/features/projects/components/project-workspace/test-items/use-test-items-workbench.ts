import { useCallback, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  BatchAssignCasesPayload,
  CreateTestItemFolderPayload,
  CreateTestItemPayload,
  UpdateCasePayload,
  UpdateSubItemPayload,
  UpdateTestItemPayload,
} from "@/features/test-items/api";
import { testItemsApi } from "@/features/test-items/api";
import type {
  TestCaseRecord,
  TestItemDetail,
  TestItemRecord,
  TestItemsWorkspace,
  TestSubItemRecord,
} from "@/features/test-items/types";
import type { Project } from "../../../types";
import { placeCase, placeTestItem } from "./test-items-tree-model";

function applyItemPatch(item: TestItemRecord, payload: UpdateTestItemPayload): TestItemRecord {
  const next = { ...item };
  if (payload.typeCode !== undefined && payload.typeCode !== item.typeCode) {
    next.typeCode = payload.typeCode;
    next.identifier = `XQ_${payload.typeCode}_${next.suffix}`;
  }
  if (payload.name !== undefined) next.name = payload.name;
  if (payload.suffix !== undefined) {
    next.suffix = payload.suffix;
    next.identifier = `XQ_${item.typeCode}_${payload.suffix}`;
  }
  if (payload.priority !== undefined) next.priority = payload.priority;
  if (payload.folderId !== undefined) next.folderId = payload.folderId;
  if (payload.description !== undefined) next.description = payload.description;
  if (payload.adequacy !== undefined) next.adequacy = payload.adequacy;
  if (payload.passCriteria !== undefined) next.passCriteria = payload.passCriteria;
  if (payload.implicitRequirement !== undefined)
    next.implicitRequirement = payload.implicitRequirement;
  return next;
}

export function useTestItemsWorkbench(project: Project, roundId: string) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState("");
  const workbenchKey = useMemo(
    () => ["projects", project.id, "test-items", "workbench", roundId],
    [project.id, roundId],
  );
  const detailKey = useCallback((testItemId: string) => ["test-items", "detail", testItemId], []);

  const workbenchQuery = useQuery({
    queryKey: workbenchKey,
    queryFn: () => testItemsApi.workspace(project.id, roundId),
    placeholderData: keepPreviousData,
  });
  const detailQuery = useQuery({
    queryKey: detailKey(selectedId),
    queryFn: () => testItemsApi.detail(selectedId),
    enabled: selectedId !== "",
    // 切换测试项时保留上一份详情、原地更新（骨架屏不再闪一次）：与需求详情同口径（srs/23）。
    placeholderData: keepPreviousData,
  });

  const invalidateWorkbench = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["projects", project.id, "test-items"] }),
    [project.id, queryClient],
  );
  /** 用例/步骤改动会联动用例状态与树徽章：工作台与详情缓存一起作废。 */
  const invalidateCaseData = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["projects", project.id, "test-items"] });
    void queryClient.invalidateQueries({ queryKey: ["test-items", "detail"] });
  }, [project.id, queryClient]);
  /** 需求详情缓存也依赖测试项关联，删除/关联/解除后必须让它重新取数。 */
  const invalidateRequirementLinks = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ["software-requirements"],
      predicate: (query) => query.queryKey.length >= 3 && query.queryKey[2] === "test-items",
    });
    void queryClient.invalidateQueries({ queryKey: ["projects", project.id, "requirements"] });
  }, [project.id, queryClient]);

  const createItemMutation = useMutation({
    mutationFn: (payload: CreateTestItemPayload) =>
      testItemsApi.createItem(project.id, roundId, payload),
    onSuccess: (item) => {
      toast.success(`已新增测试项 ${item.identifier}`);
      void invalidateWorkbench();
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTestItemPayload }) =>
      testItemsApi.updateItem(id, payload),
    onMutate: async ({ id, payload }) => {
      // 乐观交互：先落详情缓存，失败原子回滚。
      await queryClient.cancelQueries({ queryKey: detailKey(id) });
      const previous = queryClient.getQueryData<TestItemDetail>(detailKey(id));
      // 类型/文件夹会重排树分组，必须重新取工作台；其它字段只 patch 当前行。
      const structural =
        payload.typeCode !== undefined ||
        payload.folderId !== undefined ||
        payload.clearFolder === true;
      if (previous) {
        queryClient.setQueryData<TestItemDetail>(detailKey(id), {
          ...previous,
          item: applyItemPatch(previous.item, payload),
        });
      }
      let previousWorkspace: TestItemsWorkspace | undefined;
      if (!structural) {
        await queryClient.cancelQueries({ queryKey: workbenchKey });
        previousWorkspace = queryClient.getQueryData<TestItemsWorkspace>(workbenchKey);
        if (previousWorkspace) {
          queryClient.setQueryData<TestItemsWorkspace>(workbenchKey, {
            ...previousWorkspace,
            items: previousWorkspace.items.map((item) =>
              item.id === id ? applyItemPatch(item, payload) : item,
            ),
          });
        }
      }
      return { previous, previousWorkspace };
    },
    onError: (_error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(detailKey(variables.id), context.previous);
      }
      if (context?.previousWorkspace) {
        queryClient.setQueryData(workbenchKey, context.previousWorkspace);
      }
    },
    onSuccess: (item, variables) => {
      queryClient.setQueryData<TestItemDetail>(detailKey(variables.id), (previous) =>
        previous ? { ...previous, item } : previous,
      );
      queryClient.setQueryData<TestItemsWorkspace>(workbenchKey, (previous) =>
        previous
          ? {
              ...previous,
              items: previous.items.map((current) => (current.id === item.id ? item : current)),
            }
          : previous,
      );
    },
    onSettled: (_data, _error, variables) => {
      if (
        variables.payload.typeCode !== undefined ||
        variables.payload.folderId !== undefined ||
        variables.payload.clearFolder === true
      ) {
        void invalidateWorkbench();
      }
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => testItemsApi.deleteItem(id),
    onSuccess: (_result, id) => {
      toast.success("已删除测试项");
      queryClient.removeQueries({ queryKey: detailKey(id) });
      setSelectedId((current) => (current === id ? "" : current));
      void invalidateWorkbench();
      invalidateRequirementLinks();
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: (payload: CreateTestItemFolderPayload) =>
      testItemsApi.createFolder(project.id, roundId, payload),
    onSuccess: (folder) => {
      toast.success(`已新建文件夹「${folder.name}」`);
      void invalidateWorkbench();
    },
  });

  const linkMutation = useMutation({
    mutationFn: ({ testItemId, requirementId }: { testItemId: string; requirementId: string }) =>
      testItemsApi.linkRequirement(testItemId, requirementId),
    onSuccess: (references, variables) => {
      queryClient.setQueryData<TestItemDetail>(detailKey(variables.testItemId), (previous) =>
        previous ? { ...previous, requirements: references } : previous,
      );
      toast.success("已关联需求");
      void invalidateWorkbench();
      invalidateRequirementLinks();
    },
  });

  // ---- 测试方法（子项）----
  const patchSubItems = (
    testItemId: string,
    update: (list: TestSubItemRecord[]) => TestSubItemRecord[],
  ) => {
    queryClient.setQueryData<TestItemDetail>(detailKey(testItemId), (previous) =>
      previous ? { ...previous, subItems: update(previous.subItems) } : previous,
    );
  };

  const patchCases = (testItemId: string, update: (list: TestCaseRecord[]) => TestCaseRecord[]) => {
    queryClient.setQueryData<TestItemDetail>(detailKey(testItemId), (previous) =>
      previous ? { ...previous, cases: update(previous.cases) } : previous,
    );
  };

  const createSubItemMutation = useMutation({
    mutationFn: ({ testItemId, name }: { testItemId: string; name: string }) =>
      testItemsApi.createSubItem(testItemId, name),
    onSuccess: (created, variables) => {
      patchSubItems(variables.testItemId, (list) => [...list, created]);
      void invalidateWorkbench();
    },
  });

  const updateSubItemMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateSubItemPayload }) =>
      testItemsApi.updateSubItem(id, payload),
    onSuccess: (updated, variables) => {
      patchSubItems(updated.testItemId, (list) =>
        list.map((sub) => (sub.id === variables.id ? updated : sub)),
      );
    },
  });

  const deleteSubItemMutation = useMutation({
    mutationFn: ({ testItemId, id }: { testItemId: string; id: string }) =>
      testItemsApi.deleteSubItem(id).then(() => ({ testItemId, id })),
    onMutate: async ({ testItemId, id }) => {
      const previous = queryClient.getQueryData<TestItemDetail>(detailKey(testItemId));
      patchSubItems(testItemId, (list) => list.filter((sub) => sub.id !== id));
      return { previous };
    },
    onError: (_error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(detailKey(variables.testItemId), context.previous);
      }
    },
    onSettled: (_data, _error, variables) => {
      void invalidateWorkbench();
      void queryClient.invalidateQueries({ queryKey: detailKey(variables.testItemId) });
    },
  });

  const duplicateSubItemMutation = useMutation({
    mutationFn: ({ testItemId, id }: { testItemId: string; id: string }) =>
      testItemsApi.duplicateSubItem(id).then((created) => ({ testItemId, created })),
    onSuccess: ({ testItemId, created }) => {
      patchSubItems(testItemId, (list) => [...list, created]);
      void invalidateWorkbench();
    },
  });

  const moveSubItemMutation = useMutation({
    mutationFn: ({ id, targetIndex }: { testItemId: string; id: string; targetIndex: number }) =>
      testItemsApi.moveSubItem(id, targetIndex).then(() => ({ id, targetIndex })),
    onMutate: async ({ testItemId, id, targetIndex }) => {
      await queryClient.cancelQueries({ queryKey: detailKey(testItemId) });
      const previous = queryClient.getQueryData<TestItemDetail>(detailKey(testItemId));
      patchSubItems(testItemId, (list) => {
        const from = list.findIndex((sub) => sub.id === id);
        if (from < 0) return list;
        const next = [...list];
        const [moved] = next.splice(from, 1);
        next.splice(Math.max(0, Math.min(targetIndex, next.length)), 0, moved);
        return next.map((sub, index) => ({ ...sub, seq: index + 1, sortOrder: index }));
      });
      return { previous };
    },
    onError: (_error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(detailKey(variables.testItemId), context.previous);
      }
    },
    onSettled: (_data, _error, variables) => {
      void invalidateWorkbench();
      void queryClient.invalidateQueries({ queryKey: detailKey(variables.testItemId) });
    },
  });

  const createCaseMutation = useMutation({
    mutationFn: ({ testItemId, name }: { testItemId: string; name: string }) =>
      testItemsApi.createCase(testItemId, name),
    onSuccess: (created) => {
      queryClient.setQueryData<TestItemDetail>(detailKey(created.testItemId), (previous) =>
        previous ? { ...previous, cases: [...previous.cases, created] } : previous,
      );
      toast.success(`已生成用例 ${created.identifier}`);
      void invalidateWorkbench();
    },
  });

  const duplicateItemMutation = useMutation({
    mutationFn: (id: string) => testItemsApi.duplicateItem(id),
    onSuccess: (item) => {
      toast.success(`已复制新增 ${item.identifier}`);
      setSelectedId(item.id);
      void invalidateWorkbench();
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => testItemsApi.updateFolder(id, name),
    onSuccess: (folder) => {
      toast.success(`文件夹已重命名为「${folder.name}」`);
      void invalidateWorkbench();
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => testItemsApi.deleteFolder(id),
    onSuccess: () => {
      toast.success("文件夹已删除，内部测试项移回类型根目录");
      void invalidateWorkbench();
    },
  });

  /** 用例字段更新（树内重命名 + 用例详情面板共用）。 */
  const updateCaseMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCasePayload }) =>
      testItemsApi.updateCase(id, payload),
    onSuccess: (updated) => {
      patchCases(updated.testItemId, (list) =>
        list.map((record) => (record.id === updated.id ? updated : record)),
      );
      queryClient.setQueryData<TestItemsWorkspace>(workbenchKey, (previous) =>
        previous
          ? {
              ...previous,
              cases: previous.cases.map((record) => (record.id === updated.id ? updated : record)),
            }
          : previous,
      );
    },
  });

  const batchAssignCasesMutation = useMutation({
    mutationFn: ({
      testItemId,
      caseIds,
      payload,
    }: {
      testItemId: string;
      caseIds: string[];
      payload: Omit<BatchAssignCasesPayload, "caseIds">;
    }) => testItemsApi.batchAssignCases(testItemId, { ...payload, caseIds }),
    onSuccess: (updated, variables) => {
      const updatedByID = new Map(updated.map((record) => [record.id, record]));
      patchCases(variables.testItemId, (list) =>
        list.map((record) => updatedByID.get(record.id) ?? record),
      );
      queryClient.setQueryData<TestItemsWorkspace>(workbenchKey, (previous) =>
        previous
          ? {
              ...previous,
              cases: previous.cases.map((record) => updatedByID.get(record.id) ?? record),
            }
          : previous,
      );
      toast.success(`已批量更新 ${updated.length} 条用例`);
    },
    onSettled: () => void invalidateWorkbench(),
  });

  const copyCaseMutation = useMutation({
    mutationFn: ({
      id,
      targetItemId,
      targetIndex,
    }: {
      id: string;
      targetItemId: string;
      targetIndex: number;
    }) => testItemsApi.copyCase(id, targetItemId, targetIndex),
    onSuccess: (created) => {
      toast.success(`已复制为 ${created.identifier}`);
      void invalidateWorkbench();
      void queryClient.invalidateQueries({ queryKey: ["test-items", "detail"] });
    },
  });

  const duplicateCaseMutation = useMutation({
    mutationFn: ({ testItemId, id }: { testItemId: string; id: string }) =>
      testItemsApi.duplicateCase(id).then((created) => ({ testItemId, created })),
    onSuccess: ({ testItemId, created }) => {
      patchCases(testItemId, (list) => [...list, created]);
      toast.success(`已复制用例 ${created.identifier}`);
      void invalidateWorkbench();
    },
  });

  const moveItemMutation = useMutation({
    mutationFn: ({
      id,
      folderId,
      targetIndex,
    }: {
      id: string;
      folderId: string | null;
      targetIndex: number;
    }) => testItemsApi.moveItem(id, folderId, targetIndex),
    onMutate: async ({ id, folderId, targetIndex }) => {
      await queryClient.cancelQueries({ queryKey: workbenchKey });
      const previous = queryClient.getQueryData<TestItemsWorkspace>(workbenchKey);
      if (previous) {
        queryClient.setQueryData(workbenchKey, placeTestItem(previous, id, folderId, targetIndex));
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(workbenchKey, context.previous);
    },
    onSettled: () => void invalidateWorkbench(),
  });

  const moveCaseMutation = useMutation({
    mutationFn: ({
      id,
      targetItemId,
      targetIndex,
    }: {
      id: string;
      targetItemId: string;
      targetIndex: number;
    }) => testItemsApi.moveCase(id, targetItemId, targetIndex),
    onMutate: async ({ id, targetItemId, targetIndex }) => {
      await queryClient.cancelQueries({ queryKey: workbenchKey });
      const previous = queryClient.getQueryData<TestItemsWorkspace>(workbenchKey);
      if (previous) {
        queryClient.setQueryData(workbenchKey, placeCase(previous, id, targetItemId, targetIndex));
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(workbenchKey, context.previous);
    },
    // 跨项移动会重排标识：详情缓存同样作废，不能只刷工作台列表。
    onSettled: () => {
      void invalidateWorkbench();
      void queryClient.invalidateQueries({ queryKey: ["test-items", "detail"] });
    },
  });

  const deleteCaseMutation = useMutation({
    mutationFn: ({ testItemId, id }: { testItemId: string; id: string }) =>
      testItemsApi.deleteCase(id).then(() => ({ testItemId, id })),
    onSuccess: (_result, variables) => {
      patchCases(variables.testItemId, (list) =>
        list.filter((record) => record.id !== variables.id),
      );
      toast.success("已删除用例");
      void invalidateWorkbench();
      // 删除后服务端会重排剩余用例的序号与标识，详情必须重新取一次。
      void queryClient.invalidateQueries({ queryKey: detailKey(variables.testItemId) });
    },
  });

  const ensureStaticItemsMutation = useMutation({
    mutationFn: () => testItemsApi.ensureStaticItems(project.id),
    onSuccess: (created) => {
      if (created.length === 0) toast.info("推荐静态测试项已齐全");
      else toast.success(`已补齐 ${created.length} 个静态测试项`);
      void invalidateWorkbench();
    },
  });

  const deleteStaticItemsMutation = useMutation({
    mutationFn: () => testItemsApi.deleteStaticItems(project.id),
    onSuccess: (removed) => {
      toast.success(`已删除 ${removed} 个静态测试项`);
      void invalidateWorkbench();
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: ({ testItemId, requirementId }: { testItemId: string; requirementId: string }) =>
      testItemsApi.unlinkRequirement(testItemId, requirementId),
    onSuccess: (references, variables) => {
      queryClient.setQueryData<TestItemDetail>(detailKey(variables.testItemId), (previous) =>
        previous ? { ...previous, requirements: references } : previous,
      );
      toast.success("已解除关联");
      void invalidateWorkbench();
      invalidateRequirementLinks();
    },
  });

  return {
    workbenchQuery,
    detailQuery,
    selectedId,
    setSelectedId,
    createItemMutation,
    updateItemMutation,
    deleteItemMutation,
    createFolderMutation,
    linkMutation,
    unlinkMutation,
    createSubItemMutation,
    updateSubItemMutation,
    deleteSubItemMutation,
    duplicateSubItemMutation,
    moveSubItemMutation,
    createCaseMutation,
    duplicateItemMutation,
    updateFolderMutation,
    deleteFolderMutation,
    updateCaseMutation,
    invalidateCaseData,
    duplicateCaseMutation,
    copyCaseMutation,
    batchAssignCasesMutation,
    deleteCaseMutation,
    moveItemMutation,
    moveCaseMutation,
    ensureStaticItemsMutation,
    deleteStaticItemsMutation,
  };
}
