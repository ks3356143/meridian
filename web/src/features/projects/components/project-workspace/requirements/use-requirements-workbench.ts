import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { requirementsApi, type SaveRequirementPayload } from "@/features/requirements/api";
import type { Project } from "../../../types";

export function useRequirementsWorkbench(project: Project) {
  const queryClient = useQueryClient();
  const [requestedSourceVersionId, setRequestedSourceVersionId] = useState("");

  const workbenchQuery = useQuery({
    queryKey: ["projects", project.id, "requirements", requestedSourceVersionId],
    queryFn: () => requirementsApi.workbench(project.id, requestedSourceVersionId || undefined),
  });

  const invalidate = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: ["projects", project.id, "requirements"],
    });
  }, [project.id, queryClient]);

  const createSectionMutation = useMutation({
    mutationFn: (payload: Parameters<typeof requirementsApi.createSection>[1]) =>
      requirementsApi.createSection(project.id, payload),
    onSuccess: () => {
      toast.success("已保存需求章节");
      return invalidate();
    },
  });

  const createRequirementMutation = useMutation({
    mutationFn: (payload: SaveRequirementPayload) => requirementsApi.create(project.id, payload),
    onSuccess: () => {
      toast.success("已保存正式需求，测试项待创建契约已记录");
      return invalidate();
    },
  });

  const updateRequirementMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Omit<SaveRequirementPayload, "sourceVersionId">;
    }) => requirementsApi.update(id, payload),
    onSuccess: () => {
      toast.success("需求登记信息已更新");
      return invalidate();
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof requirementsApi.bulkCreate>[1]) =>
      requirementsApi.bulkCreate(project.id, payload),
    onSuccess: (result) => {
      toast.success(`已保存 ${result.sectionCount} 个章节和 ${result.requirementCount} 条需求结构`);
      return invalidate();
    },
  });

  const parseMutation = useMutation({
    mutationFn: (versionId: string) => requirementsApi.parse(project.id, versionId),
    onSuccess: (result) => {
      toast.success(`解析完成：${result.sectionCount} 个章节，${result.candidateCount} 条候选需求`);
      return invalidate();
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: (payload: Parameters<typeof requirementsApi.changeStatus>[1]) =>
      requirementsApi.changeStatus(project.id, payload),
    onSuccess: (result, variables) => {
      toast.success(
        variables.action === "confirm"
          ? `已确认 ${result.updatedCount} 条候选需求`
          : `已排除 ${result.updatedCount} 条需求`,
      );
      return invalidate();
    },
  });

  const workbench = useMemo(() => workbenchQuery.data, [workbenchQuery.data]);
  const sources = workbench?.sources ?? [];
  const activeSource =
    sources.find((source) => source.id === requestedSourceVersionId) ?? sources[0];

  return {
    workbenchQuery,
    workbench,
    sources,
    activeSource,
    sourceVersionId: activeSource?.id ?? "",
    setSourceVersionId: setRequestedSourceVersionId,
    createSectionMutation,
    createRequirementMutation,
    updateRequirementMutation,
    bulkCreateMutation,
    parseMutation,
    changeStatusMutation,
  };
}
