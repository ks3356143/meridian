import type { RowData } from "@tanstack/table-core";

export type ResponsiveBreakpoint = "lg" | "xl" | "wide";

export type DataTableColumnMeta = {
  hiddenUntil?: ResponsiveBreakpoint;
};

export type DataTableRowData = RowData & { id: string };

export const dataTableResponsiveClasses: Record<ResponsiveBreakpoint, string> = {
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
  wide: "hidden min-[1600px]:table-cell",
};
