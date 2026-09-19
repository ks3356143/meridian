import { FileSearch } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./requirements-layout.module.css";
import { QueryError, QueryLoading } from "@/components/shared/query-state";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import type { RequirementRecord } from "@/features/requirements/types";
import type { Project } from "../../../types";
import { DeletedRequirementsDialog } from "./deleted-requirements-dialog";
import {
  RequirementCreateDialog,
  type RequirementCreateInitialValues,
} from "./requirement-create-dialog";
import { buildRequirementCopySeed, type RequirementDraft } from "./requirement-form";
import { RequirementDeleteDialog } from "./requirement-delete-dialog";
import { RequirementPurgeDialog } from "./requirement-purge-dialog";
import { RequirementDetail } from "./requirement-detail";
import { RequirementAuditDialog } from "./requirement-audit-dialog";
import { RequirementBulkDeleteDialog } from "./requirement-bulk-delete-dialog";
import { RequirementBulkUpdateDialog } from "./requirement-bulk-update-dialog";
import { RequirementsHero } from "./requirements-hero";
import { RequirementsTree } from "./requirements-tree";
import { useRequirementsWorkbench } from "./use-requirements-workbench";

let requirementsPanelLayout: Record<string, number> | undefined;

type RequirementCreateSeed = {
  key: string;
  values: RequirementCreateInitialValues;
};

export function RequirementsLayout({ project }: { project: Project }) {
  const wideLayout = useWideLayout();
  const {
    workbenchQuery,
    createMutation,
    updateMutation,
    deleteMutation,
    restoreMutation,
    purgeMutation,
    bulkUpdateMutation,
    invalidate,
  } = useRequirementsWorkbench(project);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSeed, setCreateSeed] = useState<RequirementCreateSeed | null>(null);
  const [deletedOpen, setDeletedOpen] = useState(false);
  const [auditRequirement, setAuditRequirement] = useState<RequirementRecord | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{
    requirement: RequirementRecord;
    hasUnsavedChanges: boolean;
  } | null>(null);
  const [pendingPurge, setPendingPurge] = useState<RequirementRecord | null>(null);
  const requestTreeExitRef = useRef((_id: string) => Promise.resolve());
  const workbench = workbenchQuery.data;
  const sources = workbench?.sources ?? [];
  const officialRequirements = (workbench?.requirements ?? []).filter(
    (requirement) => requirement.status === "official",
  );
  const deletedRequirements = (workbench?.requirements ?? []).filter(
    (requirement) =>
      requirement.status === "excluded" && requirement.deletedFromStatus === "official",
  );
  const selectedRequirement =
    officialRequirements.find((requirement) => requirement.id === selectedId) ??
    officialRequirements[0];
  const selectedSource = sources.find(
    (source) => source.id === selectedRequirement?.sourceVersionId,
  );
  const selectedRequirements = officialRequirements.filter((requirement) =>
    selectedIds.includes(requirement.id),
  );
  const activeChapterRequirements = (workbench?.requirements ?? []).filter(
    (requirement) => requirement.status === "candidate" || requirement.status === "official",
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
  const registerTreeExitAnimation = useCallback((requestExit: (id: string) => Promise<void>) => {
    requestTreeExitRef.current = requestExit;
  }, []);
  const handleDeleteRequest = useCallback(
    (requirement: RequirementRecord, hasUnsavedChanges = false) => {
      setPendingDelete({ requirement, hasUnsavedChanges });
    },
    [],
  );
  const handleRestore = useCallback(
    async (requirement: RequirementRecord) => {
      try {
        await restoreMutation.mutateAsync(requirement.id);
        setSelectedId(requirement.id);
        setDeletedOpen(false);
      } catch {
        // 保持管理弹窗打开，由表格顶部错误提示展示失败原因。
      }
    },
    [restoreMutation],
  );
  const handleCopyDeleted = useCallback(
    (requirement: RequirementRecord) => {
      setCreateSeed({
        key: `copy-${requirement.id}`,
        values: buildRequirementCopySeed(requirement, activeChapterRequirements),
      });
      setDeletedOpen(false);
      setCreateOpen(true);
    },
    [activeChapterRequirements],
  );
  const handleCopyRequirement = useCallback(
    (requirement: RequirementRecord, draft?: RequirementDraft) => {
      setCreateSeed({
        key: `copy-${requirement.id}`,
        values: buildRequirementCopySeed(
          requirement,
          activeChapterRequirements,
          draft ?? requirement,
        ),
      });
      setCreateOpen(true);
    },
    [activeChapterRequirements],
  );
  const submitDelete = useCallback(
    async (requirement: RequirementRecord, reason: string) => {
      const currentIndex = officialRequirements.findIndex((item) => item.id === requirement.id);
      const neighbor =
        officialRequirements[currentIndex + 1] ?? officialRequirements[currentIndex - 1];

      try {
        await deleteMutation.mutateAsync({ ids: [requirement.id], reason });
        setSelectedId(neighbor?.id ?? "");
        await requestTreeExitRef.current(requirement.id);
        await invalidate();
        setPendingDelete(null);
      } catch {
        // 保持确认框打开，由 mutation.error 展示失败原因。
      }
    },
    [deleteMutation, invalidate, officialRequirements],
  );
  const submitPurge = useCallback(
    async (requirement: RequirementRecord, reason: string) => {
      try {
        await purgeMutation.mutateAsync({ id: requirement.id, reason });
        setPendingPurge(null);
      } catch {
        // 保持确认框打开，由 purgeMutation.error 展示失败原因。
      }
    },
    [purgeMutation],
  );
  const toggleBatchMode = useCallback(() => {
    setBatchMode((previous) => !previous);
    setSelectedIds([]);
  }, []);
  const toggleRequirementSelected = useCallback((id: string, checked: boolean) => {
    setSelectedIds((previous) =>
      checked ? [...new Set([...previous, id])] : previous.filter((item) => item !== id),
    );
  }, []);
  const toggleSourceSelected = useCallback(
    (sourceId: string, checked: boolean) => {
      setSelectedIds((previous) => {
        const sourceRequirementIds = officialRequirements
          .filter((requirement) => requirement.sourceVersionId === sourceId)
          .map((requirement) => requirement.id);
        const sourceIDSet = new Set(sourceRequirementIds);
        const kept = previous.filter((id) => !sourceIDSet.has(id));
        return checked ? [...new Set([...kept, ...sourceRequirementIds])] : kept;
      });
    },
    [officialRequirements],
  );
  const clearSelection = useCallback(() => setSelectedIds([]), []);
  const submitBulkUpdate = useCallback(
    async (payload: Parameters<typeof bulkUpdateMutation.mutateAsync>[0]) => {
      await bulkUpdateMutation.mutateAsync(payload);
      setBulkUpdateOpen(false);
      setBatchMode(false);
      setSelectedIds([]);
    },
    [bulkUpdateMutation],
  );
  const submitBulkDelete = useCallback(
    async (reason: string) => {
      const deletingIDs = new Set(selectedRequirements.map((requirement) => requirement.id));
      const remaining = officialRequirements.filter(
        (requirement) => !deletingIDs.has(requirement.id),
      );

      try {
        await deleteMutation.mutateAsync({
          ids: [...deletingIDs],
          reason,
        });
        await Promise.all(
          [...deletingIDs].map((requirementId) => requestTreeExitRef.current(requirementId)),
        );
        await invalidate();
        setSelectedId(remaining[0]?.id ?? "");
        setBulkDeleteOpen(false);
        setBatchMode(false);
        setSelectedIds([]);
      } catch {
        // 保持确认框打开，由 mutation.error 展示失败原因。
      }
    },
    [deleteMutation, invalidate, officialRequirements, selectedRequirements],
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
      batchMode={batchMode}
      selectedIds={selectedIds}
      onSelect={(requirement) => setSelectedId(requirement.id)}
      onCreate={() => setCreateOpen(true)}
      onCopy={handleCopyRequirement}
      onDelete={handleDeleteRequest}
      onToggleBatchMode={toggleBatchMode}
      onToggleRequirement={toggleRequirementSelected}
      onToggleSource={toggleSourceSelected}
      onOpenBulkUpdate={() => setBulkUpdateOpen(true)}
      onOpenBulkDelete={() => setBulkDeleteOpen(true)}
      onClearSelection={clearSelection}
      onRegisterExitAnimation={registerTreeExitAnimation}
      naturalHeight={!wideLayout}
    />
  );
  const hero = (
    <RequirementsHero
      requirements={workbench?.requirements ?? []}
      loading={workbenchQuery.isFetching}
      onOpenDeleted={() => setDeletedOpen(true)}
    />
  );
  const detail = selectedRequirement ? (
    <RequirementDetail
      key={selectedRequirement.id}
      requirement={selectedRequirement}
      source={selectedSource}
      onUpdate={handleUpdate}
      onDelete={handleDeleteRequest}
      onCopy={handleCopyRequirement}
    />
  ) : (
    <section className={styles.detailShell} aria-label="需求详情容器">
      <div className={styles.detailEmpty}>
        <FileSearch aria-hidden />
        <h3>选择或新增确认需求</h3>
      </div>
    </section>
  );

  function renderCreateDialog() {
    return (
      <RequirementCreateDialog
        key={createSeed?.key ?? "blank"}
        open={createOpen}
        sources={sources}
        requirements={activeChapterRequirements}
        initialValues={createSeed?.values ?? null}
        chapterSeedRequirement={createSeed ? null : selectedRequirement}
        submitting={createMutation.isPending}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateSeed(null);
        }}
        onSubmit={async (payload) => {
          const created = await createMutation.mutateAsync(payload);
          setSelectedId(created.id);
          return created;
        }}
      />
    );
  }

  function renderDeleteDialog() {
    const requirement = pendingDelete?.requirement;
    const source = sources.find((item) => item.id === requirement?.sourceVersionId);
    return (
      <RequirementDeleteDialog
        key={`delete-${requirement?.id ?? "none"}`}
        requirement={requirement ?? null}
        source={source}
        submitting={deleteMutation.isPending}
        error={deleteMutation.error}
        hasUnsavedChanges={pendingDelete?.hasUnsavedChanges ?? false}
        onOpenChange={(open) => {
          if (!open) {
            deleteMutation.reset();
            setPendingDelete(null);
          }
        }}
        onConfirm={submitDelete}
      />
    );
  }

  function renderDeletedDialog() {
    return (
      <DeletedRequirementsDialog
        open={deletedOpen}
        requirements={deletedRequirements}
        sources={sources}
        restoringId={restoreMutation.isPending ? (restoreMutation.variables ?? "") : ""}
        error={restoreMutation.error}
        purgingId={purgeMutation.isPending ? (purgeMutation.variables?.id ?? "") : ""}
        purgeError={purgeMutation.error}
        onOpenChange={(open) => {
          setDeletedOpen(open);
          if (!open) {
            restoreMutation.reset();
            purgeMutation.reset();
            setPendingPurge(null);
          }
        }}
        onRestore={handleRestore}
        onCopy={handleCopyDeleted}
        onShowAudit={setAuditRequirement}
        onPurge={setPendingPurge}
      />
    );
  }

  function renderPurgeDialog() {
    const requirement = pendingPurge;
    const source = sources.find((item) => item.id === requirement?.sourceVersionId);
    return (
      <RequirementPurgeDialog
        key={`purge-${requirement?.id ?? "none"}`}
        requirement={requirement}
        source={source}
        submitting={purgeMutation.isPending}
        error={purgeMutation.error}
        onOpenChange={(open) => {
          if (!open) {
            purgeMutation.reset();
            setPendingPurge(null);
          }
        }}
        onConfirm={submitPurge}
      />
    );
  }

  function renderAuditDialog() {
    return (
      <RequirementAuditDialog
        projectId={project.id}
        requirement={auditRequirement}
        onOpenChange={(open) => {
          if (!open) setAuditRequirement(null);
        }}
      />
    );
  }

  function renderBulkUpdateDialog() {
    return (
      <RequirementBulkUpdateDialog
        open={bulkUpdateOpen}
        requirements={selectedRequirements}
        allRequirements={workbench?.requirements ?? []}
        submitting={bulkUpdateMutation.isPending}
        error={bulkUpdateMutation.error}
        onOpenChange={(open) => {
          setBulkUpdateOpen(open);
          if (!open) bulkUpdateMutation.reset();
        }}
        onSubmit={submitBulkUpdate}
      />
    );
  }

  function renderBulkDeleteDialog() {
    return (
      <RequirementBulkDeleteDialog
        key={`bulk-delete-${bulkDeleteOpen ? selectedIds.join(",") : "none"}`}
        open={bulkDeleteOpen}
        requirements={selectedRequirements}
        submitting={deleteMutation.isPending}
        error={deleteMutation.error}
        onOpenChange={(open) => {
          setBulkDeleteOpen(open);
          if (!open) deleteMutation.reset();
        }}
        onConfirm={submitBulkDelete}
      />
    );
  }

  const surface = wideLayout ? (
    <section className={styles.workbench}>
      <ResizablePanelGroup
        id="requirements-container-layout"
        defaultLayout={requirementsPanelLayout}
        onLayoutChanged={savePanelLayout}
        resizeTargetMinimumSize={{ coarse: 36, fine: 24 }}
      >
        <ResizablePanel
          id="requirements-tree-panel"
          className={styles.panelFrame}
          defaultSize={380}
          minSize="22%"
          maxSize="680px"
        >
          {tree}
        </ResizablePanel>
        <ResizableHandle id="requirements-tree-handle" aria-label="调整需求目录宽度" />
        <ResizablePanel id="requirements-right-panel" className={styles.panelFrame}>
          <div className={styles.rightPane}>
            {hero}
            {detail}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </section>
  ) : (
    <section className={styles.workbench}>
      {tree}
      <div className={styles.rightPane}>
        {hero}
        {detail}
      </div>
    </section>
  );

  return (
    <>
      {surface}
      {renderCreateDialog()}
      {renderDeleteDialog()}
      {renderDeletedDialog()}
      {renderAuditDialog()}
      {renderPurgeDialog()}
      {renderBulkUpdateDialog()}
      {renderBulkDeleteDialog()}
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
