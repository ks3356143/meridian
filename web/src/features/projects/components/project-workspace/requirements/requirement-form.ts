import type {
  RequirementPrimaryKind,
  RequirementRecord,
  RequirementSource,
} from "@/features/requirements/types";

export type RequirementDraft = {
  chapterNumber: string;
  externalIdentifier: string;
  name: string;
  description: string;
  primaryKind: RequirementPrimaryKind;
  secondaryKinds: RequirementPrimaryKind[];
};

export type RequirementCopySeed = RequirementDraft & {
  sourceId: string;
  tags: string[];
};

export const requirementKindOptions: Array<{
  value: RequirementPrimaryKind;
  label: string;
}> = [
  { value: "functional", label: "功能" },
  { value: "interface", label: "接口" },
  { value: "performance", label: "性能" },
  { value: "safety", label: "安全性" },
  { value: "reliability", label: "可靠性" },
  { value: "other", label: "其他" },
];

export function isRequirementDraftValid(draft: RequirementDraft) {
  return Object.values(getRequirementDraftErrors(draft)).every((error) => !error);
}

export function getRequirementDraftErrors(draft: RequirementDraft) {
  const chapterNumber = draft.chapterNumber.trim();
  const externalIdentifier = draft.externalIdentifier.trim();

  return {
    chapterNumber: !chapterNumber
      ? "章节号必填"
      : /^\d+(?:\.\d+)*$/.test(chapterNumber)
        ? undefined
        : "章节号格式不正确",
    externalIdentifier: externalIdentifier.length > 64 ? "标识最多 64 个字符" : undefined,
    name: draft.name.trim() ? undefined : "名称必填",
    primaryKind: requirementKindOptions.some((option) => option.value === draft.primaryKind)
      ? undefined
      : "需求类型必填",
    secondaryKinds: draft.secondaryKinds.some((kind) => kind === draft.primaryKind)
      ? "副类型不能与主类型相同"
      : draft.secondaryKinds.some(
            (kind) => !requirementKindOptions.some((option) => option.value === kind),
          )
        ? "副类型不正确"
        : undefined,
  };
}

export function getRequirementSecondaryKindOptions(primaryKind: RequirementPrimaryKind) {
  return requirementKindOptions.map((option) => ({
    ...option,
    disabled: option.value === primaryKind,
    description: option.value === primaryKind ? "与主类型相同" : undefined,
  }));
}

export function requirementSourceLabel(source: RequirementSource) {
  switch (source.objectKind) {
    case "srs":
      return "需求规格说明";
    case "task_book":
      return "研制任务书";
    case "technical_requirement":
      return "技术要求";
    case "development_requirement":
      return "研制总要求";
    default:
      return source.objectName.replace(/^【[^】]+】/, "");
  }
}

export function getNextSiblingChapterNumber(chapterNumber: string, activeChapterNumbers: string[]) {
  const parts = chapterNumber.split(".");
  const parentParts = parts.slice(0, -1);
  const parentPrefix = parentParts.length > 0 ? `${parentParts.join(".")}.` : "";
  const siblingNumbers = activeChapterNumbers
    .filter((item) => item.startsWith(parentPrefix))
    .map((item) => item.slice(parentPrefix.length).split(".")[0])
    .map((item) => Number.parseInt(item, 10))
    .filter((item) => Number.isInteger(item) && item > 0);
  const nextNumber = siblingNumbers.length > 0 ? Math.max(...siblingNumbers) + 1 : 1;

  return `${parentPrefix}${nextNumber}`;
}

export function findActiveChapterConflict(
  chapterNumber: string,
  sourceVersionId: string,
  requirements: RequirementRecord[],
) {
  const normalizedChapterNumber = chapterNumber.trim();
  if (!normalizedChapterNumber) return null;

  return (
    requirements.find(
      (requirement) =>
        requirement.sourceVersionId === sourceVersionId &&
        requirement.chapterNumber === normalizedChapterNumber &&
        (requirement.status === "candidate" || requirement.status === "official"),
    ) ?? null
  );
}

export function getActiveChapterNumbers(
  requirements: RequirementRecord[],
  sourceVersionId: string,
) {
  return requirements
    .filter(
      (requirement) =>
        requirement.sourceVersionId === sourceVersionId &&
        (requirement.status === "candidate" || requirement.status === "official"),
    )
    .map((requirement) => requirement.chapterNumber);
}

export function suggestNextChapterNumber(
  chapterNumber: string,
  requirements: RequirementRecord[],
  sourceVersionId: string,
) {
  return getNextSiblingChapterNumber(chapterNumber, [
    chapterNumber,
    ...getActiveChapterNumbers(requirements, sourceVersionId),
  ]);
}

export function buildRequirementCopySeed(
  requirement: RequirementRecord,
  requirements: RequirementRecord[],
  source: RequirementDraft = requirement,
): RequirementCopySeed {
  return {
    sourceId: requirement.sourceVersionId,
    chapterNumber: suggestNextChapterNumber(
      source.chapterNumber,
      requirements,
      requirement.sourceVersionId,
    ),
    externalIdentifier: "",
    name: source.name,
    description: source.description,
    primaryKind: source.primaryKind,
    secondaryKinds: source.secondaryKinds,
    tags: requirement.tags,
  };
}
