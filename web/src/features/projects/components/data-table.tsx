import { flexRender, type ReactTable } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { RowData } from "@tanstack/table-core";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ManagementTableFeatures } from "./dictionary-management/table-features";

export type ResponsiveBreakpoint = "lg" | "xl" | "wide";

const responsiveHiddenClasses = {
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
  wide: "hidden min-[1600px]:table-cell",
} as const;

type DataTableMeta = { hiddenUntil?: ResponsiveBreakpoint };

export interface DataTableProps<TData extends RowData & { id: string }> {
  table: ReactTable<ManagementTableFeatures, TData>;
  selectedId?: string;
  leftAlignedColumns?: number[];
  emptyContent?: ReactNode;
  onRowActivate?: (row: TData) => void;
  rowClassName?: string;
}

export function DataTable<TData extends RowData & { id: string }>({
  table,
  selectedId,
  leftAlignedColumns = [],
  emptyContent,
  onRowActivate,
  rowClassName,
}: DataTableProps<TData>) {
  const columnCount = table.getAllLeafColumns().length;
  const rows = table.getRowModel().rows;

  return (
    <div className="border-border bg-card overflow-x-auto">
      <Table className="w-full table-fixed border-collapse text-left text-[13px]">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-muted/60 border-border hover:bg-muted/60">
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const meta = header.column.columnDef.meta as DataTableMeta | undefined;
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"
                    }
                    className={cn(
                      "text-muted-foreground border-border h-auto max-w-0 border-r px-3 py-2.5 text-center text-xs last:border-r-0",
                      meta?.hiddenUntil && responsiveHiddenClasses[meta.hiddenUntil],
                    )}
                  >
                    {header.column.getCanSort() ? (
                      <Button
                        asChild
                        variant="ghost"
                        size="xs"
                        className="hover:text-primary h-auto min-w-0 justify-center px-0 text-xs"
                      >
                        <button
                          type="button"
                          className="flex w-full min-w-0 items-center justify-center gap-1"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <span className="truncate">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3 shrink-0" aria-hidden />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3 shrink-0" aria-hidden />
                          ) : (
                            <ChevronsUpDown className="size-3 shrink-0 opacity-45" aria-hidden />
                          )}
                        </button>
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
        <TableBody>
          {rows.map((row) => {
            const rowProps = onRowActivate
              ? getActivatableRowProps(() => onRowActivate(row.original))
              : {};
            return (
              <TableRow
                key={row.id}
                {...rowProps}
                className={cn(
                  "group/row border-border transition-[background-color,box-shadow] hover:bg-primary/5",
                  selectedId === row.original.id && "bg-primary/8",
                  onRowActivate &&
                    "relative cursor-pointer focus-visible:bg-primary/8 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  rowClassName,
                )}
              >
                {row.getAllCells().map((cell, index) => {
                  const meta = cell.column.columnDef.meta as DataTableMeta | undefined;
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "border-border relative max-w-0 border-r px-3 py-2.5 last:border-r-0",
                        leftAlignedColumns.includes(index) ? "text-left" : "text-center",
                        meta?.hiddenUntil && responsiveHiddenClasses[meta.hiddenUntil],
                      )}
                    >
                      {onRowActivate && index === 0 ? (
                        <span
                          className="bg-primary absolute top-2 bottom-2 left-0 w-[3px] origin-center scale-y-0 transition-transform duration-200 group-hover/row:scale-y-100 group-focus-visible/row:scale-y-100"
                          aria-hidden
                        />
                      ) : null}
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
          {rows.length === 0 && emptyContent ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columnCount} className="px-3 py-10">
                {emptyContent}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

function getActivatableRowProps(
  onActivate: () => void,
): Pick<ComponentPropsWithoutRef<"tr">, "onClick" | "onKeyDown" | "tabIndex"> {
  return {
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate();
      }
    },
  };
}
