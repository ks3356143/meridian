import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RequirementRecord } from "@/features/requirements/types";

type RequirementHistoryState = {
  ids: string[];
  index: number;
};

type RequirementHistoryNeighbor = {
  index: number;
  requirement: RequirementRecord;
};

const maximumHistoryLength = 100;

export function useRequirementHistory(
  selectedId: string,
  requirementsById: Map<string, RequirementRecord>,
) {
  const [history, setHistory] = useState<RequirementHistoryState>({ ids: [], index: -1 });
  const pendingIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (!selectedId) return;

    if (pendingIndexRef.current !== null) {
      const targetIndex = pendingIndexRef.current;
      pendingIndexRef.current = null;
      setHistory((previous) => ({
        ids: previous.ids,
        index: Math.min(Math.max(targetIndex, 0), previous.ids.length - 1),
      }));
      return;
    }

    setHistory((previous) => {
      if (previous.ids[previous.index] === selectedId) return previous;

      const ids = [...previous.ids.slice(0, previous.index + 1), selectedId];
      const boundedIds = ids.slice(-maximumHistoryLength);
      return {
        ids: boundedIds,
        index: boundedIds.length - 1,
      };
    });
  }, [selectedId]);

  const getNeighbor = useCallback(
    (offset: -1 | 1): RequirementHistoryNeighbor | null => {
      let cursor = history.index + offset;

      while (cursor >= 0 && cursor < history.ids.length) {
        const requirement = requirementsById.get(history.ids[cursor]);
        if (requirement) return { index: cursor, requirement };
        cursor += offset;
      }

      return null;
    },
    [history, requirementsById],
  );

  const moveTo = useCallback(
    (offset: -1 | 1) => {
      const neighbor = getNeighbor(offset);
      if (!neighbor) return null;

      pendingIndexRef.current = neighbor.index;
      setHistory((previous) => ({ ...previous, index: neighbor.index }));
      return neighbor.requirement;
    },
    [getNeighbor],
  );

  return useMemo(
    () => ({
      next: getNeighbor(1),
      previous: getNeighbor(-1),
      moveTo,
    }),
    [getNeighbor, moveTo],
  );
}
