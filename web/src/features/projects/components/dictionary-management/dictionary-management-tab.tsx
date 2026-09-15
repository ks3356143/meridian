import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, useTable, type SortingState } from "@tanstack/react-table";
import { CircleCheck, CircleOff, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
                  variant={item.isEnabled ? "destructive" : "outline"}
                  size="xs"
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
    data: dictionariesQuery.data ?? [],
    state: { sorting },
    onSortingChange: setSorting,
  });

  if (dictionariesQuery.isPending) return <LoadingCard label="正在加载技术字典" />;
  if (dictionariesQuery.isError) return <ErrorCard onRetry={dictionariesQuery.refetch} />;

  return (
    <div className="dictionary-reveal min-w-0">
      <ManagementSection
        title="技术字典"
        total={dictionariesQuery.data.length}
        enabledCount={dictionariesQuery.data.filter((item) => item.isEnabled).length}
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
      >
        <ManagementTable table={table} selectedId={selected?.id} leftAlignedColumns={[1]} />
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
