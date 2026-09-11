import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, useTable, type SortingState } from "@tanstack/react-table";
import { CircleCheck, CircleOff, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TruncatedText } from "@/components/shared/truncated-text";
import { projectsApi } from "@/features/projects/api";
import { ManagementSection, ManagementTable } from "./management-table";
import { ErrorCard, LoadingCard } from "./status-cards";
import { StandardEditor } from "./standard-editor";
import { managementTableFeatures } from "./table-features";
import type { ReferenceStandard } from "@/features/projects/types";

const features = managementTableFeatures;
const columnHelper = createColumnHelper<typeof features, ReferenceStandard>();

export function StandardManagementTab() {
  const queryClient = useQueryClient();
  const standardsQuery = useQuery({
    queryKey: ["projects", "standards"],
    queryFn: projectsApi.listStandards,
  });
  const [selected, setSelected] = useState<ReferenceStandard | null>(null);
  const [editorMode, setEditorMode] = useState<"idle" | "create" | "edit">("idle");
  const [editorSession, setEditorSession] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([{ id: "sortOrder", desc: false }]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["projects", "standards"] });
    await queryClient.invalidateQueries({ queryKey: ["projects", "options"] });
  };

  const toggleMutation = useMutation({
    mutationFn: (standard: ReferenceStandard) =>
      projectsApi.updateStandard(standard.id, {
        name: standard.name,
        code: standard.code,
        publishedDate: standard.publishedDate,
        source: standard.source,
        sortOrder: standard.sortOrder,
        isEnabled: !standard.isEnabled,
      }),
    onSuccess: async (standard) => {
      await invalidate();
      setSelected(standard);
      if (standard.isEnabled) toast.success("依据标准已启用");
      else toast.warning("依据标准已停用");
    },
  });

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("sortOrder", {
          header: "排序",
          cell: (info) => <span className="font-mono">{info.getValue()}</span>,
        }),
        columnHelper.accessor("name", {
          header: "文档名称",
          cell: (info) => <TruncatedText value={info.getValue()} className="font-medium" />,
        }),
        columnHelper.accessor("code", {
          header: "标识/版本",
          cell: (info) => <TruncatedText value={info.getValue()} className="font-mono text-xs" />,
        }),
        columnHelper.accessor("publishedDate", {
          header: "发布日期",
          cell: (info) => <TruncatedText value={info.getValue()} className="font-mono text-xs" />,
        }),
        columnHelper.accessor("source", {
          header: "来源单位",
          cell: (info) => <TruncatedText value={info.getValue()} />,
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
              <Badge variant="outline" className="justify-center">
                <CircleOff aria-hidden />
                停用
              </Badge>
            ),
        }),
        columnHelper.display({
          id: "actions",
          header: "操作",
          cell: (info) => {
            const standard = info.row.original;
            return (
              <div className="flex justify-center gap-1.5">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setSelected(standard);
                    setEditorSession((session) => session + 1);
                    setEditorMode("edit");
                  }}
                >
                  编辑
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={toggleMutation.isPending}
                  onClick={() => toggleMutation.mutate(standard)}
                >
                  {standard.isEnabled ? "停用" : "启用"}
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
    data: standardsQuery.data ?? [],
    state: { sorting },
    onSortingChange: setSorting,
  });

  if (standardsQuery.isPending) return <LoadingCard label="正在加载依据标准" />;
  if (standardsQuery.isError) return <ErrorCard onRetry={standardsQuery.refetch} />;

  return (
    <div className="dictionary-reveal min-w-0">
      <ManagementSection
        title="依据标准"
        total={standardsQuery.data.length}
        enabledCount={standardsQuery.data.filter((item) => item.isEnabled).length}
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
        <ManagementTable table={table} selectedId={selected?.id} leftAlignedColumns={[1, 4]} />
      </ManagementSection>

      <StandardEditor
        key={editorSession}
        open={editorMode !== "idle"}
        item={selected}
        onCancel={() => setEditorMode("idle")}
        onSaved={async (standard) => {
          await invalidate();
          setSelected(standard);
          setEditorMode("idle");
        }}
      />
    </div>
  );
}
