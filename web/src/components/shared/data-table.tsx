import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ReactTable } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import styles from "./data-table.module.css";
import { DataTableHeader } from "./data-table-header";
import { DataTableRow } from "./data-table-row";
import type { DataTableRowData } from "./data-table-types";
import type { ManagementTableFeatures } from "./table-features";

const DEFAULT_ROW_HEIGHT = 56;
const DEFAULT_VIRTUAL_HEIGHT = 280;
const DEFAULT_OVERSCAN = 8;
const PROGRESSIVE_INITIAL_ROWS = 4;
const PROGRESSIVE_ROW_CHUNK = 2;
const EMPTY_ALIGNED_COLUMNS: number[] = [];

export interface DataTableProps<TData extends DataTableRowData> {
  table: ReactTable<ManagementTableFeatures, TData>;
  selectedId?: string;
  leftAlignedColumns?: number[];
  emptyContent?: ReactNode;
  onRowActivate?: (row: TData) => void;
  /** 虚拟窗口前后额外渲染的行数；数据量大但行组件较重时可适度调低。 */
  overscan?: number;
  /**
   * 窗口化渲染：只渲染可视区内的行，用上下两个占位行撑起滚动高度。
   * 保留真实 `<table>` 结构（表头/列宽/固定布局都不变），仅行数受控。
   */
  virtualized?: { rowHeight: number; progressive?: boolean };
}

export function DataTable<TData extends DataTableRowData>({
  table,
  selectedId,
  leftAlignedColumns,
  emptyContent,
  onRowActivate,
  virtualized,
  overscan = DEFAULT_OVERSCAN,
}: DataTableProps<TData>) {
  const columnCount = table.getAllLeafColumns().length;
  const rows = table.getRowModel().rows;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [renderBudget, setRenderBudget] = useState(() =>
    virtualized?.progressive ? PROGRESSIVE_INITIAL_ROWS : Number.POSITIVE_INFINITY,
  );
  const alignmentSignature = (leftAlignedColumns ?? EMPTY_ALIGNED_COLUMNS).join(",");
  const alignedColumns = useMemo(
    () => new Set(alignmentSignature ? alignmentSignature.split(",").map(Number) : []),
    [alignmentSignature],
  );

  // 行高固定（单元格统一单行省略），用 spacer 行把未渲染的行位撑起来。
  // TanStack Virtual 官方 Hook 返回的对象天然不可 memo，React Compiler 会跳过本组件的 memo 化；
  // 这是库的既定用法，且只在开启 virtualized 时生效。
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => virtualized?.rowHeight ?? DEFAULT_ROW_HEIGHT,
    overscan,
    enabled: Boolean(virtualized),
    initialRect: virtualized ? { width: 1200, height: DEFAULT_VIRTUAL_HEIGHT } : undefined,
  });
  const virtualItems = virtualized ? virtualizer.getVirtualItems() : [];
  const firstItem = virtualItems[0];
  const lastItem = virtualItems[virtualItems.length - 1];
  const virtualRowCount = firstItem && lastItem ? lastItem.index - firstItem.index + 1 : 0;
  const renderedRowCount = virtualized ? Math.min(virtualRowCount, renderBudget) : rows.length;
  const visibleRows = virtualized
    ? rows.slice(
        firstItem?.index ?? 0,
        (firstItem?.index ?? 0) + Math.min(renderedRowCount, rows.length),
      )
    : rows;
  const topSpacer = firstItem ? firstItem.start : 0;
  const renderedEnd = firstItem
    ? firstItem.start + renderedRowCount * (virtualized?.rowHeight ?? DEFAULT_ROW_HEIGHT)
    : 0;
  const bottomSpacer = virtualized ? Math.max(0, virtualizer.getTotalSize() - renderedEnd) : 0;

  useEffect(() => {
    if (!virtualized?.progressive) return;
    setRenderBudget(PROGRESSIVE_INITIAL_ROWS);
  }, [rows.length, virtualized?.progressive, virtualized?.rowHeight]);

  useEffect(() => {
    if (!virtualized?.progressive || renderBudget >= virtualRowCount) return;
    const frame = window.requestAnimationFrame(() => {
      setRenderBudget((current) => Math.min(virtualRowCount, current + PROGRESSIVE_ROW_CHUNK));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [renderBudget, virtualized?.progressive, virtualRowCount]);

  const tableElement = (
    <Table className="w-full table-fixed border-collapse text-left text-[13px]">
      <DataTableHeader table={table} />
      <TableBody>
        {topSpacer > 0 ? (
          <TableRow aria-hidden className="border-0 hover:bg-transparent">
            <TableCell colSpan={columnCount} style={{ height: topSpacer, padding: 0, border: 0 }} />
          </TableRow>
        ) : null}
        {visibleRows.map((row) => (
          <DataTableRow
            key={row.id}
            row={row}
            active={selectedId === row.original.id}
            onRowActivate={onRowActivate}
            alignedColumns={alignedColumns}
            renderVersion={table.options.columns}
            animateEntry={!virtualized}
          />
        ))}
        {bottomSpacer > 0 ? (
          <TableRow aria-hidden className="border-0 hover:bg-transparent">
            <TableCell
              colSpan={columnCount}
              style={{ height: bottomSpacer, padding: 0, border: 0 }}
            />
          </TableRow>
        ) : null}
        {rows.length === 0 && emptyContent ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columnCount} className="px-3 py-10">
              {emptyContent}
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );

  if (!virtualized) {
    return (
      <div className={styles.tableScroller} data-slot="data-table-scroll">
        {tableElement}
      </div>
    );
  }

  return (
    <div ref={scrollRef} className={styles.scrollArea} data-slot="data-table-scroll">
      {tableElement}
    </div>
  );
}
