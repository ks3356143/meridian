import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { requirementsApi } from "@/features/requirements/api";
import type { RequirementSearchField } from "@/features/requirements/types";

export type { RequirementSearchField, RequirementSearchHit } from "@/features/requirements/types";

export const requirementSearchFieldLabels: Record<RequirementSearchField, string> = {
  chapter: "章节号",
  description: "描述",
  externalIdentifier: "标识",
  name: "名称",
  tags: "标签",
};

function useDebouncedValue<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debouncedValue;
}

export function useRequirementSearch(projectId: string, query: string) {
  const normalizedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(normalizedQuery, 220);
  const searchQuery = useQuery({
    queryKey: ["projects", projectId, "requirements", "search", debouncedQuery],
    queryFn: () => requirementsApi.search(projectId, debouncedQuery),
    enabled: debouncedQuery.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  return useMemo(() => {
    const hits = debouncedQuery ? (searchQuery.data?.items ?? []) : [];
    return {
      error: searchQuery.error,
      hits,
      hitsById: new Map(hits.map((hit) => [hit.id, hit])),
      isSearching: debouncedQuery.length > 0 && searchQuery.isFetching,
      query: debouncedQuery,
    };
  }, [debouncedQuery, searchQuery.data, searchQuery.error, searchQuery.isFetching]);
}
