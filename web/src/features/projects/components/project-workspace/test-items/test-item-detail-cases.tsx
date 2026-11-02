import { memo, useMemo, useState } from "react";
import { CopyPlus, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { EmptyHint } from "@/components/shared/empty-hint";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BatchAssignCasesPayload } from "@/features/test-items/api";
import type { TestCaseStatus, TestItemDetail } from "@/features/test-items/types";
import type { ProjectMember } from "../../../types";
import { CaseBatchBar } from "./case-batch-bar";
import { caseStatusLabel } from "./test-items-design";
import { SECTION_CASES, SECTION_METHOD } from "./test-item-detail-config";
import styles from "./test-item-detail.module.css";

type CaseFilter = "all" | TestCaseStatus;

const CASE_FILTERS: { value: CaseFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "pending", label: "待执行" },
  { value: "passed", label: "已通过" },
  { value: "failed", label: "未通过" },
];

function TestItemCasesSectionImpl({
  detail,
  members,
  tone,
  activeCaseId,
  onSelectCase,
  onDuplicateCase,
  onBatchAssign,
  jumpTo,
}: {
  detail: TestItemDetail;
  members: ProjectMember[];
  tone: string;
  activeCaseId?: string;
  onSelectCase?: (caseId: string) => void;
  onDuplicateCase?: (caseId: string) => void;
  onBatchAssign?: (
    caseIds: string[],
    payload: Omit<BatchAssignCasesPayload, "caseIds">,
  ) => Promise<unknown>;
  jumpTo: (id: string) => void;
}) {
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [batchPending, setBatchPending] = useState(false);
  const [caseFilter, setCaseFilter] = useState<CaseFilter>("all");
  const { passedCount, failedCount, pendingCount, passRate } = useMemo(() => {
    let passed = 0;
    let failed = 0;
    for (const record of detail.cases) {
      if (record.status === "passed") passed += 1;
      else if (record.status === "failed") failed += 1;
    }
    const total = detail.cases.length;
    return {
      passedCount: passed,
      failedCount: failed,
      pendingCount: total - passed - failed,
      passRate: total === 0 ? 0 : Math.round((passed / total) * 100),
    };
  }, [detail.cases]);
  const selectedCaseSet = useMemo(() => new Set(selectedCaseIds), [selectedCaseIds]);
  const visibleCases = useMemo(
    () =>
      caseFilter === "all"
        ? detail.cases
        : detail.cases.filter((record) => record.status === caseFilter),
    [caseFilter, detail.cases],
  );
  const allCasesSelected =
    visibleCases.length > 0 && visibleCases.every((record) => selectedCaseSet.has(record.id));
  const someCasesSelected = selectedCaseIds.length > 0 && !allCasesSelected;
  const toggleAllCases = (checked: boolean | "indeterminate") => {
    setSelectedCaseIds(checked === true ? visibleCases.map((record) => record.id) : []);
  };
  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, member.displayName])),
    [members],
  );
  const toggleCase = (caseId: string, checked: boolean | "indeterminate") => {
    setSelectedCaseIds((current) =>
      checked === true ? [...new Set([...current, caseId])] : current.filter((id) => id !== caseId),
    );
  };
  const applyBatchAssign = async (payload: Omit<BatchAssignCasesPayload, "caseIds">) => {
    if (!onBatchAssign || selectedCaseIds.length === 0) return;
    setBatchPending(true);
    try {
      await onBatchAssign(selectedCaseIds, payload);
      setSelectedCaseIds([]);
    } finally {
      setBatchPending(false);
    }
  };

  return (
    <section id={SECTION_CASES} className={styles.caseCard}>
      <header className={styles.caseHeader}>
        <h3 className={styles.caseTitle}>
          <span className={styles.titleBar} data-tone={tone} aria-hidden />
          用例概况（{detail.cases.length}）
        </h3>
        <div className={styles.caseRate}>
          <span className={styles.caseRateValue} data-tone={passRate >= 100 ? "green" : undefined}>
            通过率 {passRate}%
          </span>
          <Progress
            value={passRate}
            className={styles.caseProgress}
            data-tone={passRate === 0 ? "empty" : passRate >= 100 ? "full" : "part"}
          />
          <span className={styles.caseRateDetail}>
            <span className={styles.rateItem} data-tone="passed">
              通过 {passedCount}
            </span>
            <span className={styles.rateItem} data-tone="failed">
              未通过 {failedCount}
            </span>
            <span className={styles.rateItem} data-tone="pending">
              未执行 {pendingCount}
            </span>
          </span>
        </div>
      </header>
      {detail.cases.length === 0 ? (
        <EmptyHint
          tone="info"
          action={
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => jumpTo(SECTION_METHOD)}
            >
              去填写测试方法
            </Button>
          }
        >
          尚无用例；到上方「测试方法」子项卡片点「生成用例」即可 1:1 生成。
        </EmptyHint>
      ) : (
        <>
          <div className={styles.caseFilters} role="group" aria-label="按用例状态筛选">
            {CASE_FILTERS.map((filter) => {
              const count =
                filter.value === "all"
                  ? detail.cases.length
                  : filter.value === "passed"
                    ? passedCount
                    : filter.value === "failed"
                      ? failedCount
                      : pendingCount;
              return (
                <button
                  key={filter.value}
                  type="button"
                  className={styles.caseFilterChip}
                  data-active={caseFilter === filter.value ? "true" : undefined}
                  aria-pressed={caseFilter === filter.value}
                  onClick={() => setCaseFilter(filter.value)}
                >
                  {filter.label}
                  <span className={styles.caseFilterCount}>{count}</span>
                </button>
              );
            })}
          </div>{" "}
          <CaseBatchBar
            selectedCount={selectedCaseIds.length}
            members={members}
            pending={batchPending}
            onApply={applyBatchAssign}
            onClearSelection={() => setSelectedCaseIds([])}
          />
          <div className={styles.caseTableScroll}>
            <table className={styles.caseTable}>
              <thead>
                <tr>
                  <th scope="col" className={styles.caseSelectHead}>
                    <Checkbox
                      checked={
                        allCasesSelected ? true : someCasesSelected ? "indeterminate" : false
                      }
                      aria-label="全选用例"
                      onCheckedChange={toggleAllCases}
                    />
                  </th>
                  <th scope="col">用例标识</th>
                  <th scope="col">用例名称</th>
                  <th scope="col">负责人</th>
                  <th scope="col">状态</th>
                  <th scope="col">
                    <span className={styles.visuallyHidden}>操作</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleCases.map((record) => (
                  <tr
                    key={record.id}
                    data-status={record.status}
                    data-active={record.id === activeCaseId ? "true" : undefined}
                  >
                    <td className={styles.caseSelectCell}>
                      <Checkbox
                        checked={selectedCaseSet.has(record.id)}
                        aria-label={`选择 ${record.identifier}`}
                        onCheckedChange={(checked) => toggleCase(record.id, checked)}
                      />
                    </td>
                    <td className={styles.caseIdent}>{record.identifier}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.caseRowName}
                        onClick={() => onSelectCase?.(record.id)}
                      >
                        {record.name}
                      </button>
                    </td>
                    <td className={styles.caseOwner}>
                      {memberNames.get(record.testerId ?? record.designerId ?? "") ?? "未指派"}
                    </td>
                    <td>
                      <span className={styles.caseStatus} data-status={record.status}>
                        {caseStatusLabel(record.status)}
                      </span>
                    </td>
                    <td className={styles.caseRowActions} aria-label="用例操作">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className={styles.caseRowAction}
                            aria-label={`在目录中定位 ${record.identifier}`}
                            onClick={() => onSelectCase?.(record.id)}
                          >
                            <Crosshair aria-hidden />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">在左侧目录中定位</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className={styles.caseRowAction}
                            aria-label={`复制 ${record.identifier}`}
                            onClick={() => onDuplicateCase?.(record.id)}
                          >
                            <CopyPlus aria-hidden />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">复制用例（含步骤）</TooltipContent>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
                {visibleCases.length === 0 ? (
                  <tr>
                    <td className={styles.caseEmptyRow} colSpan={6}>
                      该状态下没有用例，切换筛选或到「测试方法」生成用例。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export const TestItemCasesSection = memo(TestItemCasesSectionImpl);
