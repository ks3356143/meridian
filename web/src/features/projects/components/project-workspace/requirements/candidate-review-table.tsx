import { createColumnHelper, useTable } from "@tanstack/react-table";
import { Check, SearchX } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/shared/data-table";
import { TruncatedText } from "@/components/shared/truncated-text";
import { managementTableFeatures } from "@/components/shared/table-features";
import type { SoftwareRequirement } from "@/features/requirements/types";
import { getPrimaryKindMeta } from "./requirement-model";

const features = managementTableFeatures;
const columnHelper = createColumnHelper<typeof features, SoftwareRequirement>();

export function CandidateReviewTable({
  requirements,
  selectedIds,
  onToggle,
  onToggleAll,
  onActivate,
  onConfirm,
}: {
  requirements: SoftwareRequirement[];
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onActivate: (requirement: SoftwareRequirement) => void;
  onConfirm: (ids: string[]) => void;
}) {
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.display({
          id: "select",
          header: () => (
            <Checkbox
              aria-label="选择全部候选需求"
              checked={requirements.length > 0 && selectedIds.length === requirements.length}
              onCheckedChange={(checked) => onToggleAll(Boolean(checked))}
            />
          ),
          cell: (info) => (
            <Checkbox
              aria-label={`选择 ${info.row.original.name}`}
              checked={selectedIds.includes(info.row.original.id)}
              onCheckedChange={(checked) => onToggle(info.row.original.id, Boolean(checked))}
              onClick={(event) => event.stopPropagation()}
            />
          ),
        }),
        columnHelper.accessor("chapterNumber", {
          header: "章节号",
          cell: (info) => (
            <TruncatedText value={info.getValue()} className="font-mono text-xs font-semibold" />
          ),
        }),
        columnHelper.accessor("name", {
          header: "需求名称",
          cell: (info) => <TruncatedText value={info.getValue()} className="font-medium" />,
        }),
        columnHelper.accessor("description", {
          header: "原文与需求描述",
          meta: { hiddenUntil: "lg" },
          cell: (info) => <TruncatedText value={info.getValue()} />,
        }),
        columnHelper.accessor("primaryKind", {
          header: "主性质",
          cell: (info) => {
            const meta = getPrimaryKindMeta(info.getValue());
            return <Badge variant={meta.variant}>{meta.label.replace("需求", "")}</Badge>;
          },
        }),
        columnHelper.accessor("sourceAnchor", {
          header: "原文锚点",
          meta: { hiddenUntil: "xl" },
          cell: (info) => (
            <TruncatedText value={info.getValue() || "待确认"} className="font-mono text-[11px]" />
          ),
        }),
        columnHelper.display({
          id: "action",
          header: "操作",
          cell: (info) => (
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={!selectedIds.includes(info.row.original.id)}
              onClick={(event) => {
                event.stopPropagation();
                onConfirm([info.row.original.id]);
              }}
            >
              <Check data-icon="inline-start" aria-hidden />
              确认
            </Button>
          ),
        }),
      ]),
    [onConfirm, onToggle, onToggleAll, requirements.length, selectedIds],
  );

  const table = useTable({ features, columns, data: requirements });

  return (
    <div className="requirement-candidate-table">
      <DataTable
        table={table}
        leftAlignedColumns={[2, 3]}
        onRowActivate={onActivate}
        emptyContent={
          <div className="flex flex-col items-center gap-2">
            <SearchX className="text-muted-foreground size-5" aria-hidden />
            <p className="text-muted-foreground text-sm">当前没有待确认候选需求</p>
          </div>
        }
      />
    </div>
  );
}
