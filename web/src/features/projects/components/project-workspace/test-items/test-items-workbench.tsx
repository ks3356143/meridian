import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  FolderPlus,
  ListChecks,
  ListPlus,
  Plus,
  Rows3,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMediaQuery } from "@/hooks/use-media-query";
import type {
  BatchAssignCasesPayload,
  CreateTestItemPayload,
  UpdateCasePayload,
  UpdateSubItemPayload,
  UpdateTestItemPayload,
} from "@/features/test-items/api";
import { testItemsApi } from "@/features/test-items/api";
import type { TestCaseRecord, TestCaseSearchHit } from "@/features/test-items/types";
import type { Project } from "../../../types";
import { ChangeItemTypeDialog } from "./test-item-change-type-dialog";
import { CreateFolderDialog, CreateTestItemDialog } from "./test-item-create-dialog";
import { TestCasePanel } from "./test-case-panel";
import { TestItemsFromRequirementsDialog } from "./test-items-from-requirements-dialog";
import { TestItemDetailPanel } from "./test-item-detail";
import { TestItemsTree, type TestItemsTreeAction, type TestItemsTreeMove } from "./test-items-tree";
import {
  buildTestItemsTree,
  filterTestItemsTree,
  startInlineRename,
  platformApplies,
  type TestItemsQuickFilter,
  type TestItemsTreeNode,
} from "./test-items-tree-model";
import { useTestItemsWorkbench } from "./use-test-items-workbench";
import styles from "./test-items-workbench.module.css";

let treePanelLayout: Record<string, number> | undefined;

// 稳定引用：detail 未就绪时 siblingCases 用同一空数组，避免切用例监听见步重挂（props 默认值 hoist）。
const EMPTY_CASES: TestCaseRecord[] = [];

/** 树里的删除都是破坏性动作：统一走二次确认，确认文案按节点类型区分。 */
type PendingDelete =
  | { kind: "item"; id: string; label: string }
  | { kind: "folder"; id: string; label: string; count: number }
  | { kind: "case"; id: string; testItemId: string; label: string };

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
    duplicateItemMutation,
    updateFolderMutation,
    deleteFolderMutation,
    updateCaseMutation,
    invalidateCaseData,
    duplicateCaseMutation,
    copyCaseMutation,
    batchAssignCasesMutation,
    deleteCaseMutation,
    moveItemMutation,
    moveCaseMutation,
    ensureStaticItemsMutation,
    deleteStaticItemsMutation,
  } = useTestItemsWorkbench(project);
  const wideLayout = useMediaQuery("(min-width: 1321px)");
  const treeRef = useRef<TreeApi<TestItemsTreeNode>>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  const [staticDeleteOpen, setStaticDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [changeTypeOpen, setChangeTypeOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [stepFocus, setStepFocus] = useState<{ stepId: string; nonce: number } | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<TestItemsQuickFilter>("all");

  // 150ms 防抖：逐键过滤会重算整棵过滤树，防抖后再提交（老项目同口径）。
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchInput), 150);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

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
  const searchActive = searchQuery.trim() !== "" || quickFilter !== "all";
  const staticItemCount = workspace
    ? workspace.items.filter(
        (item) => activeTypes.find((type) => type.code === item.typeCode)?.isStatic,
      ).length
    : 0;
  const filteredTree = useMemo(
    () => filterTestItemsTree(treeNodes, searchQuery, quickFilter),
    [treeNodes, searchQuery, quickFilter],
  );
  // 快捷筛选计数（未完善 / 有失败）：走一遍完整树，与树徽章同口径。
  const quickCounts = useMemo(() => {
    let incomplete = 0;
    let failed = 0;
    const walk = (list: TestItemsTreeNode[]) => {
      for (const node of list) {
        if (node.kind === "item") {
          if (node.incomplete) incomplete += 1;
          if ((node.children ?? []).some((child) => child.status === "failed")) failed += 1;
        }
        if (node.children && node.children.length > 0) walk(node.children);
      }
    };
    walk(treeNodes);
    return { incomplete, failed };
  }, [treeNodes]);
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
  // useMutation 的 mutate/mutateAsync 引用稳定，但外层对象每次渲染都会重建；memo 面板要求回调引用稳定，
  // 这里把要用的方法抽成别名，依赖数组里只放别名（见 srs/21）。
  const duplicateCase = duplicateCaseMutation.mutate;
  const copyCase = copyCaseMutation.mutate;
  const batchAssignCases = batchAssignCasesMutation.mutateAsync;
  const patchItem = updateItemMutation.mutateAsync;
  const renameItem = updateItemMutation.mutate;
  const linkRequirement = linkMutation.mutateAsync;
  const unlinkRequirement = unlinkMutation.mutateAsync;
  const createSubItem = createSubItemMutation.mutateAsync;
  const updateSubItem = updateSubItemMutation.mutateAsync;
  const removeSubItem = deleteSubItemMutation.mutateAsync;
  const duplicateSubItem = duplicateSubItemMutation.mutateAsync;
  const moveSubItem = moveSubItemMutation.mutateAsync;
  const createCase = createCaseMutation.mutateAsync;
  const generateCase = createCaseMutation.mutate;
  const moveItem = moveItemMutation.mutate;
  const moveCase = moveCaseMutation.mutate;
  const renameFolder = updateFolderMutation.mutate;
  const renameCase = updateCaseMutation.mutate;
  const patchCase = updateCaseMutation.mutateAsync;
  const duplicateItem = duplicateItemMutation.mutate;
  const handleBackToItem = useCallback(() => {
    setSelectedCaseId("");
    setStepFocus(null);
  }, []);
  const handlePatchCase = useCallback(
    (payload: UpdateCasePayload) => patchCase({ id: selectedCaseId, payload }),
    [patchCase, selectedCaseId],
  );
  const handleBatchAssign = useCallback(
    (caseIds: string[], payload: Omit<BatchAssignCasesPayload, "caseIds">) =>
      batchAssignCases({ testItemId: selectedItemId, caseIds, payload }),
    [batchAssignCases, selectedItemId],
  );

  const handleSelectNode = useCallback(
    (node: TestItemsTreeNode) => {
      if (node.kind === "item" && node.refId) {
        setSelectedId(node.refId);
        setSelectedCaseId("");
        setStepFocus(null);
      }
      if (node.kind === "case" && node.refId) {
        setSelectedCaseId(node.refId);
        setStepFocus(null);
        // 选中用例同时把父测试项设为当前项：面板「返回测试项」才有落点。
        if (node.itemId) setSelectedId(node.itemId);
      }
    },
    [setSelectedId],
  );
  /** 详情用例行 → 树：展开所属测试项、滚动并在树里高亮该用例。 */
  const handleSelectCase = useCallback((caseId: string) => {
    setSelectedCaseId(caseId);
    setStepFocus(null);
    const tree = treeRef.current;
    if (!tree) return;
    tree.openParents(`case:${caseId}`);
    void tree.scrollTo(`case:${caseId}`);
  }, []);

  /** 测试项内查找命中：打开用例；步骤命中同时滚动并高亮目标行。 */
  const handleOpenSearchHit = useCallback((hit: TestCaseSearchHit) => {
    setSelectedCaseId(hit.caseId);
    setStepFocus(hit.stepId ? { stepId: hit.stepId, nonce: Date.now() } : null);
    const tree = treeRef.current;
    if (!tree) return;
    tree.openParents(`case:${hit.caseId}`);
    void tree.scrollTo(`case:${hit.caseId}`);
  }, []);
  const handleDuplicateCase = useCallback(
    (caseId: string) => {
      if (!selectedItemId) return;
      duplicateCase({ testItemId: selectedItemId, id: caseId });
    },
    [duplicateCase, selectedItemId],
  );
  const handlePatch = useCallback(
    (payload: UpdateTestItemPayload) => patchItem({ id: selectedItemId, payload }),
    [selectedItemId, patchItem],
  );
  const handleLink = useCallback(
    (requirementId: string) => linkRequirement({ testItemId: selectedItemId, requirementId }),
    [linkRequirement, selectedItemId],
  );
  const handleUnlink = useCallback(
    (requirementId: string) => unlinkRequirement({ testItemId: selectedItemId, requirementId }),
    [selectedItemId, unlinkRequirement],
  );
  const handleCreateSubItem = useCallback(
    (name: string) => createSubItem({ testItemId: selectedItemId, name }),
    [createSubItem, selectedItemId],
  );
  const handleUpdateSubItem = useCallback(
    (id: string, payload: UpdateSubItemPayload) => updateSubItem({ id, payload }),
    [updateSubItem],
  );
  const handleDeleteSubItem = useCallback(
    (id: string) => removeSubItem({ testItemId: selectedItemId, id }),
    [removeSubItem, selectedItemId],
  );
  const handleDuplicateSubItem = useCallback(
    (id: string) => duplicateSubItem({ testItemId: selectedItemId, id }),
    [duplicateSubItem, selectedItemId],
  );
  const handleMoveSubItem = useCallback(
    (id: string, targetIndex: number) =>
      moveSubItem({ testItemId: selectedItemId, id, targetIndex }),
    [moveSubItem, selectedItemId],
  );
  const handleCreateCase = useCallback(
    (name: string) => createCase({ testItemId: selectedItemId, name }),
    [createCase, selectedItemId],
  );
  /** 树右键「生成用例」：按 1:1 约定取该测试项第一个子项命名（未选中时先拉一次详情）。 */
  const generateCaseForItem = useCallback(
    async (testItemId: string) => {
      const source =
        testItemId === selectedItemId && detailQuery.data
          ? detailQuery.data
          : await testItemsApi.detail(testItemId);
      const name = source?.subItems[0]?.name ?? "";
      if (name === "") {
        toast.error("该测试项还没有子项：先在「测试方法」里建子项，再生成用例");
        return;
      }
      generateCase({ testItemId, name });
    },
    [generateCase, detailQuery.data, selectedItemId],
  );
  const handleOpenChangeType = useCallback(() => setChangeTypeOpen(true), []);
  const handleOpenDelete = useCallback(() => {
    if (!detail) return;
    setPendingDelete({ kind: "item", id: detail.item.id, label: detail.item.name });
  }, [detail]);
  const handleTreeMove = useCallback(
    (move: TestItemsTreeMove) => {
      const dragId = move.dragIds[0];
      if (!dragId || !move.parentId) return;
      if (dragId.startsWith("item:")) {
        const id = dragId.slice(5);
        if (!move.parentId.startsWith("folder:") && !move.parentId.startsWith("group:")) return;
        const folderId = move.parentId.startsWith("folder:") ? move.parentId.slice(7) : null;
        // 分组子节点是「文件夹在前、类型根测试项在后」：把落点序号折算成根测试项序号。
        let targetIndex = move.index;
        if (folderId === null) {
          const typeCode = move.parentId.slice(6);
          const folderCount = (workspace?.folders ?? []).filter(
            (folder) => folder.typeCode === typeCode,
          ).length;
          targetIndex = Math.max(0, move.index - folderCount);
        }
        moveItem({ id, folderId, targetIndex });
        return;
      }
      if (dragId.startsWith("case:") && move.parentId.startsWith("item:")) {
        const variables = {
          id: dragId.slice(5),
          targetItemId: move.parentId.slice(5),
          targetIndex: move.index,
        };
        if (move.copy) copyCase(variables);
        else moveCase(variables);
      }
    },
    [copyCase, moveCase, moveItem, workspace?.folders],
  );
  const handleRenameNode = useCallback(
    (node: TestItemsTreeNode, name: string) => {
      if (!node.refId) return;
      if (node.kind === "folder") renameFolder({ id: node.refId, name });
      else if (node.kind === "item") renameItem({ id: node.refId, payload: { name } });
      else if (node.kind === "case") {
        renameCase({ id: node.refId, payload: { name } });
      }
    },
    [renameCase, renameFolder, renameItem],
  );
  const handleTreeAction = useCallback(
    (node: TestItemsTreeNode, action: TestItemsTreeAction) => {
      if (!node.refId) return;
      if (action === "duplicate") {
        if (node.kind === "item") {
          if (node.isStatic) {
            toast.info("静态测试项不支持复制新增");
            return;
          }
          duplicateItem(node.refId);
        } else if (node.kind === "case" && node.itemId) {
          duplicateCase({ testItemId: node.itemId, id: node.refId });
        }
        return;
      }
      if (action === "generateCase") {
        void generateCaseForItem(node.refId);
        return;
      }
      if (node.kind === "item") {
        setPendingDelete({ kind: "item", id: node.refId, label: node.label });
      } else if (node.kind === "folder") {
        setPendingDelete({
          kind: "folder",
          id: node.refId,
          label: node.label,
          count: node.count ?? 0,
        });
      } else if (node.kind === "case" && node.itemId) {
        setPendingDelete({
          kind: "case",
          id: node.refId,
          testItemId: node.itemId,
          label: node.label,
        });
      }
    },
    [duplicateCase, duplicateItem, generateCaseForItem],
  );
  const changeTypeCaseCount = useMemo(
    () =>
      detail
        ? (workspace?.cases ?? []).filter((record) => record.testItemId === detail.item.id).length
        : 0,
    [detail, workspace?.cases],
  );

  // 键盘流：F2 重命名 / Delete 删除（二次确认）/ Ctrl+D 复制新增，作用于树里获得焦点的节点。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // 快捷键只在树获得焦点时生效，避免在详情按钮/空白处按 Delete 误删树节点。
      if (!target?.closest('[role="tree"]')) return;
      const node = treeRef.current?.focusedNode;
      if (!node || node.data.kind === "group") return;
      if (target.closest("input, textarea") || target.isContentEditable) return;
      if (event.key === "F2") {
        event.preventDefault();
        void startInlineRename(node, handleRenameNode);
      } else if (event.key === "Delete") {
        event.preventDefault();
        handleTreeAction(node.data, "delete");
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        handleTreeAction(node.data, "duplicate");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleRenameNode, handleTreeAction]);

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
  // 用例详情（切片 5a）：用例数据取自工作台缓存，父测试项从用例反查。
  const activeCase = selectedCaseId
    ? (workspace.cases.find((record) => record.id === selectedCaseId) ?? null)
    : null;
  const activeCaseItem = activeCase
    ? (workspace.items.find((item) => item.id === activeCase.testItemId) ?? null)
    : null;
  // 追踪关系继承所属测试项：详情可能还是上一项的占位（keepPreviousData），只认 ID 对得上的那次；静态项按测试项口径不显示该行。
  const detailMatchesCaseItem = Boolean(
    detail && activeCaseItem && detail.item.id === activeCaseItem.id,
  );
  const caseRequirements =
    detailMatchesCaseItem &&
    activeCaseItem &&
    !activeTypes.find((type) => type.code === activeCaseItem.typeCode)?.isStatic
      ? (detail?.requirements ?? null)
      : null;
  // 详情占位数据期间不把上一项的用例列表交给切用例快捷键。
  const siblingCases = detailMatchesCaseItem ? (detail?.cases ?? EMPTY_CASES) : EMPTY_CASES;
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              className={styles.requirementButton}
              aria-label="从已确认需求创建测试项"
              onClick={() => setRequirementsOpen(true)}
            >
              <ListPlus aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">从已确认需求创建测试项</TooltipContent>
        </Tooltip>
        <Button
          size="sm"
          variant="outline"
          className={styles.folderButton}
          onClick={() => setFolderOpen(true)}
        >
          <FolderPlus aria-hidden />
          新建文件夹
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="补齐推荐静态测试项"
              disabled={ensureStaticItemsMutation.isPending}
              onClick={() => ensureStaticItemsMutation.mutate()}
            >
              <Sparkles aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">按安全等级补齐静态测试项</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="删除全部静态测试项"
              disabled={staticItemCount === 0}
              onClick={() => setStaticDeleteOpen(true)}
            >
              <Trash2 aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">删除全部静态测试项</TooltipContent>
        </Tooltip>
        <span className={styles.roundChip}>{workspace.round.name}</span>
      </div>
      <div className={styles.searchRow}>
        <div className={styles.searchField}>
          <Search className={styles.searchGlyph} aria-hidden />
          <Input
            className={styles.searchInput}
            value={searchInput}
            placeholder="搜索名称 / 标识 / 子项 / YL_ID"
            aria-label="搜索测试项"
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && searchInput !== "") {
                event.preventDefault();
                setSearchInput("");
              }
            }}
          />
          {searchInput !== "" ? (
            <button
              type="button"
              className={styles.searchClear}
              aria-label="清空搜索"
              onClick={() => setSearchInput("")}
            >
              <X aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      <div className={styles.filterRow}>
        {(
          [
            { value: "all", label: "全部" },
            { value: "incomplete", label: "未完善", count: quickCounts.incomplete },
            { value: "failed", label: "有失败", count: quickCounts.failed },
          ] as const
        ).map((option) => (
          <Button
            key={option.value}
            type="button"
            size="xs"
            variant="outline"
            className={styles.quickChip}
            data-active={quickFilter === option.value ? "true" : undefined}
            aria-pressed={quickFilter === option.value}
            onClick={() => setQuickFilter(option.value)}
          >
            {option.label}
            {"count" in option ? (
              <span className={styles.quickChipCount}>{option.count}</span>
            ) : null}
          </Button>
        ))}
        <div className={styles.treeActions}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={styles.treeActionButton}
                aria-label="展开全部"
                onClick={() => treeRef.current?.openAll()}
              >
                <ChevronsUpDown aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">展开全部</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={styles.treeActionButton}
                aria-label="收起全部"
                onClick={() => treeRef.current?.closeAll()}
              >
                <ChevronsDownUp aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">收起全部</TooltipContent>
          </Tooltip>
        </div>
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
        ) : searchActive && filteredTree.nodes.length === 0 ? (
          <div className={styles.emptyResult}>
            <p>没有匹配的测试项或用例</p>
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setSearchInput("");
                setQuickFilter("all");
              }}
            >
              清除搜索与筛选
            </Button>
          </div>
        ) : (
          <TestItemsTree
            nodes={filteredTree.nodes}
            storageKey={`cm:test-items-tree:${project.id}`}
            selectedId={selectedId}
            selectedCaseId={selectedCaseId}
            treeRef={treeRef}
            forceExpanded={searchActive}
            onSelect={handleSelectNode}
            onAction={handleTreeAction}
            onRenameNode={handleRenameNode}
            onMoveNode={handleTreeMove}
          />
        )}
      </div>
      {searchActive ? (
        <div className={styles.treeFooter}>
          显示 {filteredTree.itemMatches} 项 · {filteredTree.caseMatches} 用例
        </div>
      ) : null}
    </aside>
  );

  const detailPane = (
    <div className={styles.detailPane}>
      {activeCase && activeCaseItem ? (
        <div className={styles.detailAnimated}>
          {/* 切换用例重建面板：撤销栈与内部编辑态必须跟着实体清空。 */}
          <TestCasePanel
            key={activeCase.id}
            item={activeCaseItem}
            caseRecord={activeCase}
            requirements={caseRequirements}
            members={project.members}
            projectCode={project.id}
            siblingCases={siblingCases}
            onSelectSibling={handleSelectCase}
            onBack={handleBackToItem}
            onPatchCase={handlePatchCase}
            onCaseChanged={invalidateCaseData}
            focusStep={stepFocus}
          />
        </div>
      ) : workspace.items.length === 0 ? (
        <div className={styles.detailEmpty}>
          <p className={styles.emptyTitle}>还没有测试项</p>
          <p className={styles.emptyText}>先新增测试项，再在这里填写字段。</p>
        </div>
      ) : selectedId === "" ? (
        <div className={styles.detailEmpty}>
          <p className={styles.emptyTitle}>选择测试项</p>
          <p className={styles.emptyText}>在测试项树中选择后查看并就地编辑字段。</p>
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
        // 占位数据（placeholderData）期间面板不可交互：避免把上一项的字段写到刚选中的测试项上。
        <div
          className={styles.detailAnimated}
          data-stale={detailQuery.isPlaceholderData ? "true" : undefined}
          aria-busy={detailQuery.isPlaceholderData || undefined}
        >
          <TestItemDetailPanel
            key={detail.item.id}
            detail={detail}
            type={activeTypes.find((type) => type.code === detail.item.typeCode)}
            round={workspace.round}
            folderName={folderName}
            platform={project.platform}
            projectId={project.id}
            members={project.members}
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
            activeCaseId={selectedCaseId}
            onSelectCase={handleSelectCase}
            onDuplicateCase={handleDuplicateCase}
            onBatchAssign={handleBatchAssign}
            onOpenSearchHit={handleOpenSearchHit}
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
            minSize="380px"
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
      <TestItemsFromRequirementsDialog
        open={requirementsOpen}
        projectCode={project.id}
        onOpenChange={setRequirementsOpen}
        onCreated={(created) => {
          setSearchInput("");
          setQuickFilter("all");
          invalidateCaseData();
          const firstCreated = created.items.find(
            (item) => item.outcome === "created" && item.testItemId,
          );
          if (firstCreated?.testItemId) {
            setSelectedId(firstCreated.testItemId);
          }
        }}
      />
      <CreateFolderDialog
        open={folderOpen}
        types={activeTypes}
        folders={workspace.folders}
        submitting={createFolderMutation.isPending}
        onOpenChange={setFolderOpen}
        onSubmit={(payload) => createFolderMutation.mutateAsync(payload)}
      />
      <AlertDialog open={staticDeleteOpen} onOpenChange={setStaticDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除全部静态测试项？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除当前项目 {staticItemCount}{" "}
              个静态测试项及其审查单、代码规则结果和文件清单；此操作不可撤销，之后可用「补齐推荐静态测试项」重新生成。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className={styles.dangerAction}
              onClick={() => void deleteStaticItemsMutation.mutateAsync()}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {pendingDelete ? (
        <AlertDialog open onOpenChange={(open) => (open ? undefined : setPendingDelete(null))}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingDelete.kind === "item"
                  ? `删除测试项「${pendingDelete.label}」？`
                  : pendingDelete.kind === "folder"
                    ? `删除文件夹「${pendingDelete.label}」？`
                    : `删除用例「${pendingDelete.label}」？`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDelete.kind === "item"
                  ? "将级联删除该测试项的子项、用例与步骤，需求关联同时解除；此操作不可撤销。"
                  : pendingDelete.kind === "folder"
                    ? `文件夹内 ${pendingDelete.count} 个测试项会移到同类型根目录（不删除测试项）；此操作不可撤销。`
                    : "删除后同测试项剩余用例的序号与标识会重新生成；此操作不可撤销。"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                className={styles.dangerAction}
                onClick={() => {
                  if (pendingDelete.kind === "item") {
                    void deleteItemMutation.mutateAsync(pendingDelete.id);
                  } else if (pendingDelete.kind === "folder") {
                    void deleteFolderMutation.mutateAsync(pendingDelete.id);
                  } else {
                    void deleteCaseMutation.mutateAsync({
                      testItemId: pendingDelete.testItemId,
                      id: pendingDelete.id,
                    });
                  }
                }}
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </section>
  );
}
