import { RequirementsWorkbench } from "../requirements/requirements-workbench";
import type { Project } from "../../../types";

export function RequirementsModule({ project }: { project: Project }) {
  return <RequirementsWorkbench project={project} />;
}
