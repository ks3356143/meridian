import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  CircleCheck,
  CircleX,
  MinusCircle,
  Search,
} from "lucide-react";
import { QueryError, QueryLoading } from "@/components/shared/query-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { testItemsApi } from "@/features/test-items/api";
import type { TraceabilityRow } from "@/features/test-items/types";
import styles from "./traceability-view.module.css";

type TraceabilityFilter = "all" | "gaps" | "failed";

type Group = {
  key: string;
  first: TraceabilityRow;
  rows: TraceabilityRow[];
};

type ItemGroup = {
  testItemId: string;
  rows: TraceabilityRow[];
};

type RenderRow = {
  sequence: number;
  row: TraceabilityRow;
  requirementStart: boolean;
  requirementSpan: number;
  itemStart: boolean;
  itemSpan: number;
};

export function TraceabilityView({
  projectCode,
  roundId,
  onOpenTarget,
}: {
  projectCode: string;
  roundId: string;
  onOpenTarget: (roundId: string, testItemId: string, caseId?: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TraceabilityFilter>("all");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const traceQuery = useQuery({
    queryKey: ["projects", projectCode, "traceability", roundId],
    queryFn: () => testItemsApi.traceability(projectCode, roundId),
    staleTime: 15_000,
  });

  const filteredRows = useMemo(() => {
    const rows = traceQuery.data?.rows ?? [];
    return rows.filter((row) => {
      if (filter === "gaps" && row.testItemId !== "" && row.case !== null) return false;
      if (filter === "failed" && row.case?.status !== "failed") return false;
      if (deferredSearch === "") return true;
      return [
        row.sourceName,
        row.sourceVersion,
        row.chapterNumber,
        row.requirementName,
        row.externalIdentifier,
        row.testItemIdentifier,
        row.testItemName,
        row.case?.identifier,
        row.case?.name,
      ]
        .filter(Boolean)
        .join("\n")
        .toLowerCase()
        .includes(deferredSearch);
    });
  }, [deferredSearch, filter, traceQuery.data?.rows]);

  const groups = useMemo(() => {
    const result: Group[] = [];
    const groupMap = new Map<string, Group>();
    for (const row of filteredRows) {
      const key = `${row.roundId}:${row.requirementId}`;
      let group = groupMap.get(key);
      if (!group) {
        group = { key, first: row, rows: [] };
        groupMap.set(key, group);
        result.push(group);
      }
      group.rows.push(row);
    }
    return result;
  }, [filteredRows]);

  if (traceQuery.isPending) {
    return <QueryLoading label="正在汇总需求追溯链" rows={8} />;
  }
  if (traceQuery.isError || !traceQuery.data) {
    return (
      <QueryError
        title="追溯矩阵加载失败"
        description="无法读取需求、测试项、用例与执行结果。"
        onRetry={() => void traceQuery.refetch()}
      />
    );
  }
  const trace = traceQuery.data;
  let sequenceCursor = 0;
  const tableRows = groups.flatMap((group) => {
    const rendered = renderGroup(group, sequenceCursor, onOpenTarget);
    sequenceCursor += group.rows.length;
    return rendered;
  });

  return (
    <div className={styles.view}>
      <section className={styles.summary} aria-label="追溯矩阵摘要">
        <div className={styles.summaryLead}>
          <span className={styles.summaryKicker}>TRACE MATRIX</span>
          <strong>{trace.allRounds ? "全部轮次 · 只读" : trace.round?.name}</strong>
          <small>正式需求 → 测试项 → 用例 → 本轮结果</small>
        </div>
        <Metric label="需求" value={trace.summary.requirements} />
        <Metric label="已关联需求" value={trace.summary.linkedRequirements} tone="success" />
        <Metric
          label="未关联需求"
          value={trace.summary.unlinkedRequirements}
          tone={trace.summary.unlinkedRequirements > 0 ? "danger" : "muted"}
        />
        <Metric label="测试项" value={trace.summary.testItems} />
        <Metric label="用例" value={trace.summary.cases} />
        <Metric label="通过率" value={formatRate(trace.summary.passRate)} />
        <Metric label="未执行" value={trace.summary.pending} />
      </section>

      <section className={styles.notice} aria-label="追溯矩阵数据说明">
        <span>
          <AlertTriangle aria-hidden />
          缺口：未关联需求 {trace.summary.unlinkedRequirements} 条 · 未关联测试项{" "}
          {trace.summary.unlinkedItems} 个 · 隐含需求项 {trace.summary.implicitItems} 个
        </span>
        <span>大纲章节号尚未建模；问题单模块尚未实现。</span>
      </section>

      <section className={styles.toolbar} aria-label="追溯矩阵筛选">
        <div className={styles.searchField}>
          <Search aria-hidden />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索来源、需求、测试项、用例"
            aria-label="搜索追溯矩阵"
          />
        </div>
        <div className={styles.filters}>
          {(
            [
              ["all", "全部"],
              ["gaps", "仅缺口"],
              ["failed", "仅未通过"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="xs"
              variant={filter === value ? "default" : "outline"}
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <span className={styles.resultCount}>显示 {filteredRows.length} 行</span>
      </section>

      {groups.length === 0 ? (
        <div className={styles.empty}>
          <p>没有匹配的追溯记录</p>
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
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>序号</th>
                <th>轮次</th>
                <th>来源文档</th>
                <th>章节号</th>
                <th>需求</th>
                <th>大纲章节号</th>
                <th>测试项</th>
                <th>用例</th>
                <th>本轮结果</th>
                <th>通过率</th>
                <th>问题单</th>
              </tr>
            </thead>
            <tbody>{tableRows}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function renderGroup(
  group: Group,
  sequenceOffset: number,
  onOpenTarget: (roundId: string, testItemId: string, caseId?: string) => void,
) {
  const itemGroups = groupRowsByItem(group.rows);
  const rows: RenderRow[] = [];
  let rowIndex = 0;
  for (const itemGroup of itemGroups) {
    for (let index = 0; index < itemGroup.rows.length; index += 1) {
      rows.push({
        sequence: sequenceOffset + rowIndex + 1,
        row: itemGroup.rows[index],
        requirementStart: rowIndex === 0,
        requirementSpan: group.rows.length,
        itemStart: index === 0,
        itemSpan: itemGroup.rows.length,
      });
      rowIndex += 1;
    }
  }
  return rows.map((rendered) => {
    const row = rendered.row;
    return (
      <tr key={`${group.key}:${rendered.sequence}`} data-gap={row.testItemId === "" || undefined}>
        <td className={styles.sequence}>{rendered.sequence}</td>
        {rendered.requirementStart ? (
          <td rowSpan={rendered.requirementSpan} className={styles.groupCell}>
            <RoundBadge roundNumber={row.roundNumber} name={row.roundName} />
          </td>
        ) : null}
        {rendered.requirementStart ? (
          <>
            <td rowSpan={rendered.requirementSpan} className={styles.sourceCell}>
              <strong>{row.sourceName || "未记录来源文档"}</strong>
              <small>{row.sourceVersion || "版本未记录"}</small>
            </td>
            <td rowSpan={rendered.requirementSpan} className={styles.chapterCell}>
              {row.chapterNumber || "—"}
            </td>
            <td rowSpan={rendered.requirementSpan} className={styles.requirementCell}>
              {row.externalIdentifier ? <code>{row.externalIdentifier}</code> : null}
              <strong>{row.requirementName || "未命名需求"}</strong>
            </td>
            <td
              rowSpan={rendered.requirementSpan}
              className={styles.missingCell}
              aria-label="大纲章节号"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={styles.tooltipTrigger}
                    aria-label="大纲章节号尚未建模"
                  >
                    —
                  </button>
                </TooltipTrigger>
                <TooltipContent>大纲章节号尚未建模</TooltipContent>
              </Tooltip>
            </td>
          </>
        ) : null}
        {rendered.itemStart ? (
          <td rowSpan={rendered.itemSpan} className={styles.itemCell}>
            {row.testItemId ? (
              <>
                <span className={styles.typeChip}>{row.testItemTypeCode}</span>
                <strong>{row.testItemName}</strong>
                <small>{row.testItemIdentifier}</small>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => onOpenTarget(row.roundId, row.testItemId)}
                >
                  定位
                  <ArrowUpRight aria-hidden />
                </Button>
              </>
            ) : (
              <span className={styles.gapText}>未关联测试项</span>
            )}
          </td>
        ) : null}
        <td className={styles.caseCell}>
          {row.case ? (
            <button
              type="button"
              className={styles.caseLink}
              onClick={() => onOpenTarget(row.roundId, row.testItemId, row.case?.caseId)}
            >
              <strong>{row.case.name}</strong>
              <small>{row.case.identifier}</small>
            </button>
          ) : row.testItemId ? (
            <span className={styles.muted}>无用例</span>
          ) : (
            <span className={styles.muted}>—</span>
          )}
        </td>
        <td>
          <CaseStatus status={row.case?.status} />
        </td>
        <td className={styles.rateCell}>{formatRate(row.testItemPassRate)}</td>
        <td className={styles.issueCell} aria-label="问题单">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={styles.tooltipTrigger}
                aria-label="问题单模块尚未实现"
              >
                未接入
              </button>
            </TooltipTrigger>
            <TooltipContent>问题单模块尚未实现</TooltipContent>
          </Tooltip>
        </td>
      </tr>
    );
  });
}

function groupRowsByItem(rows: TraceabilityRow[]): ItemGroup[] {
  const result: ItemGroup[] = [];
  for (const row of rows) {
    const key = row.testItemId || "__missing__";
    let group = result.at(-1);
    if (!group || group.testItemId !== key) {
      group = { testItemId: key, rows: [] };
      result.push(group);
    }
    group.rows.push(row);
  }
  return result;
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <div className={styles.metric} data-tone={tone}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function RoundBadge({ roundNumber, name }: { roundNumber: number; name: string }) {
  return (
    <span className={styles.roundBadge}>
      第 {roundNumber} 轮{name && name !== `第 ${roundNumber} 轮` ? <small>{name}</small> : null}
    </span>
  );
}

function CaseStatus({ status }: { status?: string }) {
  if (!status) return <span className={styles.muted}>—</span>;
  const label = status === "passed" ? "通过" : status === "failed" ? "未通过" : "未执行";
  return (
    <span className={styles.caseStatus} data-status={status}>
      {status === "passed" ? <CircleCheck aria-hidden /> : null}
      {status === "failed" ? <CircleX aria-hidden /> : null}
      {status === "pending" ? <MinusCircle aria-hidden /> : null}
      {label}
    </span>
  );
}

function formatRate(value: number | null) {
  if (value === null) return "—";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}
