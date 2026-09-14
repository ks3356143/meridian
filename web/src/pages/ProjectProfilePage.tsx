import { useOutletContext } from "react-router";
import { ProfileModule } from "@/features/projects/components/project-workspace/modules/profile-module";
import type { ProjectWorkspaceOutletContext } from "@/features/projects/components/project-workspace/project-workspace-layout";

export function Component() {
  const { project } = useOutletContext<ProjectWorkspaceOutletContext>();

  return <ProfileModule project={project} />;
}
