import { createColumnHelper, useTable, type SortingState } from "@tanstack/react-table";
import { ArchiveRestore, CopyPlus, History, SearchX, Trash2, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/shared/data-table";
import { managementTableFeatures } from "@/components/shared/table-features";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  purgingId,
  purgeError,
  onOpenChange,
  onRestore,
  onCopy,
  onShowAudit,
  onPurge,
}: {
  open: boolean;
  requirements: RequirementRecord[];
  sources: RequirementSource[];
  restoringId: string;
  error: Error | null;
  purgingId: string;
  purgeError: Error | null;
  onOpenChange: (open: boolean) => void;
  onRestore: (requirement: RequirementRecord) => void;
  onCopy: (requirement: RequirementRecord) => void;
  onShowAudit: (requirement: RequirementRecord) => void;
  onPurge: (requirement: RequirementRecord) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "deletedAt", desc: true }]);
  const sourceById = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );
  const columns = useMemo(
    () =>
      columnHelper.columns([
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
        columnHelper.accessor(
          (row) => {
            const source = sourceById.get(row.sourceVersionId);
            return source ? `${requirementSourceLabel(source)}${source.version}` : "来源文档";
          },
          {
            id: "source",
            header: "来源",
            meta: { hiddenUntil: "lg" },
            cell: (info) => <TruncatedText value={info.getValue()} />,
          },
        ),
        columnHelper.accessor((row) => row.deletedReason ?? "", {
          id: "reason",
          header: "删除原因",
          meta: { hiddenUntil: "lg" },
          cell: (info) => <TruncatedText value={info.getValue() || "未填写"} />,
        }),
        columnHelper.accessor((row) => row.deletedAt ?? row.updatedAt, {
          id: "deletedAt",
          header: "删除时间",
          meta: { hiddenUntil: "xl" },
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
            const actionInFlight = restoringId !== "" || purgingId !== "";
            return (
              <div className="flex items-center justify-center gap-1">
                <Button
                  type="button"
                  variant="default"
                  size="xs"
                  disabled={actionInFlight}
                  onClick={() => onRestore(requirement)}
                >
                  <ArchiveRestore data-icon="inline-start" aria-hidden />
                  {restoring ? "恢复中" : "恢复"}
                </Button>
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
              </div>
            );
          },
        }),
      ]),
    [onCopy, onPurge, onRestore, onShowAudit, purgingId, restoringId, sourceById],
  );
  const table = useTable({
    features,
    columns,
    data: requirements,
    state: { sorting },
    onSortingChange: setSorting,
  });
  const actionError = error ?? purgeError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>已删除确认需求</DialogTitle>
          <DialogDescription>
            可恢复回确认基线、复制为一条新需求、查看完整审计轨迹，或在不影响当前基线的情况下彻底删除。
          </DialogDescription>
        </DialogHeader>

        {actionError ? (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden />
            <AlertTitle>操作失败</AlertTitle>
            <AlertDescription>{actionError.message}</AlertDescription>
          </Alert>
        ) : null}

        <DataTable
          table={table}
          leftAlignedColumns={[1]}
          emptyContent={
            <div className="flex flex-col items-center gap-2">
              <SearchX className="text-muted-foreground size-5" aria-hidden />
              <p className="text-muted-foreground text-sm">当前没有已删除的确认需求</p>
            </div>
          }
        />
      </DialogContent>
    </Dialog>
  );
}
