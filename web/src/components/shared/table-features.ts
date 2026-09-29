import {
  createCoreRowModel,
  createSortedRowModel,
  metaHelper,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";
import type { DataTableColumnMeta } from "./data-table-types";

export const managementTableFeatures = tableFeatures({
  rowSortingFeature,
  coreRowModel: createCoreRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    text: sortFn_text,
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
  },
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

export type ManagementTableFeatures = typeof managementTableFeatures;
