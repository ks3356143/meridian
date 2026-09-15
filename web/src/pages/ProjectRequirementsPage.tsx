import { useOutletContext } from "react-router";
import { RequirementsModule } from "@/features/projects/components/project-workspace/modules/requirements-module";
import type { ProjectWorkspaceOutletContext } from "@/features/projects/components/project-workspace/project-workspace-layout";

export function Component() {
  const { project } = useOutletContext<ProjectWorkspaceOutletContext>();
  return <RequirementsModule project={project} />;
}
