import { useState } from "react";
import type { Project } from "../../../types";
import { TestItemsWorkbench } from "../test-items/test-items-workbench";
import { useRoundSelection } from "../use-round-selection";

export function TestItemsModule({ project }: { project: Project }) {
  const { roundId, setRoundId } = useRoundSelection(project.id, true, true);
  const [targetItemId, setTargetItemId] = useState("");

  return (
    <TestItemsWorkbench
      project={project}
      roundId={roundId}
      targetItemId={targetItemId}
      onTargetItemHandled={() => setTargetItemId("")}
      onOpenItemRound={(nextRoundId, itemId) => {
        setTargetItemId(itemId);
        setRoundId(nextRoundId);
      }}
    />
  );
}
