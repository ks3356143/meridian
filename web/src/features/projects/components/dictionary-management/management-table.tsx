import { BookMarked, Building2, FileCog, Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { RowData } from "@tanstack/table-core";
import type { ReactTable } from "@tanstack/react-table";
import { cn } from "cn";
import { DataTable } from "@/components/shared/data-table";
import type { ManagementTableFeatures } from "@/components/shared/table-features";

export type ManagementTone = "primary" | "warning" | "info";

const toneStyles: Record<ManagementTone, { bar: string; icon: string }> = {
  primary: {
    bar: "bg-primary",
    icon: "border-primary/35 bg-primary/12 text-primary",
  },
  warning: {
    bar: "bg-warning",
    icon: "border-warning/40 bg-warning/14 text-warning",
  },
  info: {
    bar: "bg-info",
    icon: "border-info/35 bg-info/12 text-info",
  },
};

export function ManagementTable<TData extends RowData & { id: string }>({
  table,
  selectedId,
  leftAlignedColumns = [],
}: {
  table: ReactTable<ManagementTableFeatures, TData>;
  selectedId?: string;
  leftAlignedColumns?: number[];
}) {
  return (
    <DataTable
      table={table}
      selectedId={selectedId}
      leftAlignedColumns={leftAlignedColumns}
      emptyContent={
        <div className="flex flex-col items-center gap-2">
          <Inbox className="text-muted-foreground size-5" aria-hidden />
          <p className="text-muted-foreground text-sm">暂无字典数据</p>
        </div>
      }
    />
  );
}

export function ManagementSection({
  title,
  total,
  enabledCount,
  action,
  children,
}: {
  title: string;
  total: number;
  enabledCount: number;
  action: ReactNode;
  children: ReactNode;
}) {
  const inferred = inferManagementAppearance(title);
  const toneStyle = toneStyles[inferred.tone];

  return (
    <section className="panel-surface border-border relative overflow-hidden rounded-sm border">
      <span className={cn("absolute inset-y-0 left-0 w-[4px]", toneStyle.bar)} aria-hidden />
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 pl-6">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-sm border",
              toneStyle.icon,
            )}
          >
            <inferred.icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              共 {total} 项，启用 {enabledCount} 项
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      </div>
      {children}
    </section>
  );
}

function inferManagementAppearance(title: string): {
  icon: LucideIcon;
  tone: ManagementTone;
} {
  if (title.includes("依据")) return { icon: FileCog, tone: "warning" };
  if (title.includes("相关方")) return { icon: Building2, tone: "info" };
  return { icon: BookMarked, tone: "primary" };
}
