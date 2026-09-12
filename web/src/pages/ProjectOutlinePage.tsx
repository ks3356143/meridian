import { useOutletContext } from "react-router";
import { OutlineWorkbench } from "@/features/projects/components/project-workspace/outline/outline-workbench";
import type { ProjectWorkspaceOutletContext } from "@/features/projects/components/project-workspace/project-workspace-layout";

export function Component() {
  const { project } = useOutletContext<ProjectWorkspaceOutletContext>();

  return <OutlineWorkbench project={project} />;
}
