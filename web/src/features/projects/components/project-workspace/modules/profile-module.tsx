import { ReceivedAssetsWorkbench } from "../assets/received-assets-workbench";
import type { Project } from "../../../types";

export function ProfileModule({ project }: { project: Project }) {
  return <ReceivedAssetsWorkbench project={project} />;
}
