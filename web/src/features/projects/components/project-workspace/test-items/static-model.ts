import type { StaticReviewCheck, StaticState } from "@/features/test-items/types";

export function uid() {
  return crypto.randomUUID();
}

export function reviewStats(checks: StaticReviewCheck[]) {
  const reviewed = checks.filter((check) => check.result !== "unreviewed").length;
  const passed = checks.filter((check) => check.result === "passed").length;
  return {
    reviewed,
    total: checks.length,
    passed,
    rate: checks.length === 0 ? 0 : Math.round((passed / checks.length) * 100),
  };
}

export type StaticUpdater = (recipe: (state: StaticState) => void) => void;
