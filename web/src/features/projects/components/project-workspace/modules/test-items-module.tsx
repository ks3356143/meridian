import type { Project } from "../../../types";
import { TestItemsWorkbench } from "../test-items/test-items-workbench";

export function TestItemsModule({ project }: { project: Project }) {
  return <TestItemsWorkbench project={project} />;
}
