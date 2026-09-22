import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { requirementsApi } from "@/features/requirements/api";
import type { BulkPurgeRequirementsPayload } from "@/features/requirements/types";
import type { Project } from "../../../types";

export function useRequirementsWorkbench(project: Project) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => ["projects", project.id, "requirements", "workbench"],
    [project.id],
  );
  const workbenchQuery = useQuery({
    queryKey,
    queryFn: () => requirementsApi.workbench(project.id),
  });
  const invalidate = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: ["projects", project.id, "requirements"],
      }),
    [project.id, queryClient],
  );

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof requirementsApi.create>[1]) =>
      requirementsApi.create(project.id, payload),
    onSuccess: () => {
      toast.success("已新增确认需求");
      return invalidate();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof requirementsApi.update>[1];
    }) => requirementsApi.update(id, payload),
    onSuccess: () => invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ ids, reason }: { ids: string[]; reason: string }) =>
      requirementsApi.changeStatus(project.id, {
        ids,
        action: "exclude",
        reason,
      }),
    onSuccess: (result) => {
      toast.success(
        result.updatedCount === 1 ? "已删除确认需求" : `已删除 ${result.updatedCount} 条确认需求`,
      );
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) =>
      requirementsApi.changeStatus(project.id, {
        ids: [id],
        action: "restore",
      }),
    onSuccess: () => {
      toast.success("已恢复确认需求");
      return invalidate();
    },
  });

  const purgeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      requirementsApi.purge(project.id, id, reason),
    onSuccess: () => {
      toast.success("已彻底删除需求");
      return invalidate();
    },
  });

  const bulkPurgeMutation = useMutation({
    mutationFn: (payload: BulkPurgeRequirementsPayload) =>
      requirementsApi.bulkPurge(project.id, payload),
    onSuccess: (result) => {
      toast.success(
        result.deletedCount === 1
          ? "已彻底删除 1 条需求"
          : `已彻底删除 ${result.deletedCount} 条需求`,
      );
      return invalidate();
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof requirementsApi.bulkUpdate>[1]) =>
      requirementsApi.bulkUpdate(project.id, payload),
    onSuccess: (result) => {
      toast.success(`已更新 ${result.updatedCount} 条需求`);
      return invalidate();
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof requirementsApi.bulkCreate>[1]) =>
      requirementsApi.bulkCreate(project.id, payload),
    onSuccess: (result) => {
      toast.success(
        result.requirementCount === 1
          ? "已批量入库 1 条需求"
          : `已批量入库 ${result.requirementCount} 条需求`,
      );
      return invalidate();
    },
  });

  const parseMutation = useMutation({
    mutationFn: (sourceVersionId: string) => requirementsApi.parse(project.id, sourceVersionId),
    onSuccess: (result) => {
      toast.success(
        `解析完成：生成 ${result.candidateCount} 条待确认需求，匹配正式 ${result.officialMatchCount} 条，匹配排除 ${result.excludedMatchCount} 条`,
      );
      return invalidate();
    },
  });

  const candidateStatusMutation = useMutation({
    mutationFn: ({
      ids,
      action,
      reason,
    }: {
      ids: string[];
      action: "confirm" | "exclude";
      reason?: string;
    }) => requirementsApi.changeStatus(project.id, { ids, action, reason }),
    onSuccess: (result, variables) => {
      const label = variables.action === "confirm" ? "确认" : "排除";
      toast.success(
        result.updatedCount === 1
          ? `已${label} 1 条待确认需求`
          : `已${label} ${result.updatedCount} 条待确认需求`,
      );
      return invalidate();
    },
  });

  return {
    workbenchQuery,
    createMutation,
    updateMutation,
    deleteMutation,
    restoreMutation,
    purgeMutation,
    bulkPurgeMutation,
    bulkUpdateMutation,
    bulkCreateMutation,
    parseMutation,
    candidateStatusMutation,
    invalidate,
  };
}
