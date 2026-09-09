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
import { ArrowDown, ArrowUp, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { levelVariant, statusVariant } from "../status-style";
import { totalOpenIssues, type Project } from "../types";

const features = tableFeatures({
  rowSortingFeature,
  coreRowModel: createCoreRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
});

const columnHelper = createColumnHelper<typeof features, Project>();

interface ProjectsTableProps {
  projects: Project[];
  onClearFilters?: () => void;
}

export function ProjectsTable({ projects, onClearFilters }: ProjectsTableProps) {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([{ id: "updatedAt", desc: true }]);

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("id", {
          header: "标识",
          cell: (info) => (
            <span className="font-mono text-xs font-semibold">{info.getValue()}</span>
          ),
        }),
        columnHelper.accessor("name", {
          header: "项目名称",
          cell: (info) => <span className="font-medium whitespace-nowrap">{info.getValue()}</span>,
        }),
        columnHelper.accessor("nature", { header: "测评性质" }),
        columnHelper.accessor("softwareType", { header: "软件类型" }),
        columnHelper.accessor("level", {
          header: "等级",
          cell: (info) => (
            <Badge
              variant={levelVariant[info.getValue()]}
              className="size-5 justify-center px-0 font-mono"
            >
              {info.getValue()}
            </Badge>
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
              <div className="flex min-w-28 flex-col gap-1">
                <span className="font-mono text-xs">
                  {row.casesExecuted}/{row.casesTotal} · {rate}%
                </span>
                <span className="bg-muted block h-1 w-full overflow-hidden">
                  <span
                    className="bg-primary block h-full w-full origin-left shadow-[0_0_8px_-2px_var(--primary)] transition-transform duration-500"
                    style={{ transform: `scaleX(${rate / 100})` }}
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
                className={`font-mono text-sm font-semibold ${
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
            <Badge variant={statusVariant[info.getValue()]}>
              <span className="status-dot" aria-hidden />
              {info.getValue()}
            </Badge>
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
  const columnCount = table.getAllLeafColumns().length;

  return (
    <div className="panel-surface border-border overflow-hidden rounded-sm border">
      <Table className="w-full border-collapse text-left text-[13px]">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-muted/60 border-border hover:bg-muted/60">
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    className="text-muted-foreground border-border h-auto border-r px-3 py-2.5 text-center text-xs last:border-r-0"
                  >
                    {header.column.getCanSort() ? (
                      <Button
                        asChild
                        variant="ghost"
                        size="xs"
                        className="hover:text-primary h-auto justify-center px-0 text-xs"
                      >
                        <button type="button" onClick={header.column.getToggleSortingHandler()}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3" aria-hidden />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3" aria-hidden />
                          ) : null}
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
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              tabIndex={0}
              className="group/row border-border focus-visible:bg-primary/8 hover:bg-primary/5 relative cursor-pointer transition-[background-color,box-shadow] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
              onClick={() => navigate(`/projects/${row.original.id}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter") navigate(`/projects/${row.original.id}`);
              }}
            >
              {row.getAllCells().map((cell, index) => (
                <TableCell
                  key={cell.id}
                  className="border-border relative border-r px-3 py-2.5 last:border-r-0"
                >
                  {index === 0 ? (
                    <span
                      className="bg-primary absolute top-2 bottom-2 left-0 w-[3px] origin-center scale-y-0 transition-transform duration-200 group-hover/row:scale-y-100 group-focus-visible/row:scale-y-100"
                      aria-hidden
                    />
                  ) : null}
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {projects.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columnCount} className="px-3 py-10">
                <div className="flex flex-col items-center gap-3">
                  <SearchX className="text-muted-foreground size-5" aria-hidden />
                  <p className="text-muted-foreground text-sm">没有符合筛选条件的项目</p>
                  {onClearFilters ? (
                    <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
                      清空筛选
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
