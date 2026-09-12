import { Navigate, useOutletContext } from "react-router";
import type { ProjectWorkspaceOutletContext } from "@/features/projects/components/project-workspace/project-workspace-layout";

export function Component() {
  const { project } = useOutletContext<ProjectWorkspaceOutletContext>();

  return <Navigate to={project.status === "编制大纲中" ? "outline" : "overview"} replace />;
}
