import { createColumnHelper, useTable, type SortingState } from "@tanstack/react-table";
import { SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TruncatedText } from "@/components/shared/truncated-text";
import { DataTable } from "@/components/shared/data-table";
import { managementTableFeatures } from "@/components/shared/table-features";
import { levelVariant, statusVariant } from "../status-style";
import { totalOpenIssues, type Project } from "../types";

const features = managementTableFeatures;
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
            <TruncatedText value={info.getValue()} className="font-mono text-xs font-semibold" />
          ),
        }),
        columnHelper.accessor("name", {
          header: "项目名称",
          meta: { hiddenUntil: "lg" },
          cell: (info) => <TruncatedText value={info.getValue()} className="font-medium" />,
        }),
        columnHelper.accessor("nature", {
          header: "测评性质",
          meta: { hiddenUntil: "wide" },
          cell: (info) => <TruncatedText value={info.getValue()} />,
        }),
        columnHelper.accessor("softwareType", {
          header: "软件类型",
          meta: { hiddenUntil: "wide" },
          cell: (info) => <TruncatedText value={info.getValue()} />,
        }),
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
        columnHelper.accessor("platform", {
          header: "平台",
          meta: { hiddenUntil: "xl" },
          cell: (info) => <TruncatedText value={info.getValue()} />,
        }),
        columnHelper.accessor("organization", {
          header: "研制单位",
          meta: { hiddenUntil: "wide" },
          cell: (info) => <TruncatedText value={info.getValue() || "未设置"} />,
        }),
        columnHelper.accessor("owner", {
          header: "负责人",
          cell: (info) => <TruncatedText value={info.getValue()} />,
        }),
        columnHelper.accessor((row) => row.casesExecuted / Math.max(row.casesTotal, 1), {
          id: "cases",
          header: "用例执行",
          cell: (info) => {
            const row = info.row.original;
            const rate = Math.round((row.casesExecuted / Math.max(row.casesTotal, 1)) * 100);
            return (
              <div className="flex w-full min-w-0 flex-col gap-1.5">
                <span className="block truncate font-mono text-xs">
                  {row.casesExecuted}/{row.casesTotal} · {rate}%
                </span>
                <Progress value={rate} className="h-1" />
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
                className={`block truncate font-mono text-sm font-semibold ${
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
            <Badge variant={statusVariant[info.getValue()]} className="max-w-full">
              <span className="status-dot" aria-hidden />
              <span className="truncate">{info.getValue()}</span>
            </Badge>
          ),
        }),
        columnHelper.accessor("updatedAt", {
          header: "更新时间",
          meta: { hiddenUntil: "xl" },
          cell: (info) => <TruncatedText value={info.getValue()} className="font-mono text-xs" />,
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
    <div className="panel-surface border-border overflow-hidden rounded-sm border">
      <DataTable
        table={table}
        leftAlignedColumns={[1]}
        onRowActivate={(project) => navigate(`/projects/${project.id}`)}
        emptyContent={
          <div className="flex flex-col items-center gap-3">
            <SearchX className="text-muted-foreground size-5" aria-hidden />
            <p className="text-muted-foreground text-sm">没有符合筛选条件的项目</p>
            {onClearFilters ? (
              <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
                清空筛选
              </Button>
            ) : null}
          </div>
        }
      />
    </div>
  );
}
