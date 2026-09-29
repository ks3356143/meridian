import { createColumnHelper, useTable, type SortingState } from "@tanstack/react-table";
import {
  ArchiveRestore,
  CopyPlus,
  History,
  SearchX,
  Trash2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/shared/data-table";
import { managementTableFeatures } from "@/components/shared/table-features";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { RequirementRecord, RequirementSource } from "@/features/requirements/types";
import { requirementSourceLabel } from "./requirement-form";
import styles from "./deleted-requirements-dialog.module.css";

const features = managementTableFeatures;
const columnHelper = createColumnHelper<typeof features, RequirementRecord>();

export function DeletedRequirementsDialog({
  open,
  requirements,
  sources,
  restoringId,
  error,
  bulkRestoring,
  bulkRestoreError,
  purgingId,
  purgeError,
  bulkPurging,
  bulkPurgeError,
  onOpenChange,
  onRestore,
  onRestoreMany,
  onCopy,
  onShowAudit,
  onPurge,
  onPurgeMany,
}: {
  open: boolean;
  requirements: RequirementRecord[];
  sources: RequirementSource[];
  restoringId: string;
  error: Error | null;
  bulkRestoring: boolean;
  bulkRestoreError: Error | null;
  purgingId: string;
  purgeError: Error | null;
  bulkPurging: boolean;
  bulkPurgeError: Error | null;
  onOpenChange: (open: boolean) => void;
  onRestore: (requirement: RequirementRecord) => void;
  onRestoreMany: (requirements: RequirementRecord[]) => void;
  onCopy: (requirement: RequirementRecord) => void;
  onShowAudit: (requirement: RequirementRecord) => void;
  onPurge: (requirement: RequirementRecord) => void;
  onPurgeMany: (requirements: RequirementRecord[], all: boolean) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "deletedAt", desc: true }]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectableRequirements = useMemo(
    () => requirements.filter((requirement) => requirement.deletedFromStatus === "official"),
    [requirements],
  );
  const selectedRequirements = requirements.filter((requirement) =>
    selectedIds.includes(requirement.id),
  );
  const selectedCandidates = selectedRequirements.filter(
    (requirement) => requirement.deletedFromStatus === "candidate",
  );
  const selectedPurgables = selectedRequirements.filter(
    (requirement) => requirement.deletedFromStatus === "official",
  );
  const allSelected =
    requirements.length > 0 && selectedRequirements.length === requirements.length;
  const someSelected = selectedRequirements.length > 0 && !allSelected;
  const actionInFlight = restoringId !== "" || purgingId !== "" || bulkRestoring || bulkPurging;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setSelectedIds([]);
    onOpenChange(nextOpen);
  };

  const sourceById = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.display({
          id: "select",
          header: () => (
            <Checkbox
              className={styles.rowCheck}
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              aria-label="选择全部回收站记录"
              disabled={actionInFlight || requirements.length === 0}
              onCheckedChange={(checked) =>
                setSelectedIds(checked === true ? requirements.map((item) => item.id) : [])
              }
            />
          ),
          cell: (info) => {
            const requirement = info.row.original;
            return (
              <Checkbox
                className={styles.rowCheck}
                checked={selectedIds.includes(requirement.id)}
                aria-label={`选择回收站记录 ${requirement.name}`}
                disabled={actionInFlight}
                onCheckedChange={(checked) =>
                  setSelectedIds((previous) =>
                    checked === true
                      ? [...new Set([...previous, requirement.id])]
                      : previous.filter((id) => id !== requirement.id),
                  )
                }
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
        columnHelper.accessor("name", {
          header: "需求名称",
          cell: (info) => <TruncatedText value={info.getValue()} className="font-medium" />,
        }),
        columnHelper.display({
          id: "recordType",
          header: "类型",
          cell: (info) => {
            const requirement = info.row.original;
            const candidateExclusion = requirement.deletedFromStatus === "candidate";
            return (
              <Badge variant={candidateExclusion ? "warning" : "danger"}>
                {candidateExclusion ? "候选排除" : "正式删除"}
              </Badge>
            );
          },
        }),
        columnHelper.accessor(
          (row) => {
            const source = sourceById.get(row.sourceVersionId);
            return source ? `${requirementSourceLabel(source)}${source.version}` : "来源文档";
          },
          {
            id: "source",
            header: "来源",
            cell: (info) => <TruncatedText value={info.getValue()} />,
          },
        ),
        columnHelper.accessor((row) => row.deletedReason ?? "", {
          id: "reason",
          header: "删除原因",
          cell: (info) => <TruncatedText value={info.getValue() || "未填写"} />,
        }),
        columnHelper.accessor((row) => row.deletedAt ?? row.updatedAt, {
          id: "deletedAt",
          header: "删除时间",
          cell: (info) => (
            <TruncatedText
              value={new Date(info.getValue()).toLocaleString("zh-CN")}
              className="font-mono text-[11px]"
            />
          ),
        }),
        columnHelper.display({
          id: "actions",
          header: "操作",
          cell: (info) => {
            const requirement = info.row.original;
            const restoring = restoringId === requirement.id;
            const candidateExclusion = requirement.deletedFromStatus === "candidate";
            return (
              <div className={styles.actionGroup}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="default"
                      size="icon-xs"
                      aria-label={
                        restoring
                          ? "处理中"
                          : candidateExclusion
                            ? `撤回排除 ${requirement.name}`
                            : `恢复 ${requirement.name}`
                      }
                      disabled={actionInFlight}
                      onClick={() => onRestore(requirement)}
                    >
                      {candidateExclusion ? <Undo2 aria-hidden /> : <ArchiveRestore aria-hidden />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {candidateExclusion ? "撤回排除" : "恢复确认"}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-xs"
                      className={styles.copyAction}
                      aria-label={`复制新增 ${requirement.name}`}
                      disabled={actionInFlight}
                      onClick={() => onCopy(requirement)}
                    >
                      <CopyPlus aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">复制新增</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-xs"
                      className={styles.historyAction}
                      aria-label={`查看 ${requirement.name} 的审计记录`}
                      disabled={actionInFlight}
                      onClick={() => onShowAudit(requirement)}
                    >
                      <History aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">查看审计</TooltipContent>
                </Tooltip>
                {candidateExclusion ? null : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-xs"
                        className={styles.purgeAction}
                        aria-label={`彻底删除 ${requirement.name}`}
                        disabled={actionInFlight}
                        onClick={() => onPurge(requirement)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">彻底删除</TooltipContent>
                  </Tooltip>
                )}
              </div>
            );
          },
        }),
      ]),
    [
      actionInFlight,
      allSelected,
      onCopy,
      onPurge,
      onRestore,
      onShowAudit,
      requirements,
      restoringId,
      selectedIds,
      someSelected,
      sourceById,
    ],
  );
  const table = useTable({
    features,
    columns,
    data: requirements,
    state: { sorting },
    onSortingChange: setSorting,
  });
  const actionError = error ?? bulkRestoreError ?? purgeError ?? bulkPurgeError;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>需求回收站</DialogTitle>
          <DialogDescription>
            已删除的确认需求可恢复回基线；已排除的待确认需求可撤回回待确认队列。复制新增与审计轨迹在表格内处理，彻底删除仅针对已删除的确认需求。
          </DialogDescription>
        </DialogHeader>

        {requirements.length > 0 ? (
          <div className={styles.toolbar}>
            <span className={styles.selection}>已选 {selectedRequirements.length} 条</span>
            <div className={styles.bulkActions}>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className={styles.restoreAction}
                disabled={actionInFlight || selectedCandidates.length === 0}
                onClick={() => onRestoreMany(selectedCandidates)}
              >
                <Undo2 data-icon="inline-start" aria-hidden />
                批量撤回
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="xs"
                disabled={actionInFlight || selectedPurgables.length === 0}
                onClick={() => onPurgeMany(selectedPurgables, false)}
              >
                <Trash2 data-icon="inline-start" aria-hidden />
                批量删除
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className={styles.deleteAllAction}
                disabled={actionInFlight || selectableRequirements.length === 0}
                onClick={() => onPurgeMany(selectableRequirements, true)}
              >
                <Trash2 data-icon="inline-start" aria-hidden />
                删除全部
              </Button>
            </div>
          </div>
        ) : null}

        {actionError ? (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden />
            <AlertTitle>操作失败</AlertTitle>
            <AlertDescription>{actionError.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className={styles.tableShell}>
          <DataTable
            table={table}
            leftAlignedColumns={[1]}
            emptyContent={
              <div className="flex flex-col items-center gap-2">
                <SearchX className="text-muted-foreground size-5" aria-hidden />
                <p className="text-muted-foreground text-sm">当前没有已删除或已排除的需求</p>
              </div>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
