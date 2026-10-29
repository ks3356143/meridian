import { useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { testItemsApi } from "@/features/test-items/api";

export const ALL_ROUNDS_ID = "all";

/** URL 是轮次选择的唯一状态源；缺失或失效时回写默认轮次。 */
export function useRoundSelection(projectCode: string, enabled: boolean, allowAll = false) {
  const [searchParams, setSearchParams] = useSearchParams();
  const roundsQuery = useQuery({
    queryKey: ["projects", projectCode, "test-rounds"],
    queryFn: () => testItemsApi.rounds(projectCode),
    enabled,
    staleTime: 30_000,
  });
  const rounds = useMemo(() => roundsQuery.data ?? [], [roundsQuery.data]);
  const requested = searchParams.get("roundId") ?? "";
  const defaultRound = useMemo(() => {
    const openRounds = rounds.filter((round) => round.status !== "closed");
    return (openRounds.at(-1) ?? rounds.at(-1))?.id ?? "";
  }, [rounds]);
  const requestedRound = rounds.find((round) => round.id === requested);
  const roundId =
    allowAll && requested === ALL_ROUNDS_ID ? ALL_ROUNDS_ID : (requestedRound?.id ?? defaultRound);

  useEffect(() => {
    if (!enabled || rounds.length === 0 || requested === roundId) return;
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("roundId", roundId);
        return next;
      },
      { replace: true },
    );
  }, [enabled, requested, roundId, rounds.length, setSearchParams]);

  const setRoundId = useCallback(
    (nextRoundId: string) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set("roundId", nextRoundId);
        return next;
      });
    },
    [setSearchParams],
  );

  return {
    rounds,
    roundId,
    setRoundId,
    isLoading: roundsQuery.isPending,
    isError: roundsQuery.isError,
    refetch: roundsQuery.refetch,
  };
}
