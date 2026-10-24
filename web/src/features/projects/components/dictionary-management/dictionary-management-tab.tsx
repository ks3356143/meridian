import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, useTable, type SortingState } from "@tanstack/react-table";
import { CircleCheck, CircleOff, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TruncatedText } from "@/components/shared/truncated-text";
import { projectsApi } from "@/features/projects/api";
import { DictionaryEditor } from "./dictionary-editor";
import { ManagementSection, ManagementTable } from "./management-table";
import { ErrorCard, LoadingCard } from "./status-cards";
import { managementTableFeatures } from "@/components/shared/table-features";
import type { DictionaryCategory, DictionaryOption } from "@/features/projects/types";

const features = managementTableFeatures;
const columnHelper = createColumnHelper<typeof features, DictionaryOption>();
const categoryLabels: Record<DictionaryCategory, string> = {
  language: "编程语言",
  runtime_environment: "运行环境",
  development_environment: "开发环境",
};

export function DictionaryManagementTab() {
  const queryClient = useQueryClient();
  const dictionariesQuery = useQuery({
    queryKey: ["projects", "dictionaries"],
    queryFn: projectsApi.listDictionaries,
  });
  const [selected, setSelected] = useState<DictionaryOption | null>(null);
  const [editorMode, setEditorMode] = useState<"idle" | "create" | "edit">("idle");
  const [editorSession, setEditorSession] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "category", desc: false },
    { id: "sortOrder", desc: false },
  ]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["projects", "dictionaries"] });
    await queryClient.invalidateQueries({ queryKey: ["projects", "options"] });
  };

  const toggleMutation = useMutation({
    mutationFn: (item: DictionaryOption) =>
      projectsApi.updateDictionary(item.id, {
        category: item.category,
        name: item.name,
        sortOrder: item.sortOrder,
        isEnabled: !item.isEnabled,
      }),
    onSuccess: async (item) => {
      await invalidate();
      setSelected(item);
      if (item.isEnabled) toast.success("字典项已启用");
      else toast.warning("字典项已停用");
    },
  });

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("category", {
          header: "字典类型",
          cell: (info) => (
            <Badge variant="outline" className="justify-center">
              {categoryLabels[info.getValue()]}
            </Badge>
          ),
        }),
        columnHelper.accessor("name", {
          header: "展示名",
          cell: (info) => <TruncatedText value={info.getValue()} className="font-medium" />,
        }),
        columnHelper.accessor("sortOrder", {
          header: "排序",
          cell: (info) => <span className="font-mono">{info.getValue()}</span>,
        }),
        columnHelper.accessor("isEnabled", {
          header: "状态",
          cell: (info) =>
            info.getValue() ? (
              <Badge variant="success" className="justify-center">
                <CircleCheck aria-hidden />
                启用
              </Badge>
            ) : (
              <Badge variant="danger" className="justify-center">
                <CircleOff aria-hidden />
                停用
              </Badge>
            ),
        }),
        columnHelper.accessor("isPreset", {
          header: "来源",
          cell: (info) => (
            <Badge variant={info.getValue() ? "secondary" : "info"} className="justify-center">
              {info.getValue() ? "预置" : "自定义"}
            </Badge>
          ),
        }),
        columnHelper.display({
          id: "actions",
          header: "操作",
          cell: (info) => {
            const item = info.row.original;
            return (
              <div className="flex justify-center gap-1.5">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setSelected(item);
                    setEditorSession((session) => session + 1);
                    setEditorMode("edit");
                  }}
                >
                  编辑
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  className={
                    item.isEnabled
                      ? "text-destructive hover:border-destructive/35 hover:bg-destructive/8 hover:text-destructive"
                      : undefined
                  }
                  disabled={toggleMutation.isPending}
                  onClick={() => toggleMutation.mutate(item)}
                >
                  {item.isEnabled ? "停用" : "启用"}
                </Button>
              </div>
            );
          },
        }),
      ]),
    [toggleMutation],
  );

  const table = useTable({
    features,
    columns,
    data: (dictionariesQuery.data ?? []).filter((item) => {
      const query = keyword.trim().toLowerCase();
      return (
        query.length === 0 ||
        item.name.toLowerCase().includes(query) ||
        categoryLabels[item.category].toLowerCase().includes(query)
      );
    }),
    state: { sorting },
    onSortingChange: setSorting,
  });
  const filteredRows = table.getFilteredRowModel().rows;
  const filteredCount = filteredRows.length;

  if (dictionariesQuery.isPending) return <LoadingCard label="正在加载技术字典" />;
  if (dictionariesQuery.isError) return <ErrorCard onRetry={dictionariesQuery.refetch} />;

  return (
    <div className="dictionary-reveal min-w-0">
      <ManagementSection
        title="技术字典"
        total={filteredCount}
        enabledCount={filteredRows.filter((row) => row.original.isEnabled).length}
        action={
          <Button
            size="sm"
            onClick={() => {
              setSelected(null);
              setEditorSession((session) => session + 1);
              setEditorMode("create");
            }}
          >
            <Plus data-icon="inline-start" />
            新增
          </Button>
        }
        toolbar={
          <div className="flex min-w-0 flex-wrap items-center gap-2" role="search">
            <div className="relative min-w-48 flex-1">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
                aria-hidden
              />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                aria-label="搜索技术字典"
                placeholder="搜索字典类型或展示名"
                className="pl-8"
              />
            </div>
            {keyword && filteredCount > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setKeyword("")}>
                清空搜索
              </Button>
            ) : null}
            <span className="text-muted-foreground font-mono text-xs" aria-live="polite">
              {filteredCount}/{dictionariesQuery.data.length}
            </span>
          </div>
        }
      >
        <ManagementTable
          table={table}
          selectedId={selected?.id}
          leftAlignedColumns={[1]}
          emptyContent={
            <div className="flex flex-col items-center gap-2">
              <Search className="text-muted-foreground size-5" aria-hidden />
              <p className="text-muted-foreground text-sm">没有匹配的技术字典</p>
              <p className="text-muted-foreground text-xs">清空搜索后可查看全部字典项</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setKeyword("")}>
                清空搜索
              </Button>
            </div>
          }
        />
      </ManagementSection>

      <DictionaryEditor
        key={editorSession}
        open={editorMode !== "idle"}
        item={selected}
        onCancel={() => setEditorMode("idle")}
        onSaved={async (item) => {
          await invalidate();
          setSelected(item);
          setEditorMode("idle");
        }}
      />
    </div>
  );
}
