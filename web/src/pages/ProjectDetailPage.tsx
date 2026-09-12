import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { QueryError, QueryLoading } from "@/components/shared/query-state";
import { projectsApi } from "@/features/projects/api";
import { ProjectDetail } from "@/features/projects/components/project-detail/project-detail";

export function Component() {
  const { code } = useParams();
  const projectQuery = useQuery({
    queryKey: ["projects", "detail", code],
    queryFn: () => projectsApi.detail(code ?? ""),
    enabled: Boolean(code),
  });

  if (projectQuery.isPending) {
    return <QueryLoading label="正在加载项目详情" rows={6} />;
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <QueryError
        title="项目详情加载失败"
        description="项目可能不存在，或后端服务当前不可用。"
        onRetry={() => projectQuery.refetch()}
      />
    );
  }

  return <ProjectDetail project={projectQuery.data} />;
}
