import { useMemo } from "react";
import type { RequirementRecord } from "@/features/requirements/types";

export type RequirementSearchField =
  | "chapter"
  | "description"
  | "externalIdentifier"
  | "name"
  | "tags";

export type RequirementSearchHit = {
  excerpt: string;
  fields: RequirementSearchField[];
  requirement: RequirementRecord;
};

export const requirementSearchFieldLabels: Record<RequirementSearchField, string> = {
  chapter: "章节号",
  description: "描述",
  externalIdentifier: "标识",
  name: "名称",
  tags: "标签",
};

function buildExcerpt(
  requirement: RequirementRecord,
  query: string,
  fields: RequirementSearchField[],
) {
  const source = fields.includes("description")
    ? requirement.description
    : fields.includes("name")
      ? requirement.name
      : fields.includes("chapter")
        ? `§${requirement.chapterNumber} ${requirement.name}`
        : fields.includes("externalIdentifier")
          ? requirement.externalIdentifier
          : requirement.tags.join(" / ");

  const lowercaseSource = source.toLowerCase();
  const matchIndex = lowercaseSource.indexOf(query);
  if (matchIndex < 0) return source.length > 120 ? `${source.slice(0, 117)}...` : source;

  const start = Math.max(0, matchIndex - 42);
  const end = Math.min(source.length, matchIndex + query.length + 72);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < source.length ? "..." : "";
  return `${prefix}${source.slice(start, end)}${suffix}`;
}

export function useRequirementSearch(requirements: RequirementRecord[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedChapterQuery = normalizedQuery.replace(/^§/, "");

  return useMemo(() => {
    if (!normalizedQuery) {
      return {
        hits: [] as RequirementSearchHit[],
        hitsById: new Map<string, RequirementSearchHit>(),
      };
    }

    const hits = requirements.flatMap((requirement) => {
      const fields: RequirementSearchField[] = [];
      const chapterNumber = requirement.chapterNumber.toLowerCase();

      if (
        normalizedChapterQuery &&
        (chapterNumber === normalizedChapterQuery ||
          chapterNumber.startsWith(`${normalizedChapterQuery}.`))
      ) {
        fields.push("chapter");
      }
      if (requirement.name.toLowerCase().includes(normalizedQuery)) fields.push("name");
      if (requirement.description.toLowerCase().includes(normalizedQuery)) {
        fields.push("description");
      }
      if (requirement.externalIdentifier.toLowerCase().includes(normalizedQuery)) {
        fields.push("externalIdentifier");
      }
      if (requirement.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))) {
        fields.push("tags");
      }

      if (!fields.length) return [];
      return [
        {
          excerpt: buildExcerpt(requirement, normalizedQuery, fields),
          fields,
          requirement,
        },
      ];
    });

    return {
      hits,
      hitsById: new Map(hits.map((hit) => [hit.requirement.id, hit])),
    };
  }, [normalizedChapterQuery, normalizedQuery, requirements]);
}
