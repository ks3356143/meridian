import type { ReviewChecklistItem } from "@/features/test-items/types";
import { hasRichContent } from "@/lib/rich-content";

export type Draft = {
  id?: string;
  name: string;
  appendix: string;
  condition: string;
  documentType: string;
  documentVersion: string;
  items: ReviewChecklistItem[];
};

export const DOCUMENT_TYPES = ["需求规格说明", "详细设计", "概要设计", "用户手册", "任务书"];

export const EMPTY_ITEM: ReviewChecklistItem = {
  seq: 1,
  category: "",
  title: "",
  requirement: "",
  basis: "",
  goodPractice: "",
  badPractice: "",
};

export function conditionLabel(condition: string) {
  if (condition === "has_ui") return "被测软件有界面";
  return condition || "无条件";
}

export function practiceDone(items: ReviewChecklistItem[]) {
  const configured = items.filter(
    (item) => hasRichContent(item.goodPractice) || hasRichContent(item.badPractice),
  ).length;
  return { configured, total: items.length };
}
