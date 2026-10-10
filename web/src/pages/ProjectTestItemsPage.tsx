import { useOutletContext } from "react-router";
import { TestItemsModule } from "@/features/projects/components/project-workspace/modules/test-items-module";
import type { ProjectWorkspaceOutletContext } from "@/features/projects/components/project-workspace/project-workspace-layout";

export function Component() {
  const { project } = useOutletContext<ProjectWorkspaceOutletContext>();
  return <TestItemsModule project={project} />;
}
