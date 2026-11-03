import type { StaticReviewCheck } from "@/features/test-items/types";
import { hasRichContent } from "@/lib/rich-content";

export const RESULT_LABEL: Record<string, string> = {
  passed: "通过",
  failed: "不通过",
  na: "不适用",
  unreviewed: "未审",
};

export function nextResult(result: string): StaticReviewCheck["result"] {
  if (result === "failed") return "na";
  if (result === "na") return "passed";
  return "failed";
}

export function practiceTone(check: StaticReviewCheck) {
  const good = hasRichContent(check.goodPractice);
  const bad = hasRichContent(check.badPractice);
  if (good && bad) return "both";
  if (good) return "good";
  if (bad) return "bad";
  return "empty";
}

export function isCompletenessSheet(templateCode: string) {
  // 旧数据用 DC-KIT，新模板用 rc-1。
  return templateCode === "rc-1" || templateCode === "DC-KIT";
}

export function checkStats(checks: StaticReviewCheck[]) {
  const pass = checks.filter((check) => check.result === "passed").length;
  const fail = checks.filter((check) => check.result === "failed").length;
  const na = checks.filter((check) => check.result === "na").length;
  const total = checks.length;
  return {
    pass,
    fail,
    na,
    total,
    reviewed: pass + fail + na,
    rate: total ? Math.round((pass / total) * 100) : 0,
  };
}
