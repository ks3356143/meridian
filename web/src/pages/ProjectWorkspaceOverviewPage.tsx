import { useOutletContext } from "react-router";
import { WorkbenchOverview } from "@/features/projects/components/workbench/workbench-overview";
import type { ProjectWorkspaceOutletContext } from "@/features/projects/components/project-workspace/project-workspace-layout";

export function Component() {
  const { project, executionRate } = useOutletContext<ProjectWorkspaceOutletContext>();

  return <WorkbenchOverview project={project} rate={executionRate} />;
}
