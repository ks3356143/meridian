import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FolderPlus, ListChecks, Plus, Rows3 } from "lucide-react";
import type { TreeApi } from "react-arborist";
import { toast } from "sonner";
import { QueryError, QueryLoading } from "@/components/shared/query-state";
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
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import type {
  CreateTestItemPayload,
  UpdateSubItemPayload,
  UpdateTestItemPayload,
} from "@/features/test-items/api";
import type { Project } from "../../../types";
import { ChangeItemTypeDialog } from "./test-item-change-type-dialog";
import { CreateFolderDialog, CreateTestItemDialog } from "./test-item-create-dialog";
import { TestItemDetailPanel } from "./test-item-detail";
import { TestItemsTree } from "./test-items-tree";
import {
  buildTestItemsTree,
  platformApplies,
  type TestItemsTreeNode,
} from "./test-items-tree-model";
import { useTestItemsWorkbench } from "./use-test-items-workbench";
import styles from "./test-items-workbench.module.css";

let treePanelLayout: Record<string, number> | undefined;

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

export function TestItemsWorkbench({ project }: { project: Project }) {
  const {
    workbenchQuery,
    detailQuery,
    selectedId,
    setSelectedId,
    createItemMutation,
    updateItemMutation,
    deleteItemMutation,
    createFolderMutation,
    linkMutation,
    unlinkMutation,
    createSubItemMutation,
    updateSubItemMutation,
    deleteSubItemMutation,
    duplicateSubItemMutation,
    moveSubItemMutation,
    createCaseMutation,
  } = useTestItemsWorkbench(project);
  const wideLayout = useWideLayout();
  const treeRef = useRef<TreeApi<TestItemsTreeNode>>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [changeTypeOpen, setChangeTypeOpen] = useState(false);

  const workspace = workbenchQuery.data;
  const activeTypes = useMemo(
    () =>
      (workspace?.types ?? [])
        .filter((type) => type.isEnabled && platformApplies(type.platformScope, project.platform))
        .sort((left, right) => left.outputOrder - right.outputOrder),
    [project.platform, workspace?.types],
  );
  const treeNodes = useMemo(
    () => (workspace ? buildTestItemsTree(workspace, project.platform) : []),
    [project.platform, workspace],
  );
  // DC/SA/CR/CW 每轮各一个：已存在的静态类型不再出现在新增选项里。
  const usedStaticCodes = useMemo(() => {
    const staticCodes = new Set(
      activeTypes.filter((type) => type.isStatic).map((type) => type.code),
    );
    return [
      ...new Set(
        (workspace?.items ?? [])
          .map((item) => item.typeCode)
          .filter((code) => staticCodes.has(code)),
      ),
    ];
  }, [activeTypes, workspace?.items]);

  useEffect(() => {
    if (selectedId !== "" || treeNodes.length === 0) return;
    const firstItem = workspace?.items[0];
    if (firstItem) setSelectedId(firstItem.id);
  }, [selectedId, setSelectedId, treeNodes.length, workspace?.items]);

  const detail = detailQuery.data;
  // 详情面板是重子树（表格 + 子项卡片），树的选择、弹窗开关、面板拖拽都会让工作区重渲染；
  // 回调保持稳定引用 + 面板 memo，才能让这些无关重渲染不落到详情树上。
  const selectedItemId = detail?.item.id ?? "";
  const handleSelectNode = useCallback(
    (node: TestItemsTreeNode) => {
      if (node.kind === "item" && node.refId) setSelectedId(node.refId);
    },
    [setSelectedId],
  );
  const handlePatch = useCallback(
    (payload: UpdateTestItemPayload) =>
      updateItemMutation.mutateAsync({ id: selectedItemId, payload }),
    [selectedItemId, updateItemMutation],
  );
  const handleLink = useCallback(
    (requirementId: string) =>
      linkMutation.mutateAsync({ testItemId: selectedItemId, requirementId }),
    [linkMutation, selectedItemId],
  );
  const handleUnlink = useCallback(
    (requirementId: string) =>
      unlinkMutation.mutateAsync({ testItemId: selectedItemId, requirementId }),
    [selectedItemId, unlinkMutation],
  );
  const handleCreateSubItem = useCallback(
    (name: string) => createSubItemMutation.mutateAsync({ testItemId: selectedItemId, name }),
    [createSubItemMutation, selectedItemId],
  );
  const handleUpdateSubItem = useCallback(
    (id: string, payload: UpdateSubItemPayload) =>
      updateSubItemMutation.mutateAsync({ id, payload }),
    [updateSubItemMutation],
  );
  const handleDeleteSubItem = useCallback(
    (id: string) => deleteSubItemMutation.mutateAsync({ testItemId: selectedItemId, id }),
    [deleteSubItemMutation, selectedItemId],
  );
  const handleDuplicateSubItem = useCallback(
    (id: string) => duplicateSubItemMutation.mutateAsync({ testItemId: selectedItemId, id }),
    [duplicateSubItemMutation, selectedItemId],
  );
  const handleMoveSubItem = useCallback(
    (id: string, targetIndex: number) =>
      moveSubItemMutation.mutateAsync({ testItemId: selectedItemId, id, targetIndex }),
    [moveSubItemMutation, selectedItemId],
  );
  const handleCreateCase = useCallback(
    (name: string) => createCaseMutation.mutateAsync({ testItemId: selectedItemId, name }),
    [createCaseMutation, selectedItemId],
  );
  const handleOpenChangeType = useCallback(() => setChangeTypeOpen(true), []);
  const handleOpenDelete = useCallback(() => setDeleteOpen(true), []);
  const changeTypeCaseCount = useMemo(
    () =>
      detail
        ? (workspace?.cases ?? []).filter((record) => record.testItemId === detail.item.id).length
        : 0,
    [detail, workspace?.cases],
  );

  if (workbenchQuery.isPending) {
    return <QueryLoading label="正在加载测试项" rows={8} />;
  }
  if (workbenchQuery.isError || !workspace) {
    return (
      <QueryError
        title="测试项加载失败"
        description="无法读取测试项工作台数据。"
        onRetry={() => void workbenchQuery.refetch()}
      />
    );
  }

  const selectedItem = detail?.item;
  const folderName = selectedItem?.folderId
    ? (workspace.folders.find((folder) => folder.id === selectedItem.folderId)?.name ?? "")
    : "";

  const handleChangeType = async (typeCode: string) => {
    if (!detail) return;
    try {
      const updated = await updateItemMutation.mutateAsync({
        id: detail.item.id,
        payload: { typeCode },
      });
      setChangeTypeOpen(false);
      treeRef.current?.open(`group:${updated.typeCode}`);
      toast.success(`类型已改为 ${updated.typeCode}，标识 ${updated.identifier}`);
    } catch {
      // 失败原因由 api client 统一 toast，这里保持弹窗打开让用户改选或取消。
    }
  };

  const handleCreate = async (payload: CreateTestItemPayload) => {
    const created = await createItemMutation.mutateAsync(payload);
    treeRef.current?.open(`group:${created.typeCode}`);
    setSelectedId(created.id);
    return created;
  };

  const treePane = (
    <aside className={styles.treePane}>
      <div className={styles.toolbar}>
        <Button size="sm" className={styles.createButton} onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden />
          新增测试项
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={styles.folderButton}
          onClick={() => setFolderOpen(true)}
        >
          <FolderPlus aria-hidden />
          新建文件夹
        </Button>
        <span className={styles.roundChip}>{workspace.round.name}</span>
      </div>
      <div className={styles.toolbarMeta}>
        <span className={styles.metaChip} data-tone="blue">
          <ListChecks aria-hidden />
          测试项 {workspace.items.length}
        </span>
        <span className={styles.metaChip} data-tone="green">
          <Rows3 aria-hidden />
          用例 {workspace.cases.length}
        </span>
        {usedStaticCodes.length > 0 ? (
          <span className={styles.metaChip} data-tone="amber">
            静态 {usedStaticCodes.join("/")} 已建
          </span>
        ) : null}
      </div>
      <div className={styles.treeBody}>
        {treeNodes.length === 0 ? (
          <div className={styles.emptyGuide}>
            <p className={styles.emptyTitle}>还没有测试项</p>
            <p className={styles.emptyText}>
              从类型开始建第一条测试项，充分性要求与通过准则会按类型自动预填。
            </p>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              新增测试项
            </Button>
          </div>
        ) : (
          <TestItemsTree
            nodes={treeNodes}
            storageKey={`cm:test-items-tree:${project.id}`}
            selectedId={selectedId}
            treeRef={treeRef}
            onSelect={handleSelectNode}
          />
        )}
      </div>
    </aside>
  );

  const detailPane = (
    <div className={styles.detailPane}>
      {selectedId === "" ? (
        <div className={styles.detailEmpty}>
          <p className={styles.emptyTitle}>选择左侧测试项</p>
          <p className={styles.emptyText}>点击树中的测试项查看并就地编辑字段。</p>
        </div>
      ) : detailQuery.isPending ? (
        <QueryLoading label="正在加载测试项详情" rows={6} />
      ) : detailQuery.isError || !detail ? (
        <QueryError
          title="测试项详情加载失败"
          description="无法读取该测试项的字段与用例。"
          onRetry={() => void detailQuery.refetch()}
        />
      ) : (
        <div className={styles.detailAnimated}>
          <TestItemDetailPanel
            detail={detail}
            type={activeTypes.find((type) => type.code === detail.item.typeCode)}
            round={workspace.round}
            folderName={folderName}
            platform={project.platform}
            projectId={project.id}
            onPatch={handlePatch}
            onLink={handleLink}
            onUnlink={handleUnlink}
            onChangeType={handleOpenChangeType}
            onCreateSubItem={handleCreateSubItem}
            onUpdateSubItem={handleUpdateSubItem}
            onDeleteSubItem={handleDeleteSubItem}
            onDuplicateSubItem={handleDuplicateSubItem}
            onMoveSubItem={handleMoveSubItem}
            onCreateCase={handleCreateCase}
            onRequestDelete={handleOpenDelete}
          />
        </div>
      )}
    </div>
  );

  return (
    <section className={styles.workbench}>
      {wideLayout ? (
        <ResizablePanelGroup
          id="test-items-container-layout"
          defaultLayout={treePanelLayout}
          onLayoutChanged={(layout) => {
            treePanelLayout = layout;
          }}
          resizeTargetMinimumSize={{ coarse: 36, fine: 24 }}
        >
          <ResizablePanel
            id="test-items-tree-panel"
            className={styles.panelFrame}
            defaultSize={380}
            minSize="411px"
            maxSize="680px"
          >
            {treePane}
          </ResizablePanel>
          <ResizableHandle id="test-items-tree-handle" aria-label="调整测试项目录宽度" />
          <ResizablePanel id="test-items-right-panel" className={styles.panelFrame}>
            {detailPane}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <>
          {treePane}
          {detailPane}
        </>
      )}

      {detail ? (
        <ChangeItemTypeDialog
          open={changeTypeOpen}
          item={detail.item}
          types={activeTypes}
          usedStaticCodes={usedStaticCodes}
          caseCount={changeTypeCaseCount}
          folderName={folderName}
          submitting={updateItemMutation.isPending}
          onOpenChange={setChangeTypeOpen}
          onSubmit={handleChangeType}
        />
      ) : null}
      <CreateTestItemDialog
        open={createOpen}
        types={activeTypes}
        folders={workspace.folders}
        usedStaticCodes={usedStaticCodes}
        submitting={createItemMutation.isPending}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
      />
      <CreateFolderDialog
        open={folderOpen}
        types={activeTypes}
        folders={workspace.folders}
        submitting={createFolderMutation.isPending}
        onOpenChange={setFolderOpen}
        onSubmit={(payload) => createFolderMutation.mutateAsync(payload)}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除测试项「{selectedItem?.name}」？</AlertDialogTitle>
            <AlertDialogDescription>
              将级联删除该测试项的子项、用例与步骤，需求关联同时解除；此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className={styles.dangerAction}
              onClick={() => {
                if (selectedItem) void deleteItemMutation.mutateAsync(selectedItem.id);
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
