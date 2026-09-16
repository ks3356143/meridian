import type { RequirementPrimaryKind, RequirementSource } from "@/features/requirements/types";

export type RequirementDraft = {
  chapterNumber: string;
  externalIdentifier: string;
  name: string;
  description: string;
  primaryKind: RequirementPrimaryKind;
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

  return {
    chapterNumber: !chapterNumber
      ? "章节号必填"
      : /^\d+(?:\.\d+)*$/.test(chapterNumber)
        ? undefined
        : "章节号格式不正确",
    name: draft.name.trim() ? undefined : "名称必填",
    primaryKind: requirementKindOptions.some((option) => option.value === draft.primaryKind)
      ? undefined
      : "需求类型必填",
    description: draft.description.trim() ? undefined : "需求描述必填",
  };
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
