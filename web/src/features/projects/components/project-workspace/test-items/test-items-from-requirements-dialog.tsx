import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  FileSearch,
  Link2,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type {
  BatchCreateTestItemsResult,
  RequirementTestItemCandidate,
} from "@/features/test-items/types";
import { testItemsApi } from "@/features/test-items/api";
import styles from "./test-items-from-requirements-dialog.module.css";

type CandidateFilter = "creatable" | "linked" | "incomplete" | "all";

const KIND_LABELS: Record<string, string> = {
  functional: "功能",
  interface: "接口",
  performance: "性能",
  safety: "安全",
  reliability: "可靠",
  other: "其他",
};

const OUTCOME_LABELS: Record<string, string> = {
  created: "已创建",
  skipped_existing: "已有关联",
  skipped_incomplete: "待补描述",
  skipped_not_official: "非正式需求",
  failed: "失败",
};

function resultTone(outcome: string) {
  if (outcome === "created") return "success";
  if (outcome === "failed") return "danger";
  return "muted";
}

export function TestItemsFromRequirementsDialog({
  open,
  projectCode,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  projectCode: string;
  onOpenChange: (open: boolean) => void;
  onCreated: (result: BatchCreateTestItemsResult) => void;
}) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<CandidateFilter>("creatable");
  const [queryText, setQueryText] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<BatchCreateTestItemsResult | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const deferredQuery = useDeferredValue(queryText.trim().toLowerCase());

  const previewQuery = useQuery({
    queryKey: ["projects", projectCode, "test-items", "from-requirements-preview"],
    queryFn: () => testItemsApi.requirementCreatePreview(projectCode),
    enabled: open,
    staleTime: 15_000,
  });
  const createMutation = useMutation({
    mutationFn: (requirementIds: string[]) =>
      testItemsApi.createFromRequirements(projectCode, { requirementIds }),
    onSuccess: (created) => {
      setResult(created);
      setSelected(new Set());
      void queryClient.invalidateQueries({
        queryKey: ["projects", projectCode, "test-items", "from-requirements-preview"],
      });
      onCreated(created);
      const skipped = created.skipped > 0 ? `，跳过 ${created.skipped} 个` : "";
      if (created.failed > 0)
        toast.warning(`已创建 ${created.created} 个测试项${skipped}，失败 ${created.failed} 个`);
      else if (created.created > 0) toast.success(`已创建 ${created.created} 个测试项${skipped}`);
      else toast.info("没有新建测试项，请查看逐条结果");
    },
  });

  const preview = previewQuery.data;
  const requirements = preview?.requirements;
  const visibleRequirements = useMemo(() => {
    return (requirements ?? []).filter((item) => {
      if (filter === "creatable" && !item.canCreate) return false;
      if (filter === "linked" && item.linkedTestItemCount === 0) return false;
      if (filter === "incomplete" && (item.hasDescription || item.linkedTestItemCount > 0))
        return false;
      if (deferredQuery === "") return true;
      return `${item.chapterNumber}\n${item.name}\n${item.primaryKind}`
        .toLowerCase()
        .includes(deferredQuery);
    });
  }, [deferredQuery, filter, requirements]);
  const visibleCreatable = visibleRequirements.filter((item) => item.canCreate);
  // TanStack Virtual 的返回值天然不可 memo；只在本弹窗内使用，按官方 Hook 用法处理。
  // oxlint-disable-next-line react/incompatible-library
  const candidateVirtualizer = useVirtualizer({
    count: visibleRequirements.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 38,
    overscan: 8,
  });
  const allVisibleSelected =
    visibleCreatable.length > 0 &&
    visibleCreatable.every((item) => selected.has(item.requirementId));
  const progress =
    preview && preview.total > 0 ? Math.round((preview.creatable / preview.total) * 100) : 0;

  const toggleSelected = (item: RequirementTestItemCandidate, checked: boolean) => {
    if (!item.canCreate) return;
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(item.requirementId);
      else next.delete(item.requirementId);
      return next;
    });
  };
  const toggleAllVisible = (checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      for (const item of visibleCreatable) {
        if (checked) next.add(item.requirementId);
        else next.delete(item.requirementId);
      }
      return next;
    });
  };
  const changeFilter = (nextFilter: CandidateFilter) => {
    setFilter(nextFilter);
    if (listRef.current) listRef.current.scrollTop = 0;
  };
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && createMutation.isPending) return;
    if (!nextOpen) {
      setResult(null);
      setSelected(new Set());
      setQueryText("");
      setFilter("creatable");
      createMutation.reset();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={styles.dialog}
        aria-busy={previewQuery.isFetching || createMutation.isPending}
      >
        <DialogHeader className={styles.header}>
          <div className={styles.titleIcon} aria-hidden>
            <Sparkles />
          </div>
          <div>
            <DialogTitle>{result ? "测试项创建结果" : "从需求创建测试项"}</DialogTitle>
            <DialogDescription>
              {result
                ? "服务端按需求逐条创建并关联；已关联和待补描述需求不会重复写入。"
                : "按需求主类型映射测试项类型。默认只显示可创建项，选择后一次性创建并关联。"}
            </DialogDescription>
          </div>
        </DialogHeader>

        {result ? (
          <div className={styles.resultWrap} aria-live="polite">
            <div className={styles.resultSummary}>
              <div className={styles.resultMetric} data-tone="success">
                <span>创建</span>
                <strong>{result.created}</strong>
              </div>
              <div className={styles.resultMetric} data-tone="warning">
                <span>跳过</span>
                <strong>{result.skipped}</strong>
              </div>
              <div
                className={styles.resultMetric}
                data-tone={result.failed > 0 ? "danger" : "muted"}
              >
                <span>失败</span>
                <strong>{result.failed}</strong>
              </div>
              <div className={styles.resultMetric}>
                <span>检查</span>
                <strong>{result.total}</strong>
              </div>
            </div>
            <div className={styles.resultList} role="list" aria-label="测试项创建结果">
              {result.items.map((item) => (
                <div
                  className={styles.resultRow}
                  key={item.requirementId}
                  data-tone={resultTone(item.outcome)}
                  role="listitem"
                >
                  <span className={styles.resultState} data-tone={resultTone(item.outcome)}>
                    {item.outcome === "created" ? (
                      <CheckCircle2 aria-hidden />
                    ) : item.outcome === "failed" ? (
                      <AlertTriangle aria-hidden />
                    ) : (
                      <Link2 aria-hidden />
                    )}
                    {OUTCOME_LABELS[item.outcome] ?? item.outcome}
                  </span>
                  <span className={styles.resultName}>
                    §{item.chapterNumber} {item.name}
                  </span>
                  <span className={styles.resultIdentifier}>
                    {item.testItemIdentifier || item.message || "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : previewQuery.isPending ? (
          <div className={styles.state}>
            <Loader2 className={styles.spin} aria-hidden />
            正在读取已确认需求
          </div>
        ) : previewQuery.isError || !preview ? (
          <div className={styles.state} data-tone="danger">
            <AlertTriangle aria-hidden />
            <span>需求候选加载失败</span>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => void previewQuery.refetch()}
            >
              重试
            </Button>
          </div>
        ) : (
          <>
            <div className={styles.summaryBand}>
              <div className={styles.summaryCopy}>
                <strong>{preview.creatable}</strong>
                <span>条可立即创建</span>
              </div>
              <div className={styles.summaryProgress}>
                <Progress value={progress} />
                <span>
                  {preview.linked} 条已关联 · {preview.incomplete} 条待补描述
                </span>
              </div>
            </div>
            <div className={styles.toolbar}>
              <div className={styles.filters}>
                {(
                  [
                    ["creatable", `可创建 ${preview.creatable}`],
                    ["linked", `已关联 ${preview.linked}`],
                    ["incomplete", `待补描述 ${preview.incomplete}`],
                    ["all", `全部 ${preview.total}`],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="xs"
                    variant="outline"
                    data-active={filter === value ? "true" : undefined}
                    aria-pressed={filter === value}
                    onClick={() => changeFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className={styles.searchField}>
                <Search aria-hidden />
                <Input
                  value={queryText}
                  placeholder="筛选章节或名称"
                  aria-label="筛选需求"
                  onChange={(event) => setQueryText(event.target.value)}
                />
              </div>
            </div>
            <div className={styles.listHeader}>
              <Checkbox
                checked={allVisibleSelected}
                aria-label="全选当前可创建需求"
                onCheckedChange={(checked) => toggleAllVisible(checked === true)}
              />
              <span>{allVisibleSelected ? "取消全选" : "全选当前结果"}</span>
              <span className={styles.selectionCount}>已选 {selected.size} 条</span>
            </div>
            <div ref={listRef} className={styles.list} role="list" aria-label="需求创建候选列表">
              {visibleRequirements.length === 0 ? (
                <div className={styles.empty}>
                  <FileSearch aria-hidden />
                  当前筛选下没有需求
                </div>
              ) : (
                <div
                  className={styles.virtualList}
                  style={{ height: `${candidateVirtualizer.getTotalSize()}px` }}
                >
                  {candidateVirtualizer.getVirtualItems().map((virtualRow) => {
                    const item = visibleRequirements[virtualRow.index];
                    const checked = selected.has(item.requirementId);
                    return (
                      <div
                        key={item.requirementId}
                        className={styles.virtualRow}
                        style={{
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        role="listitem"
                        aria-posinset={virtualRow.index + 1}
                        aria-setsize={visibleRequirements.length}
                      >
                        <label
                          className={styles.row}
                          data-selected={checked ? "true" : undefined}
                          data-disabled={!item.canCreate ? "true" : undefined}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={!item.canCreate}
                            aria-label={`选择 §${item.chapterNumber} ${item.name}`}
                            onCheckedChange={(next) => toggleSelected(item, next === true)}
                          />
                          <span className={styles.chapter}>§{item.chapterNumber}</span>
                          <span className={styles.name}>{item.name}</span>
                          <Badge variant="outline" className={styles.kind}>
                            {KIND_LABELS[item.primaryKind] ?? item.primaryKind}
                          </Badge>
                          <span className={styles.typeCode}>{item.mappedTypeCode}</span>
                          <span
                            className={styles.rowState}
                            data-tone={
                              item.canCreate
                                ? "success"
                                : item.linkedTestItemCount > 0
                                  ? "info"
                                  : "warning"
                            }
                          >
                            {item.canCreate ? (
                              <>
                                <Check aria-hidden />
                                可创建
                              </>
                            ) : (
                              item.blockReason
                            )}
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {createMutation.error ? (
          <div className={styles.error} role="alert">
            批量创建失败：{createMutation.error.message}
          </div>
        ) : null}

        <DialogFooter>
          {result ? (
            <Button type="button" onClick={() => handleOpenChange(false)}>
              完成
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={createMutation.isPending}
              >
                取消
              </Button>
              <Button
                type="button"
                disabled={selected.size === 0 || createMutation.isPending}
                onClick={() => createMutation.mutate([...selected])}
              >
                {createMutation.isPending ? (
                  <Loader2 className={styles.spin} aria-hidden />
                ) : (
                  <Sparkles aria-hidden />
                )}
                {createMutation.isPending ? "创建中…" : `创建并关联 ${selected.size} 项`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
