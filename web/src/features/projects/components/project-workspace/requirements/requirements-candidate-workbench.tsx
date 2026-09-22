import { Ban, CheckCircle2, PencilLine, RefreshCw, Search, SearchX } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { createColumnHelper, useTable, type SortingState } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { TruncatedText } from "@/components/shared/truncated-text";
import { managementTableFeatures } from "@/components/shared/table-features";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  RequirementParseResult,
  RequirementRecord,
  RequirementSource,
  SaveRequirementPayload,
} from "@/features/requirements/types";
import { RequirementCandidateEditDialog } from "./requirement-candidate-edit-dialog";
import { requirementSourceLabel } from "./requirement-form";
import styles from "./requirements-candidate-workbench.module.css";

const features = managementTableFeatures;
const columnHelper = createColumnHelper<typeof features, RequirementRecord>();

type RequirementsCandidateWorkbenchProps = {
  sources: RequirementSource[];
  requirements: RequirementRecord[];
  selectedId: string;
  onSelect: (requirement: RequirementRecord) => void;
  parsePending: boolean;
  statusPending: boolean;
  updatePending: boolean;
  onParse: (sourceVersionId: string) => Promise<RequirementParseResult | undefined>;
  onConfirm: (ids: string[]) => Promise<void>;
  onExclude: (ids: string[], reason: string) => Promise<void>;
  onUpdate: (
    id: string,
    payload: Omit<SaveRequirementPayload, "sourceVersionId">,
  ) => Promise<RequirementRecord | undefined>;
};

export function RequirementsCandidateWorkbench({
  sources,
  requirements,
  selectedId,
  onSelect,
  parsePending,
  statusPending,
  updatePending,
  onParse,
  onConfirm,
  onExclude,
  onUpdate,
}: RequirementsCandidateWorkbenchProps) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: "chapterNumber", desc: false }]);
  const [parseOpen, setParseOpen] = useState(false);
  const [excludeTarget, setExcludeTarget] = useState<{
    ids: string[];
    title: string;
  } | null>(null);
  const [excludeReason, setExcludeReason] = useState("");
  const [editingRequirement, setEditingRequirement] = useState<RequirementRecord | null>(null);
  const deferredQuery = useDeferredValue(query);
  const [parseSourceId, setParseSourceId] = useState("");

  const candidates = useMemo(
    () => requirements.filter((item) => item.origin === "parsed" && item.status === "candidate"),
    [requirements],
  );
  const sourceById = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );
  const parseableSources = useMemo(
    () => sources.filter((source) => source.objectKind === "srs" && source.parseState === "ready"),
    [sources],
  );
  const parseSource =
    parseableSources.find((source) => source.id === parseSourceId) ?? parseableSources[0];

  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const filteredCandidates = useMemo(() => {
    if (!normalizedQuery) return candidates;
    return candidates.filter((requirement) => {
      const source = sourceById.get(requirement.sourceVersionId);
      return [
        requirement.chapterNumber,
        requirement.externalIdentifier,
        requirement.name,
        requirement.description,
        requirement.sourceAnchor,
        source ? requirementSourceLabel(source) : "",
        source?.version ?? "",
      ]
        .join("\n")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [candidates, normalizedQuery, sourceById]);

  const selectedIDSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedCandidates = useMemo(
    () => filteredCandidates.filter((item) => selectedIDSet.has(item.id)),
    [filteredCandidates, selectedIDSet],
  );
  const allSelected =
    filteredCandidates.length > 0 && selectedCandidates.length === filteredCandidates.length;
  const someSelected = selectedCandidates.length > 0 && !allSelected;

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.display({
          id: "selection",
          header: () => (
            <Checkbox
              className={styles.rowCheck}
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              aria-label="选择全部筛选后的待确认需求"
              disabled={statusPending || filteredCandidates.length === 0}
              onCheckedChange={(checked) => {
                setSelectedIds(checked === true ? filteredCandidates.map((item) => item.id) : []);
              }}
            />
          ),
          cell: (info) => {
            const requirement = info.row.original;
            return (
              <Checkbox
                className={styles.rowCheck}
                checked={selectedIDSet.has(requirement.id)}
                aria-label={`选择待确认需求 ${requirement.name}`}
                disabled={statusPending}
                onClick={(event) => event.stopPropagation()}
                onCheckedChange={(checked) => {
                  const id = requirement.id;
                  setSelectedIds((previous) =>
                    checked === true
                      ? [...new Set([...previous, id])]
                      : previous.filter((item) => item !== id),
                  );
                }}
              />
            );
          },
        }),
        columnHelper.accessor("chapterNumber", {
          header: "章节",
          cell: (info) => (
            <TruncatedText value={`§${info.getValue()}`} className="font-mono text-xs" />
          ),
        }),
        columnHelper.accessor("externalIdentifier", {
          header: "标识",
          cell: (info) => <TruncatedText value={info.getValue() || "待确认"} />,
        }),
        columnHelper.accessor("name", {
          header: "名称",
          cell: (info) => <TruncatedText value={info.getValue()} className="font-medium" />,
        }),
        columnHelper.accessor("description", {
          header: "原文描述",
          meta: { hiddenUntil: "lg" },
          enableSorting: false,
          cell: (info) => <TruncatedText value={info.getValue() || "待补描述"} />,
        }),
        columnHelper.accessor(
          (row) => {
            const source = sourceById.get(row.sourceVersionId);
            return source ? `${requirementSourceLabel(source)}${source.version}` : "来源文档";
          },
          {
            id: "source",
            header: "来源",
            meta: { hiddenUntil: "xl" },
            cell: (info) => <TruncatedText value={info.getValue()} />,
          },
        ),
        columnHelper.display({
          id: "actions",
          header: "操作",
          cell: (info) => {
            const requirement = info.row.original;
            return (
              <div className={styles.actionGroup}>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  aria-label={`编辑 ${requirement.name}`}
                  disabled={statusPending || updatePending}
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditingRequirement(requirement);
                  }}
                >
                  <PencilLine aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  className={styles.confirmAction}
                  aria-label={`确认 ${requirement.name}`}
                  disabled={statusPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    void onConfirm([requirement.id]);
                  }}
                >
                  <CheckCircle2 aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  className={styles.excludeAction}
                  aria-label={`排除 ${requirement.name}`}
                  disabled={statusPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    setExcludeReason("");
                    setExcludeTarget({ ids: [requirement.id], title: requirement.name });
                  }}
                >
                  <Ban aria-hidden />
                </Button>
              </div>
            );
          },
        }),
      ]),
    [
      allSelected,
      filteredCandidates,
      onConfirm,
      selectedIDSet,
      someSelected,
      sourceById,
      statusPending,
      updatePending,
    ],
  );

  const table = useTable({
    features,
    columns,
    data: filteredCandidates,
    state: { sorting },
    onSortingChange: setSorting,
  });

  return (
    <section className={styles.shell} aria-label="待确认需求审阅容器">
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2>待确认需求</h2>
          <p>以原文章节为最小需求单元；可修改后确认或排除。</p>
        </div>
        <div className={styles.toolbar}>
          <div className={styles.searchField}>
            <Search className={styles.searchGlyph} aria-hidden />
            <Input
              className={styles.searchInput}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索章节 / 名称 / 描述 / 标识"
              aria-label="搜索待确认需求"
            />
          </div>
          <div className={styles.parseControls}>
            <Select
              value={parseSource?.id ?? ""}
              onValueChange={setParseSourceId}
              disabled={parseableSources.length <= 1 || parsePending}
            >
              <SelectTrigger className={styles.parseSelect} aria-label="选择解析来源">
                <SelectValue placeholder="无可解析 SRS" />
              </SelectTrigger>
              <SelectContent>
                {parseableSources.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    {requirementSourceLabel(source)}
                    {source.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!parseSource || parsePending || statusPending}
              onClick={() => setParseOpen(true)}
            >
              <RefreshCw data-icon="inline-start" aria-hidden />
              解析 SRS
            </Button>
          </div>
        </div>
      </header>

      <div className={styles.selectionBar}>
        <span className={styles.selectionCount}>
          共 {filteredCandidates.length} 条 · 已选 {selectedCandidates.length} 条
        </span>
        <div className={styles.bulkActions}>
          <Button
            type="button"
            size="xs"
            disabled={statusPending || selectedCandidates.length === 0}
            onClick={() => void onConfirm(selectedCandidates.map((item) => item.id))}
          >
            <CheckCircle2 data-icon="inline-start" aria-hidden />
            批量确认
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={statusPending || selectedCandidates.length === 0}
            onClick={() => {
              setExcludeReason("");
              setExcludeTarget({
                ids: selectedCandidates.map((item) => item.id),
                title: `${selectedCandidates.length} 条待确认需求`,
              });
            }}
          >
            <Ban data-icon="inline-start" aria-hidden />
            批量排除
          </Button>
        </div>
      </div>

      <div className={styles.tableShell}>
        <DataTable
          table={table}
          selectedId={selectedId}
          leftAlignedColumns={[1, 2, 3]}
          onRowActivate={(requirement) => onSelect(requirement)}
          emptyContent={
            <div className={styles.empty}>
              <SearchX aria-hidden />
              <p>{normalizedQuery ? "没有匹配的待确认需求" : "暂无待确认需求，可先解析 SRS"}</p>
            </div>
          }
        />
      </div>

      <AlertDialog open={parseOpen} onOpenChange={setParseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>重新解析 SRS？</AlertDialogTitle>
            <AlertDialogDescription>
              将直接替换当前来源的未确认候选章节；已确认、已排除和已替代记录保留不变。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={parsePending}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={parsePending || !parseSource}
              onClick={async (event) => {
                event.preventDefault();
                if (!parseSource) return;
                try {
                  await onParse(parseSource.id);
                  setParseOpen(false);
                } catch {
                  // API 客户端已展示错误，保留确认框供用户重试。
                }
              }}
            >
              <RefreshCw data-icon="inline-start" aria-hidden />
              {parsePending ? "解析中..." : "开始解析"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={excludeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setExcludeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>排除待确认需求？</AlertDialogTitle>
            <AlertDialogDescription>
              将排除 <strong>{excludeTarget?.title ?? ""}</strong>
              。排除结果会保留，后续解析不会重复进入待确认列表。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor="candidate-exclude-reason">排除原因（可选）</FieldLabel>
            <Textarea
              id="candidate-exclude-reason"
              value={excludeReason}
              maxLength={500}
              minRows={3}
              maxRows={6}
              disabled={statusPending}
              onChange={(event) => setExcludeReason(event.target.value)}
            />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={statusPending}
              onClick={async (event) => {
                event.preventDefault();
                if (!excludeTarget) return;
                try {
                  await onExclude(excludeTarget.ids, excludeReason.trim());
                  setExcludeTarget(null);
                } catch {
                  // API 客户端已展示错误，保留确认框供用户重试。
                }
              }}
            >
              <Ban data-icon="inline-start" aria-hidden />
              {statusPending ? "排除中..." : "确认排除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RequirementCandidateEditDialog
        key={editingRequirement?.id ?? "none"}
        requirement={editingRequirement}
        submitting={updatePending}
        onOpenChange={(open) => {
          if (!open) setEditingRequirement(null);
        }}
        onUpdate={onUpdate}
      />
    </section>
  );
}
