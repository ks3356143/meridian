import { flexRender, type ReactTable } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { TruncatedText } from "@/components/shared/truncated-text";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dataTableResponsiveClasses, type DataTableRowData } from "./data-table-types";
import type { ManagementTableFeatures } from "./table-features";

export function DataTableHeader<TData extends DataTableRowData>({
  table,
}: {
  table: ReactTable<ManagementTableFeatures, TData>;
}) {
  return (
    <TableHeader>
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id} className="bg-muted/60 border-border hover:bg-muted/60">
          {headerGroup.headers.map((header) => {
            const sorted = header.column.getIsSorted();
            const meta = header.column.columnDef.meta;
            return (
              <TableHead
                key={header.id}
                aria-sort={
                  sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"
                }
                className={cn(
                  "text-foreground border-border h-auto max-w-0 border-r px-3 py-2.5 text-center text-xs font-semibold last:border-r-0",
                  meta?.hiddenUntil && dataTableResponsiveClasses[meta.hiddenUntil],
                )}
              >
                {header.column.getCanSort() ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="h-6 w-full min-w-0 justify-center px-1 text-xs font-semibold"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <TruncatedText
                      value={String(
                        flexRender(header.column.columnDef.header, header.getContext()),
                      )}
                      className="text-left text-xs"
                    />
                    {sorted === "asc" ? (
                      <ArrowUp className="size-3 shrink-0" aria-hidden />
                    ) : sorted === "desc" ? (
                      <ArrowDown className="size-3 shrink-0" aria-hidden />
                    ) : (
                      <ChevronsUpDown className="size-3 shrink-0 opacity-45" aria-hidden />
                    )}
                  </Button>
                ) : (
                  flexRender(header.column.columnDef.header, header.getContext())
                )}
              </TableHead>
            );
          })}
        </TableRow>
      ))}
    </TableHeader>
  );
}
