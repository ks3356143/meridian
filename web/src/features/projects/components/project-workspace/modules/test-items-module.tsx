import { useState } from "react";
import { useSearchParams } from "react-router";
import type { Project } from "../../../types";
import { TestItemsWorkbench } from "../test-items/test-items-workbench";
import { useRoundSelection } from "../use-round-selection";

export function TestItemsModule({ project }: { project: Project }) {
  const { roundId } = useRoundSelection(project.id, true, true);
  const [, setSearchParams] = useSearchParams();
  const [targetItemId, setTargetItemId] = useState("");
  const [targetCaseId, setTargetCaseId] = useState("");

  return (
    <TestItemsWorkbench
      project={project}
      roundId={roundId}
      targetItemId={targetItemId}
      targetCaseId={targetCaseId}
      onTargetItemHandled={() => setTargetItemId("")}
      onTargetCaseHandled={() => setTargetCaseId("")}
      onOpenItemRound={(nextRoundId, itemId) => {
        setTargetCaseId("");
        setTargetItemId(itemId);
        setSearchParams((current) => {
          const next = new URLSearchParams(current);
          next.set("roundId", nextRoundId);
          next.set("view", "tree");
          next.delete("type");
          return next;
        });
      }}
      onOpenCaseRound={(nextRoundId, itemId, caseId) => {
        setTargetItemId(itemId);
        setTargetCaseId(caseId);
        setSearchParams((current) => {
          const next = new URLSearchParams(current);
          next.set("roundId", nextRoundId);
          next.set("view", "tree");
          next.delete("type");
          return next;
        });
      }}
    />
  );
}
