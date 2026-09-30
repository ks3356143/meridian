import { FileSearch } from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import styles from "./requirements-layout.module.css";
import { QueryError, QueryLoading } from "@/components/shared/query-state";
import { LazyChunkBoundary } from "@/components/shared/retryable-lazy";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { requirementsApi } from "@/features/requirements/api";
import type { RequirementRecord, SaveRequirementPayload } from "@/features/requirements/types";
import type { Project } from "../../../types";
import { DeletedRequirementsDialog } from "./deleted-requirements-dialog";
import { DeletedRequirementsPurgeDialog } from "./deleted-requirements-purge-dialog";
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
import { RequirementBulkPasteDialog } from "./requirement-bulk-paste-dialog";
import { RequirementsHero } from "./requirements-hero";

import { RequirementsTree, type RequirementCreatedSignal } from "./requirements-tree";
import { useRequirementsWorkbench } from "./use-requirements-workbench";

let requirementsPanelLayout: Record<string, number> | undefined;
let candidatePanelLayout: Record<string, number> | undefined;

const LazyRequirementsCandidateTree = lazy(() =>
  import("./requirements-candidate-tree").then((module) => ({
    default: module.RequirementsCandidateTree,
  })),
);
const LazyRequirementsCandidateWorkbench = lazy(() =>
  import("./requirements-candidate-workbench").then((module) => ({
    default: module.RequirementsCandidateWorkbench,
  })),
);

function preloadCandidateSurface() {
  void import("./requirements-candidate-tree");
  void import("./requirements-candidate-workbench");
}

type WorkbenchTab = "confirmed" | "candidate";

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
    bulkRestoreMutation,
    purgeMutation,
    bulkPurgeMutation,
    bulkUpdateMutation,
    bulkCreateMutation,
    bulkCleanNamesMutation,
    parseMutation,
    candidateStatusMutation,
    invalidate,
  } = useRequirementsWorkbench(project);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSeed, setCreateSeed] = useState<RequirementCreateSeed | null>(null);
  const [deletedOpen, setDeletedOpen] = useState(false);
  const [auditRequirement, setAuditRequirement] = useState<RequirementRecord | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [createdSignal, setCreatedSignal] = useState<RequirementCreatedSignal | null>(null);
  const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkPasteOpen, setBulkPasteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchTab>("confirmed");
  const [candidateActivated, setCandidateActivated] = useState(false);
  const [panelsReady, setPanelsReady] = useState(false);
  const [isCandidatePending, startCandidateTransition] = useTransition();
  const candidateActivatedRef = useRef(false);
  const [candidateSelectedId, setCandidateSelectedId] = useState("");
  const [pendingSelect, setPendingSelect] = useState<RequirementRecord | null>(null);
  const bodyDirtyRef = useRef(false);

  const [pendingDelete, setPendingDelete] = useState<{
    requirement: RequirementRecord;
    hasUnsavedChanges: boolean;
  } | null>(null);
  const [pendingPurge, setPendingPurge] = useState<RequirementRecord | null>(null);
  const [pendingPurgeMany, setPendingPurgeMany] = useState<{
    requirements: RequirementRecord[];
    all: boolean;
  } | null>(null);
  const requestTreeExitRef = useRef((_id: string) => Promise.resolve());
  const workbench = workbenchQuery.data;
  const requirements = useMemo(() => workbench?.requirements ?? [], [workbench]);
  const sources = useMemo(() => workbench?.sources ?? [], [workbench]);
  const candidateCount = useMemo(
    () =>
      requirements.filter(
        (requirement) => requirement.origin === "parsed" && requirement.status === "candidate",
      ).length,
    [requirements],
  );
  const officialRequirements = useMemo(
    () => requirements.filter((requirement) => requirement.status === "official"),
    [requirements],
  );
  const recycleBinRequirements = useMemo(
    () => requirements.filter((requirement) => requirement.status === "excluded"),
    [requirements],
  );
  const excludedCandidateCount = useMemo(
    () =>
      recycleBinRequirements.filter((requirement) => requirement.deletedFromStatus === "candidate")
        .length,
    [recycleBinRequirements],
  );
  const selectedRequirement = useMemo(
    () =>
      officialRequirements.find((requirement) => requirement.id === selectedId) ??
      officialRequirements[0],
    [officialRequirements, selectedId],
  );
  // 树选中必须走紧急更新；详情内容允许稍后提交，避免富文本详情和 Tiptap
  // 编辑器跟着左侧高亮一起重渲染，造成点击切换时的主线程卡顿。
  const deferredSelectedId = useDeferredValue(selectedId);
  const detailRequirement = useMemo(() => {
    const targetId = deferredSelectedId || selectedRequirement?.id;
    return (
      officialRequirements.find((requirement) => requirement.id === targetId) ?? selectedRequirement
    );
  }, [deferredSelectedId, officialRequirements, selectedRequirement]);
  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedRequirement?.sourceVersionId),
    [selectedRequirement?.sourceVersionId, sources],
  );
  const detailSource = useMemo(
    () => sources.find((source) => source.id === detailRequirement?.sourceVersionId),
    [detailRequirement?.sourceVersionId, sources],
  );
  const selectedRequirements = useMemo(() => {
    const selectedIDSet = new Set(selectedIds);
    return officialRequirements.filter((requirement) => selectedIDSet.has(requirement.id));
  }, [officialRequirements, selectedIds]);
  const activeChapterRequirements = useMemo(
    () =>
      requirements.filter(
        (requirement) => requirement.status === "candidate" || requirement.status === "official",
      ),
    [requirements],
  );
  const sections = useMemo(() => workbench?.sections ?? [], [workbench]);
  const handleSelectConfirmed = useCallback(
    (requirement: RequirementRecord) => {
      if (bodyDirtyRef.current && selectedId && selectedId !== requirement.id) {
        setPendingSelect(requirement);
        return;
      }
      setSelectedId(requirement.id);
    },
    [selectedId],
  );
  const handleBodyDirtyChange = useCallback((dirty: boolean) => {
    bodyDirtyRef.current = dirty;
  }, []);
  const confirmPendingSelect = useCallback(() => {
    if (!pendingSelect) return;
    bodyDirtyRef.current = false;
    setSelectedId(pendingSelect.id);
    setPendingSelect(null);
  }, [pendingSelect]);
  const handleSelectCandidate = useCallback((requirement: RequirementRecord) => {
    setCandidateSelectedId(requirement.id);
  }, []);
  const openCreateDialog = useCallback(() => setCreateOpen(true), []);
  const openBulkUpdateDialog = useCallback(() => setBulkUpdateOpen(true), []);
  const openBulkDeleteDialog = useCallback(() => setBulkDeleteOpen(true), []);
  const openBulkPasteDialog = useCallback(() => setBulkPasteOpen(true), []);
  const workspaceTabs = useMemo(
    () => (
      <TabsList
        variant="default"
        className={styles.workspaceTabsList}
        aria-label="需求工作台视图"
        data-active-tab={workbenchTab}
      >
        <TabsTrigger value="confirmed" className={styles.workspaceTab}>
          已确认需求
        </TabsTrigger>
        <TabsTrigger
          value="candidate"
          className={styles.workspaceTab}
          aria-label={`待确认需求，自动解析有 ${candidateCount} 个需求未确认`}
          onFocus={preloadCandidateSurface}
          onPointerDown={preloadCandidateSurface}
          onPointerEnter={preloadCandidateSurface}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={styles.workspaceTabLabel}>
                待确认需求
                <span className={styles.candidateOrb} aria-hidden>
                  {candidateCount}
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" hideWhenDetached>
              {candidateCount > 0
                ? `自动解析有 ${candidateCount} 个需求未确认`
                : "自动解析暂无待确认需求"}
            </TooltipContent>
          </Tooltip>
        </TabsTrigger>
      </TabsList>
    ),
    [candidateCount, workbenchTab],
  );

  const updateRequirement = updateMutation.mutateAsync;
  const parseSRS = parseMutation.mutateAsync;
  const changeCandidateStatus = candidateStatusMutation.mutateAsync;
  const cleanCandidateNames = bulkCleanNamesMutation.mutateAsync;
  const handleCreated = useCallback(
    (requirement: RequirementRecord, options: { focusTree: boolean }) => {
      setCreatedSignal({
        id: requirement.id,
        nonce: Date.now(),
        focusTree: options.focusTree,
      });
    },
    [],
  );
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
  const openRecycleBin = useCallback(() => setDeletedOpen(true), []);
  const openCandidateTab = useCallback(() => {
    setWorkbenchTab("candidate");
    setPanelsReady(true);
    preloadCandidateSurface();
    if (!candidateActivatedRef.current) {
      candidateActivatedRef.current = true;
      startCandidateTransition(() => setCandidateActivated(true));
    }
  }, [startCandidateTransition]);
  const handleRestoreMany = useCallback(
    async (requirementsToRestore: RequirementRecord[]) => {
      try {
        await bulkRestoreMutation.mutateAsync(requirementsToRestore.map((item) => item.id));
        openCandidateTab();
        setDeletedOpen(false);
      } catch {
        // 保持管理弹窗打开，由表格顶部错误提示展示失败原因。
      }
    },
    [bulkRestoreMutation, openCandidateTab],
  );
  const handleRestore = useCallback(
    async (requirement: RequirementRecord) => {
      try {
        await restoreMutation.mutateAsync(requirement);
        if (requirement.deletedFromStatus === "candidate") {
          openCandidateTab();
          setCandidateSelectedId(requirement.id);
        } else {
          setSelectedId(requirement.id);
        }
        setDeletedOpen(false);
      } catch {
        // 保持管理弹窗打开，由表格顶部错误提示展示失败原因。
      }
    },
    [restoreMutation, openCandidateTab],
  );
  const handleCopyDeleted = useCallback(
    async (requirement: RequirementRecord) => {
      try {
        const content = await requirementsApi.content(requirement.id);
        setCreateSeed({
          key: `copy-${requirement.id}`,
          values: buildRequirementCopySeed(
            { ...requirement, description: content.description },
            activeChapterRequirements,
          ),
        });
        setDeletedOpen(false);
        setCreateOpen(true);
      } catch {
        // 正文加载失败由 API 客户端展示错误提示。
      }
    },
    [activeChapterRequirements],
  );
  const handleCopyRequirement = useCallback(
    async (requirement: RequirementRecord, draft?: RequirementDraft) => {
      try {
        const description =
          draft?.description ?? (await requirementsApi.content(requirement.id)).description;
        const copySource = draft ? { ...draft, description } : { ...requirement, description };
        setCreateSeed({
          key: `copy-${requirement.id}`,
          values: buildRequirementCopySeed(
            { ...requirement, description },
            activeChapterRequirements,
            copySource,
          ),
        });
        setCreateOpen(true);
      } catch {
        // 正文加载失败由 API 客户端展示错误提示。
      }
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
  const handlePurgeMany = useCallback((requirements: RequirementRecord[], all: boolean) => {
    setPendingPurgeMany({ requirements, all });
  }, []);
  const submitPurgeMany = useCallback(
    async (reason: string) => {
      if (!pendingPurgeMany) return;

      try {
        await bulkPurgeMutation.mutateAsync({
          ids: pendingPurgeMany.all
            ? undefined
            : pendingPurgeMany.requirements.map((item) => item.id),
          all: pendingPurgeMany.all,
          reason,
        });
        setPendingPurgeMany(null);
      } catch {
        // 保持确认框打开，由 bulkPurgeMutation.error 展示失败原因。
      }
    },
    [bulkPurgeMutation, pendingPurgeMany],
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
    (sourceId: string, checked: boolean, requirementIds?: string[]) => {
      setSelectedIds((previous) => {
        const sourceRequirementIds = officialRequirements
          .filter(
            (requirement) =>
              requirement.sourceVersionId === sourceId &&
              (!requirementIds || requirementIds.includes(requirement.id)),
          )
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
  const submitBulkPaste = useCallback(
    async (payload: Parameters<typeof bulkCreateMutation.mutateAsync>[0]) => {
      await bulkCreateMutation.mutateAsync(payload);
      setBulkPasteOpen(false);
    },
    [bulkCreateMutation],
  );
  const saveCandidatePanelLayout = useCallback((layout: Record<string, number>) => {
    candidatePanelLayout = layout;
  }, []);
  const handleParseSRS = useCallback(
    async (sourceVersionId: string) => {
      try {
        return await parseSRS(sourceVersionId);
      } catch {
        return undefined;
      }
    },
    [parseSRS],
  );
  const handleCandidateConfirm = useCallback(
    async (ids: string[]) => {
      await changeCandidateStatus({ ids, action: "confirm" });
    },
    [changeCandidateStatus],
  );
  const handleCandidateExclude = useCallback(
    async (ids: string[], reason: string) => {
      await changeCandidateStatus({ ids, action: "exclude", reason });
    },
    [changeCandidateStatus],
  );
  const handleCandidateCleanNames = useCallback(
    async (ids: string[]) => {
      await cleanCandidateNames({ ids });
    },
    [cleanCandidateNames],
  );
  const handleCandidateUpdate = useCallback(
    async (id: string, payload: Omit<SaveRequirementPayload, "sourceVersionId">) =>
      updateRequirement({ id, payload }),
    [updateRequirement],
  );

  if (workbenchQuery.isPending) return <QueryLoading label="正在加载确认需求" rows={8} />;
  if (workbenchQuery.isError) {
    return <QueryError title="确认需求加载失败" onRetry={() => workbenchQuery.refetch()} />;
  }

  const tree = (
    <RequirementsTree
      projectId={project.id}
      sources={sources}
      requirements={requirements}
      toolbarTabs={workspaceTabs}
      selectedId={selectedRequirement?.id ?? ""}
      createdSignal={createdSignal}
      batchMode={batchMode}
      selectedIds={selectedIds}
      onSelect={handleSelectConfirmed}
      onCreate={openCreateDialog}
      onCopy={handleCopyRequirement}
      onDelete={handleDeleteRequest}
      onToggleBatchMode={toggleBatchMode}
      onToggleRequirement={toggleRequirementSelected}
      onToggleSource={toggleSourceSelected}
      onOpenBulkUpdate={openBulkUpdateDialog}
      onOpenBulkDelete={openBulkDeleteDialog}
      onClearSelection={clearSelection}
      onRegisterExitAnimation={registerTreeExitAnimation}
      naturalHeight={!wideLayout}
    />
  );
  const hero = (
    <RequirementsHero
      requirements={requirements}
      loading={workbenchQuery.isFetching}
      onOpenDeleted={openRecycleBin}
      onOpenBulkPaste={openBulkPasteDialog}
    />
  );
  const detail = detailRequirement ? (
    <RequirementDetail
      projectCode={project.id}
      requirement={detailRequirement}
      source={detailSource}
      onUpdate={handleUpdate}
      onDelete={handleDeleteRequest}
      onCopy={handleCopyRequirement}
      onBodyDirtyChange={handleBodyDirtyChange}
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
        projectId={project.id}
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
        onCreated={handleCreated}
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
        requirements={recycleBinRequirements}
        sources={sources}
        restoringId={restoreMutation.isPending ? (restoreMutation.variables?.id ?? "") : ""}
        bulkRestoring={bulkRestoreMutation.isPending}
        bulkRestoreError={bulkRestoreMutation.error}
        error={restoreMutation.error}
        purgingId={purgeMutation.isPending ? (purgeMutation.variables?.id ?? "") : ""}
        purgeError={purgeMutation.error}
        bulkPurging={bulkPurgeMutation.isPending}
        bulkPurgeError={bulkPurgeMutation.error}
        onOpenChange={(open) => {
          setDeletedOpen(open);
          if (!open) {
            restoreMutation.reset();
            bulkRestoreMutation.reset();
            purgeMutation.reset();
            bulkPurgeMutation.reset();
            setPendingPurge(null);
            setPendingPurgeMany(null);
          }
        }}
        onRestore={handleRestore}
        onRestoreMany={handleRestoreMany}
        onCopy={handleCopyDeleted}
        onShowAudit={setAuditRequirement}
        onPurge={setPendingPurge}
        onPurgeMany={handlePurgeMany}
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

  function renderDeletedPurgeDialog() {
    return (
      <DeletedRequirementsPurgeDialog
        key={`bulk-purge-${pendingPurgeMany?.all ? "all" : (pendingPurgeMany?.requirements.map((item) => item.id).join(",") ?? "none")}`}
        open={pendingPurgeMany !== null}
        requirements={pendingPurgeMany?.requirements ?? []}
        all={pendingPurgeMany?.all ?? false}
        submitting={bulkPurgeMutation.isPending}
        error={bulkPurgeMutation.error}
        onOpenChange={(open) => {
          if (!open) {
            bulkPurgeMutation.reset();
            setPendingPurgeMany(null);
          }
        }}
        onConfirm={submitPurgeMany}
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
        allRequirements={requirements}
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

  function renderBulkPasteDialog() {
    return (
      <RequirementBulkPasteDialog
        open={bulkPasteOpen}
        sources={sources}
        requirements={activeChapterRequirements}
        defaultSourceId={selectedSource?.id ?? ""}
        submitting={bulkCreateMutation.isPending}
        error={bulkCreateMutation.error}
        onOpenChange={(open) => {
          setBulkPasteOpen(open);
          if (!open) bulkCreateMutation.reset();
        }}
        onSubmit={submitBulkPaste}
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
          minSize="411px"
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

  const candidateSurface = wideLayout ? (
    <section className={styles.workbench}>
      <ResizablePanelGroup
        id="requirements-candidate-container-layout"
        defaultLayout={candidatePanelLayout}
        onLayoutChanged={saveCandidatePanelLayout}
        resizeTargetMinimumSize={{ coarse: 36, fine: 24 }}
      >
        <ResizablePanel
          id="requirements-candidate-tree-panel"
          className={styles.panelFrame}
          defaultSize={380}
          minSize="411px"
          maxSize="680px"
        >
          <LazyRequirementsCandidateTree
            sources={sources}
            sections={sections}
            requirements={requirements}
            toolbarTabs={workspaceTabs}
            selectedId={candidateSelectedId}
            onSelect={handleSelectCandidate}
            excludedCount={excludedCandidateCount}
            onOpenRecycleBin={openRecycleBin}
            naturalHeight={false}
          />
        </ResizablePanel>
        <ResizableHandle
          id="requirements-candidate-tree-handle"
          aria-label="调整待确认需求目录宽度"
        />
        <ResizablePanel id="requirements-candidate-right-panel" className={styles.panelFrame}>
          <LazyRequirementsCandidateWorkbench
            projectId={project.id}
            sources={sources}
            requirements={requirements}
            selectedId={candidateSelectedId}
            onSelect={handleSelectCandidate}
            parsePending={parseMutation.isPending}
            statusPending={candidateStatusMutation.isPending}
            updatePending={updateMutation.isPending}
            onParse={handleParseSRS}
            onConfirm={handleCandidateConfirm}
            onExclude={handleCandidateExclude}
            cleanNamesPending={bulkCleanNamesMutation.isPending}
            onCleanNames={handleCandidateCleanNames}
            onUpdate={handleCandidateUpdate}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </section>
  ) : (
    <section className={styles.workbench}>
      <LazyRequirementsCandidateTree
        sources={sources}
        sections={sections}
        requirements={requirements}
        toolbarTabs={workspaceTabs}
        selectedId={candidateSelectedId}
        onSelect={handleSelectCandidate}
        excludedCount={excludedCandidateCount}
        onOpenRecycleBin={openRecycleBin}
        naturalHeight
      />
      <LazyRequirementsCandidateWorkbench
        projectId={project.id}
        sources={sources}
        requirements={requirements}
        selectedId={candidateSelectedId}
        onSelect={handleSelectCandidate}
        parsePending={parseMutation.isPending}
        statusPending={candidateStatusMutation.isPending}
        updatePending={updateMutation.isPending}
        onParse={handleParseSRS}
        onConfirm={handleCandidateConfirm}
        onExclude={handleCandidateExclude}
        cleanNamesPending={bulkCleanNamesMutation.isPending}
        onCleanNames={handleCandidateCleanNames}
        onUpdate={handleCandidateUpdate}
      />
    </section>
  );

  return (
    <>
      <Tabs
        className={styles.tabs}
        data-panels-ready={panelsReady ? "true" : undefined}
        value={workbenchTab}
        onValueChange={(value) => {
          if (value === "candidate") openCandidateTab();
          else setWorkbenchTab(value as WorkbenchTab);
        }}
      >
        <TabsContent
          value="confirmed"
          className={styles.tabContent}
          forceMount
          inert={workbenchTab !== "confirmed" ? true : undefined}
        >
          {surface}
        </TabsContent>
        <TabsContent
          value="candidate"
          className={styles.tabContent}
          forceMount
          inert={workbenchTab !== "candidate" ? true : undefined}
        >
          <LazyChunkBoundary errorTitle="待确认需求加载失败">
            <Suspense fallback={<QueryLoading label="正在加载待确认需求" rows={6} />}>
              {candidateActivated && !isCandidatePending ? (
                candidateSurface
              ) : (
                <QueryLoading label="正在加载待确认需求" rows={6} />
              )}
            </Suspense>
          </LazyChunkBoundary>
        </TabsContent>
      </Tabs>
      {renderCreateDialog()}
      {renderDeleteDialog()}
      {renderDeletedDialog()}
      {renderDeletedPurgeDialog()}
      {renderAuditDialog()}
      {renderPurgeDialog()}
      {renderBulkUpdateDialog()}
      {renderBulkDeleteDialog()}
      {renderBulkPasteDialog()}
      <AlertDialog
        open={Boolean(pendingSelect)}
        onOpenChange={(open) => {
          if (!open) setPendingSelect(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>正文尚未保存</AlertDialogTitle>
            <AlertDialogDescription>
              当前“测试项的需求描述”有未保存修改，切换需求后会丢失这些修改。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPendingSelect}>放弃修改并切换</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    // 动态导入模块变更时不要保留旧 lazy 引用，直接整页失效重载。
    import.meta.hot?.invalidate();
  });
}
