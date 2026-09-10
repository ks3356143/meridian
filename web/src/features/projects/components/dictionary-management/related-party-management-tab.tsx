import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, useTable, type SortingState } from "@tanstack/react-table";
import {
  Building2,
  CircleCheck,
  CircleOff,
  Factory,
  FlaskConical,
  Layers,
  Plus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { projectsApi } from "@/features/projects/api";
import { ManagementSection, ManagementTable } from "./management-table";
import { RelatedPartyEditor } from "./related-party-editor";
import { ErrorCard, LoadingCard } from "./status-cards";
import { managementTableFeatures } from "./table-features";
import type { RelatedParty, RelatedPartyCategory } from "@/features/projects/types";

const features = managementTableFeatures;
const columnHelper = createColumnHelper<typeof features, RelatedParty>();

const categoryLabels: Record<RelatedPartyCategory, string> = {
  client: "委托方",
  developer: "研制方",
  test_center: "测评中心",
};

export function RelatedPartyManagementTab() {
  const queryClient = useQueryClient();
  const partiesQuery = useQuery({
    queryKey: ["projects", "related-parties"],
    queryFn: projectsApi.listRelatedParties,
  });
  const [selected, setSelected] = useState<RelatedParty | null>(null);
  const [editorMode, setEditorMode] = useState<"idle" | "create" | "edit">("idle");
  const [editorSession, setEditorSession] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<"all" | RelatedPartyCategory>("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "sortOrder", desc: false }]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["projects", "related-parties"] });
    await queryClient.invalidateQueries({ queryKey: ["projects", "options"] });
  };

  const filteredParties = useMemo(() => {
    const parties = partiesQuery.data ?? [];
    if (categoryFilter === "all") return parties;
    return parties.filter((party) => party.category === categoryFilter);
  }, [partiesQuery.data, categoryFilter]);

  const countByCategory = useMemo(() => {
    const counts: Record<RelatedPartyCategory, number> = {
      client: 0,
      developer: 0,
      test_center: 0,
    };
    for (const party of partiesQuery.data ?? []) {
      counts[party.category] += 1;
    }
    return counts;
  }, [partiesQuery.data]);

  const toggleMutation = useMutation({
    mutationFn: (party: RelatedParty) =>
      projectsApi.updateRelatedParty(party.id, {
        category: party.category,
        name: party.name,
        contact: party.contact,
        phone: party.phone,
        address: party.address,
        sortOrder: party.sortOrder,
        isEnabled: !party.isEnabled,
      }),
    onSuccess: async (party) => {
      await invalidate();
      setSelected(party);
      if (party.isEnabled) toast.success("相关方已启用");
      else toast.warning("相关方已停用");
    },
  });

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("sortOrder", {
          header: "排序",
          cell: (info) => <span className="font-mono">{info.getValue()}</span>,
        }),
        columnHelper.accessor("category", {
          header: "类别",
          cell: (info) => <Badge variant="outline">{categoryLabels[info.getValue()]}</Badge>,
        }),
        columnHelper.accessor("name", {
          header: "单位名称",
          cell: (info) => <span className="font-medium">{info.getValue()}</span>,
        }),
        columnHelper.accessor("contact", {
          header: "联系人",
          cell: (info) => info.getValue() || "--",
        }),
        columnHelper.accessor("phone", {
          header: "联系电话",
          cell: (info) => <span className="font-mono text-xs">{info.getValue() || "--"}</span>,
        }),
        columnHelper.accessor("address", {
          header: "单位地址",
          cell: (info) => info.getValue() || "--",
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
            const party = info.row.original;
            return (
              <div className="flex justify-center gap-1.5">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setSelected(party);
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
                  onClick={() => toggleMutation.mutate(party)}
                >
                  {party.isEnabled ? "停用" : "启用"}
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
    data: filteredParties,
    state: { sorting },
    onSortingChange: setSorting,
  });

  if (partiesQuery.isPending) return <LoadingCard label="正在加载相关方字典" />;
  if (partiesQuery.isError) return <ErrorCard onRetry={partiesQuery.refetch} />;

  return (
    <div className="dictionary-reveal min-w-0">
      <ManagementSection
        title="相关方字典"
        total={filteredParties.length}
        enabledCount={filteredParties.filter((item) => item.isEnabled).length}
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
        <Tabs
          value={categoryFilter}
          onValueChange={(value) => setCategoryFilter(value as "all" | RelatedPartyCategory)}
        >
          <TabsList>
            <TabsTrigger value="all">
              <Layers aria-hidden />
              全部
              <span className="text-muted-foreground text-xs">
                {partiesQuery.data?.length ?? 0}
              </span>
            </TabsTrigger>
            <TabsTrigger value="client">
              <Building2 aria-hidden />
              委托方
              <span className="text-muted-foreground text-xs">{countByCategory.client}</span>
            </TabsTrigger>
            <TabsTrigger value="developer">
              <Factory aria-hidden />
              研制方
              <span className="text-muted-foreground text-xs">{countByCategory.developer}</span>
            </TabsTrigger>
            <TabsTrigger value="test_center">
              <FlaskConical aria-hidden />
              测评中心
              <span className="text-muted-foreground text-xs">{countByCategory.test_center}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <ManagementTable table={table} selectedId={selected?.id} leftAlignedColumns={[1]} />
      </ManagementSection>

      <RelatedPartyEditor
        key={editorSession}
        open={editorMode !== "idle"}
        item={selected}
        onCancel={() => setEditorMode("idle")}
        onSaved={async (party) => {
          await invalidate();
          setSelected(party);
          setEditorMode("idle");
        }}
      />
    </div>
  );
}
