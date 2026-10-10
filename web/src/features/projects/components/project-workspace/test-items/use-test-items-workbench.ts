import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  CreateTestItemFolderPayload,
  CreateTestItemPayload,
  UpdateSubItemPayload,
  UpdateTestItemPayload,
} from "@/features/test-items/api";
import { testItemsApi } from "@/features/test-items/api";
import type {
  TestItemDetail,
  TestItemRecord,
  TestSubItemRecord,
} from "@/features/test-items/types";
import type { Project } from "../../../types";

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

export function useTestItemsWorkbench(project: Project) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState("");
  const workbenchKey = useMemo(
    () => ["projects", project.id, "test-items", "workbench"],
    [project.id],
  );
  const detailKey = useCallback((testItemId: string) => ["test-items", "detail", testItemId], []);

  const workbenchQuery = useQuery({
    queryKey: workbenchKey,
    queryFn: () => testItemsApi.workspace(project.id),
  });
  const detailQuery = useQuery({
    queryKey: detailKey(selectedId),
    queryFn: () => testItemsApi.detail(selectedId),
    enabled: selectedId !== "",
  });

  const invalidateWorkbench = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["projects", project.id, "test-items"] }),
    [project.id, queryClient],
  );

  const createItemMutation = useMutation({
    mutationFn: (payload: CreateTestItemPayload) => testItemsApi.createItem(project.id, payload),
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
      if (previous) {
        queryClient.setQueryData<TestItemDetail>(detailKey(id), {
          ...previous,
          item: applyItemPatch(previous.item, payload),
        });
      }
      return { previous };
    },
    onError: (_error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(detailKey(variables.id), context.previous);
      }
    },
    onSuccess: (item, variables) => {
      queryClient.setQueryData<TestItemDetail>(detailKey(variables.id), (previous) =>
        previous ? { ...previous, item } : previous,
      );
    },
    onSettled: () => invalidateWorkbench(),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => testItemsApi.deleteItem(id),
    onSuccess: (_result, id) => {
      toast.success("已删除测试项");
      queryClient.removeQueries({ queryKey: detailKey(id) });
      setSelectedId((current) => (current === id ? "" : current));
      void invalidateWorkbench();
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: (payload: CreateTestItemFolderPayload) =>
      testItemsApi.createFolder(project.id, payload),
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

  const unlinkMutation = useMutation({
    mutationFn: ({ testItemId, requirementId }: { testItemId: string; requirementId: string }) =>
      testItemsApi.unlinkRequirement(testItemId, requirementId),
    onSuccess: (references, variables) => {
      queryClient.setQueryData<TestItemDetail>(detailKey(variables.testItemId), (previous) =>
        previous ? { ...previous, requirements: references } : previous,
      );
      toast.success("已解除关联");
      void invalidateWorkbench();
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
  };
}
