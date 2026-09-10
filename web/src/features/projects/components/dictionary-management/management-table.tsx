import { flexRender } from "@tanstack/react-table";
import type { ReactTable } from "@tanstack/react-table";
import type { RowData } from "@tanstack/table-core";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ManagementTableFeatures } from "./table-features";

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
    <Table className="w-full border-collapse text-left text-[13px]">
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id} className="bg-muted/60 border-border hover:bg-muted/60">
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                className="text-muted-foreground border-border h-auto border-r px-3 py-2.5 text-center text-xs last:border-r-0"
              >
                {header.column.getCanSort() ? (
                  <Button asChild variant="ghost" size="xs" className="h-auto px-0 text-xs">
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-1"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" ? " ↑" : null}
                      {header.column.getIsSorted() === "desc" ? " ↓" : null}
                    </button>
                  </Button>
                ) : (
                  flexRender(header.column.columnDef.header, header.getContext())
                )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            className={`border-border transition-[background-color,box-shadow] hover:bg-primary/5 ${
              selectedId === row.original.id ? "bg-primary/8" : ""
            }`}
          >
            {row.getAllCells().map((cell, index) => (
              <TableCell
                key={cell.id}
                className={`border-border border-r px-3 py-2.5 last:border-r-0 ${
                  leftAlignedColumns.includes(index) ? "text-left" : "text-center"
                }`}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
  return (
    <section className="panel-surface border-border overflow-hidden rounded-sm border">
      <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-muted-foreground text-xs">
            共 {total} 项，启用 {enabledCount} 项
          </p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
