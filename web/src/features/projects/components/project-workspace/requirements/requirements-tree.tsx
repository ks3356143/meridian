import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CopyPlus,
  FileText,
  HelpCircle,
  Keyboard,
  ListChecks,
  PencilLine,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Tree, type NodeRendererProps, type RowRendererProps, type TreeApi } from "react-arborist";
import { gsap, useGSAP } from "@/lib/gsap";
import styles from "./requirements-tree.module.css";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import type { RequirementRecord, RequirementSource } from "@/features/requirements/types";
import { RequirementShortcutsDialog } from "./requirement-shortcuts-dialog";
import { requirementSourceLabel } from "./requirement-form";
import { useRequirementTreeMotion } from "./use-requirement-tree-motion";
import { useRequirementHistory } from "./use-requirement-history";
import {
  requirementSearchFieldLabels,
  useRequirementSearch,
  type RequirementSearchHit,
} from "./use-requirement-search";

type ConfirmedRequirementNode = {
  key: string;
  type: "source" | "requirement";
  title: string;
  count: number;
  incompleteCount: number;
  requirement?: RequirementRecord;
  children: ConfirmedRequirementNode[];
};

type ConfirmedTreeRowState = {
  batchMode: boolean;
  selectedIds: string[];
  activeSearchId: string;
  searchActive: boolean;
  searchHitsById: Map<string, RequirementSearchHit>;
  onToggleRequirement: (id: string, checked: boolean) => void;
  onToggleSource: (sourceId: string, checked: boolean) => void;
};

const confirmedTreeRowContext = createContext<ConfirmedTreeRowState | null>(null);

export function RequirementsTree({
  sources,
  requirements,
  selectedId,
  batchMode,
  selectedIds,
  onSelect,
  onCreate,
  onCopy,
  onDelete,
  onToggleBatchMode,
  onToggleRequirement,
  onToggleSource,
  onOpenBulkUpdate,
  onOpenBulkDelete,
  onClearSelection,
  onRegisterExitAnimation,
  naturalHeight,
}: {
  sources: RequirementSource[];
  requirements: RequirementRecord[];
  selectedId: string;
  batchMode: boolean;
  selectedIds: string[];
  onSelect: (requirement: RequirementRecord) => void;
  onCreate: () => void;
  onCopy: (requirement: RequirementRecord) => void;
  onDelete: (requirement: RequirementRecord) => void;
  onToggleBatchMode: () => void;
  onToggleRequirement: (id: string, checked: boolean) => void;
  onToggleSource: (sourceId: string, checked: boolean) => void;
  onOpenBulkUpdate: () => void;
  onOpenBulkDelete: () => void;
  onClearSelection: () => void;
  onRegisterExitAnimation: (requestExit: (id: string) => Promise<void>) => void;
  naturalHeight: boolean;
}) {
  const nodes = buildConfirmedTree(sources, requirements);
  const treeRef = useRef<TreeApi<ConfirmedRequirementNode>>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchState, setSearchState] = useState({
    committed: false,
    index: 0,
    query: "",
  });
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const shellRef = useRef<HTMLElement>(null);
  const structureSignature = nodes
    .flatMap((source) => source.children.map((requirement) => requirement.key))
    .join("|");
  const selectedCount = selectedIds.length;

  const officialRequirements = useMemo(
    () =>
      sources.flatMap((source) =>
        requirements.filter(
          (requirement) =>
            requirement.status === "official" && requirement.sourceVersionId === source.id,
        ),
      ),
    [requirements, sources],
  );
  const officialRequirementsById = useMemo(
    () => new Map(officialRequirements.map((requirement) => [requirement.id, requirement])),
    [officialRequirements],
  );
  const search = useRequirementSearch(officialRequirements, searchState.query);
  const boundedSearchIndex = Math.min(Math.max(searchState.index, 0), search.hits.length - 1);
  const activeSearchHit = search.hits[boundedSearchIndex];
  const activeSearchId = activeSearchHit?.requirement.id ?? "";
  const history = useRequirementHistory(selectedId, officialRequirementsById);
  const updateSearchQuery = (query: string) => {
    setSearchState({ committed: false, index: 0, query });
  };

  const scrollToRequirement = useCallback((requirementId: string) => {
    const nodeId = `requirement:${requirementId}`;
    const tree = treeRef.current;
    if (!tree) return;

    tree.openParents(nodeId);
    window.requestAnimationFrame(() => {
      void tree.scrollTo(nodeId, "center");
    });
  }, []);

  const goToSearchResult = useCallback(
    (direction: -1 | 1) => {
      if (!search.hits.length) return;

      let nextIndex = boundedSearchIndex;
      let nextCommitted = searchState.committed;
      if (!searchState.committed) {
        nextIndex = direction === 1 ? 0 : search.hits.length - 1;
        nextCommitted = true;
      } else {
        nextIndex = (boundedSearchIndex + direction + search.hits.length) % search.hits.length;
      }

      const hit = search.hits[nextIndex];
      setSearchState({
        committed: nextCommitted,
        index: nextIndex,
        query: searchState.query,
      });
      onSelect(hit.requirement);
      scrollToRequirement(hit.requirement.id);
    },
    [boundedSearchIndex, onSelect, scrollToRequirement, search.hits, searchState, setSearchState],
  );

  const goToHistory = useCallback(
    (direction: -1 | 1) => {
      const requirement = history.moveTo(direction);
      if (!requirement) return;

      onSelect(requirement);
      scrollToRequirement(requirement.id);

      if (!searchState.query) return;
      const hitIndex = search.hits.findIndex((hit) => hit.requirement.id === requirement.id);
      if (hitIndex >= 0) {
        setSearchState({
          committed: true,
          index: hitIndex,
          query: searchState.query,
        });
      }
    },
    [history, onSelect, scrollToRequirement, search.hits, searchState, setSearchState],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[role='dialog']")) return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.ctrlKey && event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        goToSearchResult(-1);
        return;
      }

      if (event.ctrlKey && event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        goToSearchResult(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToSearchResult, goToHistory]);

  useGSAP(
    () => {
      if (!batchMode || !shellRef.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const bar = shellRef.current.querySelector<HTMLElement>(`.${styles.batchBar}`);
      const actions = shellRef.current.querySelector<HTMLElement>(`.${styles.batchActions}`);
      const checks = shellRef.current.querySelectorAll<HTMLElement>(`.${styles.rowCheck}`);
      if (!bar) return;

      gsap.fromTo(
        bar,
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.26, ease: "power2.out", clearProps: "all" },
      );
      if (actions) {
        gsap.fromTo(
          actions,
          { autoAlpha: 0, y: 6 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.22,
            delay: 0.04,
            ease: "power2.out",
            clearProps: "all",
          },
        );
      }
      if (checks.length) {
        gsap.fromTo(
          checks,
          { autoAlpha: 0, scale: 0.86 },
          {
            autoAlpha: 1,
            scale: 1,
            duration: 0.18,
            stagger: 0.004,
            ease: "power2.out",
            clearProps: "all",
          },
        );
      }
    },
    { dependencies: [batchMode], scope: shellRef },
  );

  return (
    <aside
      ref={shellRef}
      className={styles.shell}
      data-batch={batchMode ? "true" : undefined}
      aria-label="需求目录容器"
    >
      <Tabs defaultValue="confirmed" className={styles.tabs}>
        <div className={styles.toolbar}>
          <TabsList variant="line" className={styles.tabsList}>
            <TabsTrigger value="confirmed" className={styles.tab}>
              已确认需求
            </TabsTrigger>
          </TabsList>
          <div className={styles.actions}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className={styles.shortcutTrigger}
                  data-active={batchMode ? "true" : undefined}
                  aria-label={batchMode ? "退出批量编辑" : "进入批量编辑"}
                  aria-pressed={batchMode}
                  onClick={onToggleBatchMode}
                >
                  <ListChecks aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">批量编辑需求</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className={styles.shortcutTrigger}
                  aria-label="快捷键与功能说明"
                  onClick={() => setShortcutsOpen(true)}
                >
                  <Keyboard aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className={styles.shortcutTooltip}>
                快捷键与功能说明
              </TooltipContent>
            </Tooltip>
            <Button type="button" size="sm" onClick={onCreate}>
              <Plus data-icon="inline-start" aria-hidden />
              新增确认需求
            </Button>
          </div>
        </div>
        <div className={styles.searchPanel}>
          <div className={styles.searchField}>
            <Search className={styles.searchGlyph} aria-hidden />
            <Input
              ref={searchInputRef}
              className={styles.searchInput}
              type="text"
              value={searchState.query}
              onChange={(event) => updateSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  goToSearchResult(event.shiftKey ? -1 : 1);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  updateSearchQuery("");
                }
              }}
              placeholder="搜索章节 / 名称 / 描述 / 标识 / 标签"
              aria-label="搜索需求"
            />
            <div className={styles.searchActions}>
              {searchState.query ? (
                <button
                  type="button"
                  className={styles.clearSearch}
                  onClick={() => updateSearchQuery("")}
                  aria-label="清空搜索"
                >
                  <X aria-hidden />
                </button>
              ) : null}
              <span className={styles.searchCount} role="status" aria-live="polite">
                {searchState.query
                  ? `${search.hits.length ? boundedSearchIndex + 1 : 0}/${search.hits.length}`
                  : ""}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className={styles.searchNav}
                disabled={!searchState.query || !search.hits.length}
                onClick={() => goToSearchResult(-1)}
                aria-label="上一个搜索结果"
              >
                <ChevronUp aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className={styles.searchNav}
                disabled={!searchState.query || !search.hits.length}
                onClick={() => goToSearchResult(1)}
                aria-label="下一个搜索结果"
              >
                <ChevronDown aria-hidden />
              </Button>
            </div>
          </div>
          {searchState.query ? (
            <div className={styles.searchPreview}>
              {activeSearchHit ? (
                <>
                  <span className={styles.searchPreviewLabel}>
                    {activeSearchHit.fields
                      .map((field) => requirementSearchFieldLabels[field])
                      .join(" / ")}
                  </span>
                  <TruncatedText value={activeSearchHit.excerpt} />
                </>
              ) : (
                <TruncatedText value="无匹配需求" placeholder="无匹配需求" />
              )}
            </div>
          ) : null}
          <div className={styles.historyRow}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className={styles.historyButton}
                  disabled={!history.previous}
                  onClick={() => goToHistory(-1)}
                >
                  <ArrowLeft data-icon="inline-start" aria-hidden />
                  上一条
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {history.previous
                  ? `回到上一条：${history.previous.requirement.chapterNumber} ${history.previous.requirement.name}`
                  : "暂无上一条"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className={styles.historyForward}
                  disabled={!history.next}
                  onClick={() => goToHistory(1)}
                  aria-label="回到下一条最近查看需求"
                >
                  <ArrowRight data-icon="inline-start" aria-hidden />
                  下一条
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {history.next
                  ? `回到下一条：${history.next.requirement.chapterNumber} ${history.next.requirement.name}`
                  : "暂无下一条"}
              </TooltipContent>
            </Tooltip>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className={styles.helpTrigger}
                  aria-label="搜索与定位快捷键说明"
                >
                  <HelpCircle aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                side="right"
                sideOffset={6}
                collisionPadding={8}
                className={styles.helpPopover}
              >
                <span className={styles.helpTitle}>搜索与定位快捷键</span>
                <div className={styles.helpList}>
                  <div className={styles.helpRow}>
                    <span className={styles.helpKeys}>
                      <kbd className={styles.helpKey}>Ctrl / Meta</kbd>
                      <kbd className={styles.helpKey}>K</kbd>
                    </span>
                    <span className={styles.helpDescription}>聚焦搜索</span>
                  </div>
                  <div className={styles.helpRow}>
                    <span className={styles.helpKeys}>
                      <kbd className={styles.helpKey}>Enter</kbd>
                    </span>
                    <span className={styles.helpDescription}>下一个结果</span>
                  </div>
                  <div className={styles.helpRow}>
                    <span className={styles.helpKeys}>
                      <kbd className={styles.helpKey}>Shift</kbd>
                      <kbd className={styles.helpKey}>Enter</kbd>
                    </span>
                    <span className={styles.helpDescription}>上一个结果</span>
                  </div>
                  <div className={styles.helpRow}>
                    <span className={styles.helpKeys}>
                      <kbd className={styles.helpKey}>Esc</kbd>
                    </span>
                    <span className={styles.helpDescription}>清空搜索</span>
                  </div>
                  <div className={styles.helpRow}>
                    <span className={styles.helpKeys}>
                      <kbd className={styles.helpKey}>Ctrl</kbd>
                      <kbd className={styles.helpKey}>Alt</kbd>
                      <kbd className={styles.helpKey}>←</kbd>
                    </span>
                    <span className={styles.helpDescription}>上一个结果</span>
                  </div>
                  <div className={styles.helpRow}>
                    <span className={styles.helpKeys}>
                      <kbd className={styles.helpKey}>Ctrl</kbd>
                      <kbd className={styles.helpKey}>Alt</kbd>
                      <kbd className={styles.helpKey}>→</kbd>
                    </span>
                    <span className={styles.helpDescription}>下一个结果</span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <TabsContent value="confirmed" className={styles.content}>
          <ConfirmedTree
            nodes={nodes}
            selectedId={selectedId}
            structureSignature={structureSignature}
            batchMode={batchMode}
            selectedIds={selectedIds}
            onSelect={onSelect}
            onCopy={onCopy}
            onDelete={onDelete}
            onToggleRequirement={onToggleRequirement}
            onToggleSource={onToggleSource}
            onRegisterExitAnimation={onRegisterExitAnimation}
            naturalHeight={naturalHeight}
            treeRef={treeRef}
            searchHitsById={search.hitsById}
            activeSearchId={activeSearchId}
            searchActive={Boolean(searchState.query.trim())}
          />
        </TabsContent>
      </Tabs>
      {batchMode ? (
        <div className={styles.batchBar} role="status" aria-live="polite">
          <span className={styles.batchCount} aria-atomic="true">
            已选 {selectedCount} 项
          </span>
          <div className={styles.batchActions}>
            <Button
              type="button"
              size="xs"
              disabled={selectedCount === 0}
              onClick={onOpenBulkUpdate}
              aria-label="批量修改选中需求"
            >
              <PencilLine data-icon="inline-start" aria-hidden />
              修改
            </Button>
            <Button
              type="button"
              size="xs"
              variant="destructive"
              disabled={selectedCount === 0}
              onClick={onOpenBulkDelete}
              aria-label="批量删除选中需求"
            >
              <Trash2 data-icon="inline-start" aria-hidden />
              删除
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={selectedCount === 0}
              onClick={onClearSelection}
              aria-label="清除批量选择"
            >
              <X data-icon="inline-start" aria-hidden />
              清除
            </Button>
          </div>
        </div>
      ) : null}
      <RequirementShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </aside>
  );
}

function ConfirmedTree({
  nodes,
  selectedId,
  structureSignature,
  batchMode,
  selectedIds,
  onSelect,
  onCopy,
  onDelete,
  onToggleRequirement,
  onToggleSource,
  onRegisterExitAnimation,
  naturalHeight,
  treeRef,
  searchHitsById,
  activeSearchId,
  searchActive,
}: {
  nodes: ConfirmedRequirementNode[];
  selectedId: string;
  structureSignature: string;
  batchMode: boolean;
  selectedIds: string[];
  onSelect: (requirement: RequirementRecord) => void;
  onCopy: (requirement: RequirementRecord) => void;
  onDelete: (requirement: RequirementRecord) => void;
  onToggleRequirement: (id: string, checked: boolean) => void;
  onToggleSource: (sourceId: string, checked: boolean) => void;
  onRegisterExitAnimation: (requestExit: (id: string) => Promise<void>) => void;
  naturalHeight: boolean;
  treeRef: RefObject<TreeApi<ConfirmedRequirementNode> | null>;
  searchHitsById: Map<string, RequirementSearchHit>;
  activeSearchId: string;
  searchActive: boolean;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const rowHandlersRef = useRef({ onCopy, onDelete, onSelect });
  const [height, setHeight] = useState(360);
  const selectedTreeId = selectedId ? `requirement:${selectedId}` : "";
  const { requestTreeToggle, requestTreeExit } = useRequirementTreeMotion({
    shellRef,
    structureSignature,
    treeRef,
  });

  useEffect(() => {
    onRegisterExitAnimation(requestTreeExit);
  }, [onRegisterExitAnimation, requestTreeExit]);

  useEffect(() => {
    rowHandlersRef.current = { onCopy, onDelete, onSelect };
  }, [onCopy, onDelete, onSelect]);

  useEffect(() => {
    if (naturalHeight) return;

    const element = shellRef.current;
    if (!element) return;
    const updateHeight = () => {
      const nextHeight = element.clientHeight;
      if (nextHeight > 0) setHeight(nextHeight);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [naturalHeight]);

  useEffect(() => {
    const tree = treeRef.current;
    if (!tree) return;

    if (!selectedTreeId) {
      if (tree.selectedIds.size > 0) tree.deselectAll();
      return;
    }

    if (tree.isSelected(selectedTreeId)) return;
    tree.setSelection({
      ids: [selectedTreeId],
      anchor: selectedTreeId,
      mostRecent: selectedTreeId,
    });
  }, [selectedTreeId, treeRef]);

  const renderNode = useCallback(
    (props: NodeRendererProps<ConfirmedRequirementNode>) => (
      <ConfirmedTreeRow {...props} handlersRef={rowHandlersRef} />
    ),
    [],
  );

  const rowState = useMemo(
    () => ({
      activeSearchId,
      batchMode,
      searchActive,
      searchHitsById,
      selectedIds,
      onToggleRequirement,
      onToggleSource,
    }),
    [
      activeSearchId,
      batchMode,
      searchActive,
      searchHitsById,
      selectedIds,
      onToggleRequirement,
      onToggleSource,
    ],
  );

  if (!nodes.length) return <div className={styles.empty} />;

  return (
    <div
      ref={shellRef}
      className={styles.treeShell}
      onClickCapture={(event) => {
        const chevron = (event.target as HTMLElement).closest(`.${styles.chevron}`);
        if (!chevron) return;

        const row = chevron.closest("[role='treeitem']");
        const nodeId = row?.querySelector<HTMLElement>(`.${styles.row}`)?.dataset.nodeId;
        if (!nodeId) return;

        event.preventDefault();
        event.stopPropagation();
        requestTreeToggle(nodeId);
      }}
      onKeyDownCapture={(event) => {
        if ((event.target as HTMLElement).closest('[data-slot="checkbox"]')) return;

        const node = treeRef.current?.focusedNode;
        if (!node || node.isLeaf) return;

        const shouldToggle =
          event.key === " " ||
          (event.key === "ArrowRight" && node.isClosed) ||
          (event.key === "ArrowLeft" && node.isOpen);
        if (!shouldToggle) return;

        event.preventDefault();
        event.stopPropagation();
        requestTreeToggle(node.id);
      }}
    >
      <confirmedTreeRowContext.Provider value={rowState}>
        <Tree<ConfirmedRequirementNode>
          key={nodes[0]?.key ?? "confirmed"}
          ref={treeRef}
          data={nodes}
          className={styles.tree}
          aria-label="已确认需求树"
          height={naturalHeight ? getNaturalTreeHeight(nodes) : height}
          width="100%"
          rowHeight={30}
          indent={14}
          overscanCount={12}
          openByDefault
          initialOpenState={{ [nodes[0].key]: true }}
          idAccessor={(node) => node.key}
          renderRow={ConfirmedTreeRowRenderer}
          selectionFollowsFocus={false}
          disableMultiSelection
          disableDrag
          disableDrop
          disableEdit
          onActivate={(node) => {
            if (node.data.type === "requirement" && node.data.requirement) {
              onSelect(node.data.requirement);
            }
          }}
          onFocus={(node) => {
            if (node.data.type === "requirement" && node.data.requirement) {
              onSelect(node.data.requirement);
            }
          }}
        >
          {renderNode}
        </Tree>
      </confirmedTreeRowContext.Provider>
    </div>
  );
}

type ConfirmedTreeRowProps = NodeRendererProps<ConfirmedRequirementNode> & {
  handlersRef: RefObject<{
    onCopy: (requirement: RequirementRecord) => void;
    onDelete: (requirement: RequirementRecord) => void;
    onSelect: (requirement: RequirementRecord) => void;
  }>;
};

function ConfirmedTreeRowRenderer({
  node,
  attrs,
  innerRef,
  children,
}: RowRendererProps<ConfirmedRequirementNode>) {
  return (
    <div
      {...attrs}
      role="treeitem"
      ref={innerRef}
      onFocus={(event) => event.stopPropagation()}
      onClick={() => {
        node.tree.setSelection({
          ids: [node.id],
          anchor: node.id,
          mostRecent: node.id,
        });
        node.tree.focus(node, { scroll: false });
      }}
    >
      {children}
    </div>
  );
}

function ConfirmedTreeRow({ node, style, dragHandle, handlersRef }: ConfirmedTreeRowProps) {
  const data = node.data;
  const rowState = useContext(confirmedTreeRowContext);
  if (!rowState) return null;
  const Icon = data.type === "source" ? BookOpen : FileText;
  const guideCount = node.level;
  const requirement = data.requirement;
  const requirementId = requirement?.id ?? "";
  const searchHit =
    rowState.searchActive && requirementId ? rowState.searchHitsById.get(requirementId) : undefined;
  const isSearchCurrent =
    rowState.searchActive && requirementId && rowState.activeSearchId === requirementId;
  const searchGroupHit =
    rowState.searchActive && !requirement
      ? data.children.find(
          (child) => child.requirement && rowState.searchHitsById.has(child.requirement.id),
        )
      : undefined;
  const checked = requirementId !== "" && rowState.selectedIds.includes(requirementId);
  const childCheckedCount = data.children.filter((child) =>
    rowState.selectedIds.includes(child.requirement?.id ?? ""),
  ).length;
  const sourceCheckState =
    data.children.length === 0
      ? false
      : childCheckedCount === data.children.length
        ? true
        : childCheckedCount > 0
          ? "indeterminate"
          : false;

  const row = (
    <div
      ref={dragHandle}
      style={style}
      data-node-type={data.type}
      data-node-id={node.id}
      data-tree-row="true"
      data-incomplete={requirement && requirement.description.trim() === "" ? "true" : undefined}
      data-selected={node.isSelected ? "true" : undefined}
      data-open={node.isOpen ? "true" : undefined}
      data-search={searchHit ? "true" : undefined}
      data-search-current={isSearchCurrent ? "true" : undefined}
      data-search-group={searchGroupHit ? "true" : undefined}
      className={styles.row}
      onContextMenu={
        data.type === "requirement" && requirement
          ? () => handlersRef.current.onSelect(requirement)
          : undefined
      }
    >
      <span className={styles.guides} aria-hidden="true">
        {Array.from({ length: guideCount }, (_, index) => (
          <span
            key={index}
            className={styles.guide}
            data-guide-level={index + 1}
            data-guide-current={index === guideCount - 1 ? "true" : undefined}
          />
        ))}
      </span>
      {rowState.batchMode ? (
        <Checkbox
          className={styles.rowCheck}
          checked={data.type === "source" ? sourceCheckState : checked}
          disabled={data.type === "source" && data.children.length === 0}
          aria-label={
            data.type === "source" ? `选择${data.title}下全部需求` : `选择需求 ${data.title}`
          }
          onClick={(event) => event.stopPropagation()}
          onCheckedChange={(value) => {
            if (data.type === "source") {
              rowState.onToggleSource(data.key.replace(/^source:/, ""), value === true);
            } else if (requirementId) {
              rowState.onToggleRequirement(requirementId, value === true);
            }
          }}
        />
      ) : null}
      {data.children.length === 0 ? null : (
        <span
          className={styles.chevron}
          aria-hidden
          onClick={(event) => {
            event.stopPropagation();
            node.toggle();
          }}
        >
          <ChevronRight />
        </span>
      )}
      <span className={styles.icon} aria-hidden>
        <Icon />
      </span>
      <TruncatedText value={data.title} className={styles.title} />
      {searchHit ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={styles.searchMarker} aria-label={`搜索命中：${searchHit.excerpt}`}>
              <Search aria-hidden />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className={styles.searchTooltip}>
            <span className={styles.searchTooltipFields}>
              {searchHit.fields.map((field) => requirementSearchFieldLabels[field]).join(" / ")}
            </span>
            <span className={styles.searchTooltipExcerpt}>{searchHit.excerpt}</span>
          </TooltipContent>
        </Tooltip>
      ) : null}
      {data.type === "source" ? <Badge variant="outline">{data.count}</Badge> : null}
      {data.type === "source" && data.incompleteCount > 0 ? (
        <Badge variant="warning" className={styles.incompleteCountBadge}>
          待补 {data.incompleteCount}
        </Badge>
      ) : null}
      {requirement && requirement.description.trim() === "" ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={styles.incompleteMarker}
              aria-label="待补描述；补全后才能关联测试项"
            >
              <AlertTriangle aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className={styles.incompleteTooltip}>
            待补描述；补全后才能关联测试项。
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );

  if (data.type !== "requirement" || !requirement) return row;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>需求操作</ContextMenuLabel>
        <ContextMenuItem onSelect={() => handlersRef.current.onCopy(requirement)}>
          <CopyPlus aria-hidden />
          复制新增...
        </ContextMenuItem>
        <ContextMenuItem
          variant="destructive"
          onSelect={() => handlersRef.current.onDelete(requirement)}
        >
          <Trash2 aria-hidden />
          删除需求...
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function getNaturalTreeHeight(nodes: ConfirmedRequirementNode[]) {
  const rowCount = nodes.reduce((total, source) => total + 1 + source.children.length, 0);
  return Math.max(150, Math.round(rowCount * 30 + 5));
}

function buildConfirmedTree(sources: RequirementSource[], requirements: RequirementRecord[]) {
  return sources.map((source) => {
    const officialRequirements = requirements.filter(
      (requirement) =>
        requirement.status === "official" && requirement.sourceVersionId === source.id,
    );
    const incompleteCount = officialRequirements.filter(
      (requirement) => requirement.description.trim() === "",
    ).length;

    return {
      key: `source:${source.id}`,
      type: "source" as const,
      title: `${requirementSourceLabel(source)}${source.version}`,
      count: officialRequirements.length,
      incompleteCount,
      children: officialRequirements.map((requirement) => ({
        key: `requirement:${requirement.id}`,
        type: "requirement" as const,
        title: `§${requirement.chapterNumber} ${requirement.name}`,
        count: 0,
        incompleteCount: requirement.description.trim() === "" ? 1 : 0,
        requirement,
        children: [],
      })),
    };
  });
}
