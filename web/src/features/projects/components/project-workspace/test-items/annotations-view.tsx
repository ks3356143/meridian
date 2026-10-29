import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Highlighter, Search, StickyNote } from "lucide-react";
import { QueryError, QueryLoading } from "@/components/shared/query-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { testItemsApi } from "@/features/test-items/api";
import type { AnnotationKind, AnnotationRow } from "@/features/test-items/types";
import styles from "./annotations-view.module.css";

type AnnotationFilter = "all" | AnnotationKind;

const FILTERS: Array<{ value: AnnotationFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "requirement_body", label: "需求正文" },
  { value: "step_op", label: "输入及操作" },
  { value: "step_act", label: "实测结果" },
];

const KIND_LABELS: Record<AnnotationKind, string> = {
  requirement_body: "需求正文",
  step_op: "输入及操作",
  step_act: "实测结果",
};

export function AnnotationsView({
  projectCode,
  roundId,
  onOpenRequirement,
  onOpenStep,
}: {
  projectCode: string;
  roundId: string;
  onOpenRequirement: (requirementId: string) => void;
  onOpenStep: (row: AnnotationRow) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AnnotationFilter>("all");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const annotationsQuery = useQuery({
    queryKey: ["projects", projectCode, "annotations", roundId],
    queryFn: () => testItemsApi.annotations(projectCode, roundId),
    staleTime: 15_000,
  });

  const rows = useMemo(() => {
    return (annotationsQuery.data?.rows ?? []).filter((row) => {
      if (filter !== "all" && row.kind !== filter) return false;
      if (deferredSearch === "") return true;
      return [
        row.text,
        row.contextBefore,
        row.contextAfter,
        row.sourceName,
        row.chapterNumber,
        row.externalIdentifier,
        row.requirementName,
        row.testItemIdentifier,
        row.testItemName,
        row.caseIdentifier,
        row.caseName,
      ]
        .filter(Boolean)
        .join("\n")
        .toLowerCase()
        .includes(deferredSearch);
    });
  }, [annotationsQuery.data?.rows, deferredSearch, filter]);

  if (annotationsQuery.isPending) {
    return <QueryLoading label="正在扫描高亮标注" rows={6} />;
  }
  if (annotationsQuery.isError || !annotationsQuery.data) {
    return (
      <QueryError
        title="标注总览加载失败"
        description="无法读取需求正文与用例步骤中的高亮标记。"
        onRetry={() => void annotationsQuery.refetch()}
      />
    );
  }

  const annotations = annotationsQuery.data;
  return (
    <div className={styles.view}>
      <section className={styles.summary} aria-label="标注总览摘要">
        <div className={styles.summaryLead}>
          <span className={styles.summaryKicker}>HIGHLIGHT LEDGER</span>
          <strong>{annotations.allRounds ? "全部轮次 · 只读" : annotations.round?.name}</strong>
          <small>需求正文与用例步骤中的选区高亮</small>
        </div>
        <Metric label="全部标注" value={annotations.summary.total} />
        <Metric label="需求正文" value={annotations.summary.requirementBody} />
        <Metric label="输入及操作" value={annotations.summary.stepOp} />
        <Metric label="实测结果" value={annotations.summary.stepAct} />
        <Metric label="关联需求" value={annotations.summary.requirements} />
        <Metric label="关联用例" value={annotations.summary.cases} />
      </section>

      <section className={styles.notice} aria-label="标注总览说明">
        <span>
          <Highlighter aria-hidden />
          在需求正文或步骤中选中文字后点击高亮，快捷键 Ctrl+Shift+H。
        </span>
        <span>需求正文是项目级内容，切换轮次时不会重复列出。</span>
      </section>

      <section className={styles.toolbar} aria-label="标注总览筛选">
        <div className={styles.searchField}>
          <Search aria-hidden />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索高亮文字、需求、测试项、用例"
            aria-label="搜索标注总览"
          />
        </div>
        <div className={styles.filters}>
          {FILTERS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="xs"
              variant={filter === option.value ? "default" : "outline"}
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <span className={styles.resultCount}>显示 {rows.length} 条</span>
      </section>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <StickyNote aria-hidden />
          <p>没有匹配的高亮标注</p>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => {
              setSearch("");
              setFilter("all");
            }}
          >
            清除筛选
          </Button>
        </div>
      ) : (
        <div className={styles.list}>
          {rows.map((row) => (
            <article key={row.id} className={styles.card} data-kind={row.kind}>
              <div className={styles.cardHeader}>
                <span className={styles.kindBadge}>{KIND_LABELS[row.kind]}</span>
                {row.roundId ? (
                  <span className={styles.roundBadge}>
                    第 {row.roundNumber} 轮
                    {row.roundName && row.roundName !== `第 ${row.roundNumber} 轮` ? (
                      <small>{row.roundName}</small>
                    ) : null}
                  </span>
                ) : (
                  <span className={styles.projectBadge}>项目级</span>
                )}
                <time dateTime={row.updatedAt}>{formatDate(row.updatedAt)}</time>
              </div>

              <blockquote className={styles.excerpt}>
                {row.contextBefore ? <span>{row.contextBefore}</span> : null}
                <mark>{row.text}</mark>
                {row.contextAfter ? <span>{row.contextAfter}</span> : null}
              </blockquote>

              <div className={styles.meta}>
                {row.requirementName ? (
                  <span>
                    <b>需求</b>
                    {row.requirementName}
                    {row.chapterNumber ? <small>{row.chapterNumber}</small> : null}
                  </span>
                ) : null}
                {row.testItemName ? (
                  <span>
                    <b>测试项</b>
                    {row.testItemName}
                    <small>{row.testItemIdentifier}</small>
                  </span>
                ) : null}
                {row.caseName ? (
                  <span>
                    <b>用例</b>
                    {row.caseName}
                    <small>
                      {row.caseIdentifier} · 第 {row.stepSeq} 步
                    </small>
                  </span>
                ) : null}
              </div>

              <Button
                type="button"
                size="xs"
                variant="outline"
                className={styles.locateButton}
                onClick={() => {
                  if (row.kind === "requirement_body") onOpenRequirement(row.requirementId);
                  else onOpenStep(row);
                }}
              >
                定位
                <ArrowUpRight aria-hidden />
              </Button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.metric}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
