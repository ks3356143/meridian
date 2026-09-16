import { FileSearch } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { QueryError, QueryLoading } from "@/components/shared/query-state";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import type { Project } from "../../../types";
import { RequirementCreateDialog } from "./requirement-create-dialog";
import { RequirementDetail } from "./requirement-detail";
import { RequirementsHero } from "./requirements-hero";
import { RequirementsTree } from "./requirements-tree";
import { useRequirementsWorkbench } from "./use-requirements-workbench";

let requirementsPanelLayout: Record<string, number> | undefined;

export function RequirementsLayout({ project }: { project: Project }) {
  const wideLayout = useWideLayout();
  const { workbenchQuery, createMutation, updateMutation } = useRequirementsWorkbench(project);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const workbench = workbenchQuery.data;
  const sources = workbench?.sources ?? [];
  const officialRequirements = (workbench?.requirements ?? []).filter(
    (requirement) => requirement.status === "official",
  );
  const selectedRequirement =
    officialRequirements.find((requirement) => requirement.id === selectedId) ??
    officialRequirements[0];
  const selectedSource = sources.find(
    (source) => source.id === selectedRequirement?.sourceVersionId,
  );

  const updateRequirement = updateMutation.mutateAsync;
  const savePanelLayout = useCallback((layout: Record<string, number>) => {
    requirementsPanelLayout = layout;
  }, []);
  const handleUpdate = useCallback(
    async (id: string, payload: Parameters<typeof updateRequirement>[0]["payload"]) =>
      updateRequirement({ id, payload }),
    [updateRequirement],
  );

  if (workbenchQuery.isPending) return <QueryLoading label="正在加载确认需求" rows={8} />;
  if (workbenchQuery.isError) {
    return <QueryError title="确认需求加载失败" onRetry={() => workbenchQuery.refetch()} />;
  }

  const tree = (
    <RequirementsTree
      sources={sources}
      requirements={workbench?.requirements ?? []}
      selectedId={selectedRequirement?.id ?? ""}
      onSelect={(requirement) => setSelectedId(requirement.id)}
      onCreate={() => setCreateOpen(true)}
    />
  );
  const hero = (
    <RequirementsHero
      requirements={workbench?.requirements ?? []}
      loading={workbenchQuery.isFetching}
    />
  );
  const detail = selectedRequirement ? (
    <RequirementDetail
      key={selectedRequirement.id}
      requirement={selectedRequirement}
      source={selectedSource}
      onUpdate={handleUpdate}
    />
  ) : (
    <section className="requirements-detail-shell" aria-label="需求详情容器">
      <div className="requirements-detail-empty">
        <FileSearch aria-hidden />
        <h3>选择或新增确认需求</h3>
      </div>
    </section>
  );

  if (!wideLayout) {
    return (
      <>
        <section className="requirements-workbench requirements-workbench-narrow">
          {tree}
          <div className="requirements-right-pane">
            {hero}
            {detail}
          </div>
        </section>
        <RequirementCreateDialog
          open={createOpen}
          sources={sources}
          submitting={createMutation.isPending}
          onOpenChange={setCreateOpen}
          onSubmit={async (payload) => {
            const created = await createMutation.mutateAsync(payload);
            setSelectedId(created.id);
            return created;
          }}
        />
      </>
    );
  }

  return (
    <>
      <section className="requirements-workbench">
        <ResizablePanelGroup
          id="requirements-container-layout"
          defaultLayout={requirementsPanelLayout}
          onLayoutChanged={savePanelLayout}
          resizeTargetMinimumSize={{ coarse: 36, fine: 24 }}
        >
          <ResizablePanel
            id="requirements-tree-panel"
            className="requirements-panel-frame"
            defaultSize="34%"
            minSize="22%"
            maxSize="46%"
          >
            {tree}
          </ResizablePanel>
          <ResizableHandle id="requirements-tree-handle" aria-label="调整需求目录宽度" />
          <ResizablePanel id="requirements-right-panel" className="requirements-panel-frame">
            <div className="requirements-right-pane">
              {hero}
              {detail}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </section>
      <RequirementCreateDialog
        open={createOpen}
        sources={sources}
        submitting={createMutation.isPending}
        onOpenChange={setCreateOpen}
        onSubmit={async (payload) => {
          const created = await createMutation.mutateAsync(payload);
          setSelectedId(created.id);
          return created;
        }}
      />
    </>
  );
}

function useWideLayout() {
  const query = "(min-width: 1101px)";
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const sync = () => setWide(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return wide;
}
