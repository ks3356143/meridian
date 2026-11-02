import type { RowData } from "@tanstack/table-core";

export type ResponsiveBreakpoint = "lg" | "xl" | "wide";

export type DataTableColumnMeta = {
  hiddenUntil?: ResponsiveBreakpoint;
  width?: string;
};

export type DataTableRowData = RowData & { id: string };

/** 断点 → [表头/单元格类名, 列元素类名]；两处同步由同一份字面量保证。 */
const dataTableResponsiveClassPairs: Record<ResponsiveBreakpoint, readonly [string, string]> = {
  lg: ["hidden lg:table-cell", "hidden lg:table-column"],
  xl: ["hidden xl:table-cell", "hidden xl:table-column"],
  wide: ["hidden min-[1760px]:table-cell", "hidden min-[1760px]:table-column"],
};

export function dataTableCellResponsiveClass(breakpoint: ResponsiveBreakpoint) {
  return dataTableResponsiveClassPairs[breakpoint][0];
}

export function dataTableColumnResponsiveClass(breakpoint: ResponsiveBreakpoint) {
  return dataTableResponsiveClassPairs[breakpoint][1];
}
