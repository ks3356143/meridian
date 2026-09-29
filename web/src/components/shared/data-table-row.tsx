import { flexRender } from "@tanstack/react-table";
import { memo, type ComponentPropsWithoutRef } from "react";
import type { Row } from "@tanstack/table-core";
import { cn } from "cn";
import { TableCell, TableRow } from "@/components/ui/table";
import styles from "./data-table-row.module.css";
import { dataTableResponsiveClasses, type DataTableRowData } from "./data-table-types";
import type { ManagementTableFeatures } from "./table-features";

type DataTableRowProps<TData extends DataTableRowData> = {
  row: Row<ManagementTableFeatures, TData>;
  active: boolean;
  onRowActivate?: (row: TData) => void;
  alignedColumns: ReadonlySet<number>;
  /** 参与 memo 比较的列定义标识；列定义变化时必须让行重新渲染。 */
  renderVersion: unknown;
};

function DataTableRowImpl<TData extends DataTableRowData>(props: DataTableRowProps<TData>) {
  const { row, active, onRowActivate, alignedColumns } = props;
  const rowProps = onRowActivate ? getActivatableRowProps(row.original, onRowActivate) : {};

  return (
    <TableRow
      {...rowProps}
      data-selected={active ? "true" : undefined}
      className={cn(
        "group/row border-border transition-[background-color,box-shadow] hover:bg-primary/5",
        active && "bg-primary/8",
        active && styles.selectedRow,
        onRowActivate &&
          "relative cursor-pointer focus-visible:bg-primary/8 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
      )}
    >
      {row.getAllCells().map((cell, index) => {
        const meta = cell.column.columnDef.meta;
        return (
          <TableCell
            key={cell.id}
            className={cn(
              "border-border relative max-w-0 border-r px-3 py-2.5 last:border-r-0",
              alignedColumns.has(index) ? "text-left" : "text-center",
              meta?.hiddenUntil && dataTableResponsiveClasses[meta.hiddenUntil],
            )}
          >
            {onRowActivate && index === 0 ? (
              <span
                className={cn(
                  "bg-primary absolute top-2 bottom-2 left-0 w-[3px] origin-center",
                  active
                    ? "scale-y-100"
                    : "scale-y-0 transition-transform duration-200 group-hover/row:scale-y-100 group-focus-visible/row:scale-y-100",
                )}
                aria-hidden
              />
            ) : null}
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

export const DataTableRow = memo(DataTableRowImpl) as typeof DataTableRowImpl;

function getActivatableRowProps<TData>(
  row: TData,
  onActivate: (row: TData) => void,
): Pick<ComponentPropsWithoutRef<"tr">, "onClick" | "onKeyDown" | "tabIndex"> {
  const activate = () => onActivate(row);
  return {
    tabIndex: 0,
    onClick: activate,
    onKeyDown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    },
  };
}
