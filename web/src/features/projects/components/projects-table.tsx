import {
  createColumnHelper,
  createCoreRowModel,
  createSortedRowModel,
  flexRender,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { levelStyle, statusStyle } from "../status-style";
import { totalOpenIssues, type Project } from "../types";

const features = tableFeatures({
  rowSortingFeature,
  coreRowModel: createCoreRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
});

const columnHelper = createColumnHelper<typeof features, Project>();

export function ProjectsTable({ projects }: { projects: Project[] }) {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([{ id: "updatedAt", desc: true }]);

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("id", {
          header: "标识",
          cell: (info) => <span className="font-mono text-xs font-medium">{info.getValue()}</span>,
        }),
        columnHelper.accessor("name", {
          header: "项目名称",
          cell: (info) => <span className="font-medium whitespace-nowrap">{info.getValue()}</span>,
        }),
        columnHelper.accessor("nature", { header: "测评性质" }),
        columnHelper.accessor("testType", { header: "测试类型" }),
        columnHelper.accessor("level", {
          header: "等级",
          cell: (info) => (
            <span
              className={`inline-flex size-5 items-center justify-center border font-mono text-xs font-semibold ${levelStyle[info.getValue()]}`}
            >
              {info.getValue()}
            </span>
          ),
        }),
        columnHelper.accessor("platform", { header: "平台" }),
        columnHelper.accessor("organization", { header: "研制单位" }),
        columnHelper.accessor("owner", { header: "负责人" }),
        columnHelper.accessor((row) => row.casesExecuted / Math.max(row.casesTotal, 1), {
          id: "cases",
          header: "用例执行",
          cell: (info) => {
            const row = info.row.original;
            const rate = Math.round((row.casesExecuted / Math.max(row.casesTotal, 1)) * 100);
            return (
              <div className="flex min-w-24 flex-col gap-1">
                <span className="font-mono text-xs">
                  {row.casesExecuted}/{row.casesTotal} · {rate}%
                </span>
                <span className="bg-muted block h-1 w-full">
                  <span
                    className="bg-primary block h-full transition-[width] duration-700"
                    style={{ width: `${rate}%` }}
                  />
                </span>
              </div>
            );
          },
        }),
        columnHelper.accessor((row) => totalOpenIssues(row.openIssues), {
          id: "issues",
          header: "未闭环问题",
          cell: (info) => {
            const row = info.row.original;
            const urgent = row.openIssues.critical + row.openIssues.serious;
            const total = totalOpenIssues(row.openIssues);
            return (
              <span
                className={`font-mono text-sm font-medium ${
                  urgent > 0
                    ? "text-destructive"
                    : total > 0
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {total}
              </span>
            );
          },
        }),
        columnHelper.accessor("status", {
          header: "状态",
          cell: (info) => (
            <span
              className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 text-xs font-medium ${statusStyle[info.getValue()]}`}
            >
              {info.getValue()}
            </span>
          ),
        }),
        columnHelper.accessor("updatedAt", {
          header: "更新时间",
          cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
        }),
      ]),
    [],
  );

  const table = useTable({
    features,
    columns,
    data: projects,
    state: { sorting },
    onSortingChange: setSorting,
  });

  return (
    <div className="border-border bg-card border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-muted/50 border-border border-b">
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className="text-muted-foreground border-border whitespace-nowrap border-r px-3 py-2.5 text-xs font-medium last:border-r-0"
                    >
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          className="hover:text-primary inline-flex items-center gap-1 transition-colors"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3" aria-hidden />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3" aria-hidden />
                          ) : null}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                tabIndex={0}
                className="border-border hover:bg-primary/5 focus-visible:bg-primary/5 cursor-pointer border-b transition-colors last:border-b-0"
                onClick={() => navigate(`/projects/${row.original.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") navigate(`/projects/${row.original.id}`);
                }}
              >
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="border-border border-r px-3 py-2.5 last:border-r-0">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
