import { RequirementsLayout } from "../requirements/requirements-layout";
import type { Project } from "../../../types";

export function RequirementsModule({ project }: { project: Project }) {
  return <RequirementsLayout project={project} />;
}
