import { useQuery } from "@tanstack/react-query";
import { Outlet, useParams } from "react-router";
import { QueryError, QueryLoading } from "@/components/shared/query-state";
import { projectsApi } from "@/features/projects/api";
import { ProjectWorkspaceLayout } from "@/features/projects/components/project-workspace/project-workspace-layout";

export function Component() {
  const { code } = useParams();
  const projectQuery = useQuery({
    queryKey: ["projects", "detail", code],
    queryFn: () => projectsApi.detail(code ?? ""),
    enabled: Boolean(code),
  });

  if (projectQuery.isPending) {
    return <QueryLoading label="正在加载项目工作区" rows={6} />;
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <QueryError
        title="项目工作区加载失败"
        description="项目可能不存在，或后端服务当前不可用。"
        onRetry={() => projectQuery.refetch()}
      />
    );
  }

  const project = projectQuery.data;
  const executionRate = Math.round((project.casesExecuted / Math.max(project.casesTotal, 1)) * 100);
  const openIssues =
    project.openIssues.critical +
    project.openIssues.serious +
    project.openIssues.normal +
    project.openIssues.suggestion;

  return (
    <ProjectWorkspaceLayout project={project}>
      <Outlet context={{ project, executionRate, openIssues }} />
    </ProjectWorkspaceLayout>
  );
}
