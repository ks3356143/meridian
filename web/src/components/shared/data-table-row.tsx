import { flexRender } from "@tanstack/react-table";
import { memo, useLayoutEffect, useRef, type ComponentPropsWithoutRef } from "react";
import type { Row } from "@tanstack/table-core";
import { cn } from "cn";
import { TableCell, TableRow } from "@/components/ui/table";
import { animate } from "@/lib/motion";
import styles from "./data-table-row.module.css";
import { dataTableCellResponsiveClass, type DataTableRowData } from "./data-table-types";
import type { ManagementTableFeatures } from "./table-features";

type DataTableRowProps<TData extends DataTableRowData> = {
  row: Row<ManagementTableFeatures, TData>;
  active: boolean;
  onRowActivate?: (row: TData) => void;
  alignedColumns: ReadonlySet<number>;
  /** 参与 memo 比较的列定义标识；列定义变化时必须让行重新渲染。 */
  renderVersion: unknown;
  animateEntry: boolean;
};

function DataTableRowImpl<TData extends DataTableRowData>(props: DataTableRowProps<TData>) {
  const { row, active, onRowActivate, alignedColumns, animateEntry } = props;
  const rowRef = useRef<HTMLTableRowElement>(null);
  const rowProps = onRowActivate ? getActivatableRowProps(row.original, onRowActivate) : {};

  // 入场同时带轻位移：先写首帧（layout 阶段、绘制前），再动画到终态，避免闪烁。
  useLayoutEffect(() => {
    const element = rowRef.current;
    if (!animateEntry || !element) return;
    element.style.opacity = "0.55";
    element.style.transform = "translateY(6px)";
    const control = animate(
      element,
      { opacity: [0.55, 1], y: [6, 0] },
      {
        duration: 0.3,
        delay: Math.min(row.index * 0.018, 0.144),
        ease: [0.23, 1, 0.32, 1],
      },
    );
    return () => control.stop();
  }, [animateEntry, row.index]);

  return (
    <TableRow
      {...rowProps}
      ref={rowRef}
      data-selected={active ? "true" : undefined}
      className={cn(
        "group/row border-border transition-[background-color,box-shadow] hover:bg-primary/8",
        active && "bg-primary/12",
        active && styles.selectedRow,
        onRowActivate &&
          "relative cursor-pointer focus-visible:bg-primary/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
      )}
    >
      {row.getAllCells().map((cell, index) => {
        const meta = cell.column.columnDef.meta;
        return (
          <TableCell
            key={cell.id}
            className={cn(
              "border-border/75 relative max-w-0 border-r px-3 py-3 last:border-r-0",
              alignedColumns.has(index) ? "text-left" : "text-center",
              meta?.hiddenUntil && dataTableCellResponsiveClass(meta.hiddenUntil),
            )}
          >
            {onRowActivate && index === 0 ? (
              <span
                className={cn(
                  "bg-primary absolute inset-y-0 left-0 w-[3px] origin-center transition-transform duration-200",
                  active
                    ? "scale-y-100"
                    : "scale-y-0 group-hover/row:scale-y-100 group-focus-visible/row:scale-y-100",
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
