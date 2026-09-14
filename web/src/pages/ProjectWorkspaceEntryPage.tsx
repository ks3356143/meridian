import { useOutletContext } from "react-router";
import type { ProjectWorkspaceOutletContext } from "@/features/projects/components/project-workspace/project-workspace-layout";
import { WorkspaceHome } from "@/features/projects/components/project-workspace/architecture/workspace-home";

export function Component() {
  useOutletContext<ProjectWorkspaceOutletContext>();

  return <WorkspaceHome />;
}
