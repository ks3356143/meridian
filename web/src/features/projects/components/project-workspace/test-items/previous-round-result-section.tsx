import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, History } from "lucide-react";
import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { testItemsApi } from "@/features/test-items/api";
import type { PreviousRoundStep } from "@/features/test-items/types";
import { RequirementBlocks } from "../requirements/body/requirement-body";
import { caseStatusLabel } from "./test-items-design";
import styles from "./previous-round-result-section.module.css";

export function PreviousRoundResultSection({
  caseId,
  projectCode,
}: {
  caseId: string;
  projectCode: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const resultQuery = useQuery({
    queryKey: ["test-cases", caseId, "previous-round-result"],
    queryFn: () => testItemsApi.previousRoundResult(caseId),
    enabled: expanded,
    staleTime: 30_000,
  });
  if (expanded && resultQuery.error instanceof ApiError && resultQuery.error.status === 404) {
    return null;
  }
  const result = resultQuery.data;
  const status = result?.previousCase.status ?? "pending";

  return (
    <section className={styles.section} data-expanded={expanded || undefined}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className={styles.glyph} aria-hidden>
          <History />
        </span>
        <span className={styles.title}>
          <strong>上轮实测</strong>
          <small>
            {expanded && result
              ? `${result.previousRound.name} · ${caseStatusLabel(status)}`
              : "默认折叠，展开后读取只读记录"}
          </small>
        </span>
        {result ? (
          <span className={styles.summary} data-status={status}>
            {result.testerName || "未记录测试人员"}
          </span>
        ) : null}
        <ChevronDown className={styles.chevron} aria-hidden />
      </button>

      {expanded ? (
        <div className={styles.body} aria-busy={resultQuery.isPending || undefined}>
          {resultQuery.isPending ? (
            <div className={styles.state}>正在读取上轮实测…</div>
          ) : resultQuery.isError ? (
            <div className={styles.error}>
              <span>上轮实测读取失败。</span>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => resultQuery.refetch()}
              >
                重试
              </Button>
            </div>
          ) : result ? (
            <>
              <div className={styles.meta}>
                <span className={styles.statusChip} data-status={result.previousCase.status}>
                  {caseStatusLabel(result.previousCase.status)}
                </span>
                <span>执行日期：{formatDate(result.previousCase.execDate)}</span>
                <span>测试人员：{result.testerName || "未记录"}</span>
              </div>
              {result.steps.length === 0 ? (
                <div className={styles.state}>上轮用例没有步骤记录。</div>
              ) : (
                <div className={styles.steps}>
                  {result.steps.map((step, index) => (
                    <PreviousStepCard
                      key={`${step.currentStepId ?? "previous"}-${step.previousStep.id || index}`}
                      step={step}
                      projectCode={projectCode}
                    />
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function PreviousStepCard({ step, projectCode }: { step: PreviousRoundStep; projectCode: string }) {
  const previous = step.previousStep;
  const changeLabel =
    step.change === "added" ? "本轮新增" : step.change === "removed" ? "本轮已删除" : "同一步骤";
  return (
    <article className={styles.stepCard} data-change={step.change} data-passed={previous.passed}>
      <header className={styles.stepHeader}>
        <span className={styles.stepSeq}>第 {previous.seq} 步</span>
        <span className={styles.changeChip}>{changeLabel}</span>
        <span className={styles.passChip} data-status={stepPassStatus(previous.passed)}>
          {stepPassLabel(previous.passed)}
        </span>
      </header>
      <div className={styles.expect}>
        <span>预期</span>
        <p>{previous.expectText || "未填写"}</p>
      </div>
      <div className={styles.act}>
        <span>实测结果</span>
        {step.change === "added" ? (
          <p className={styles.muted}>本轮新增步骤，没有上轮实测。</p>
        ) : previous.act.hasContent && previous.act.doc ? (
          <RequirementBlocks doc={previous.act.doc} projectCode={projectCode} />
        ) : (
          <p className={styles.muted}>上轮未记录实测内容。</p>
        )}
      </div>
    </article>
  );
}

function formatDate(value: string | null) {
  if (!value) return "未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function stepPassStatus(value: string) {
  return value === "pass" ? "passed" : value === "fail" ? "failed" : "pending";
}

function stepPassLabel(value: string) {
  return caseStatusLabel(stepPassStatus(value));
}
