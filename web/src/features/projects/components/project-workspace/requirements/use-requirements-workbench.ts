import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { requirementsApi } from "@/features/requirements/api";
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
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey],
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

  return { workbenchQuery, createMutation, updateMutation };
}
