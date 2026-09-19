import {
  BookOpen,
  ChevronRight,
  CopyPlus,
  FileText,
  Keyboard,
  ListChecks,
  PencilLine,
  Plus,
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
import { Tree, type NodeRendererProps, type TreeApi } from "react-arborist";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { RequirementRecord, RequirementSource } from "@/features/requirements/types";
import { RequirementShortcutsDialog } from "./requirement-shortcuts-dialog";
import { requirementSourceLabel } from "./requirement-form";
import { useRequirementTreeMotion } from "./use-requirement-tree-motion";

type ConfirmedRequirementNode = {
  key: string;
  type: "source" | "requirement";
  title: string;
  count: number;
  requirement?: RequirementRecord;
  children: ConfirmedRequirementNode[];
};

type ConfirmedTreeRowState = {
  batchMode: boolean;
  selectedIds: string[];
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
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const shellRef = useRef<HTMLElement>(null);
  const structureSignature = nodes
    .flatMap((source) => source.children.map((requirement) => requirement.key))
    .join("|");
  const selectedCount = selectedIds.length;

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
}) {
  const treeRef = useRef<TreeApi<ConfirmedRequirementNode>>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const rowHandlersRef = useRef({ onCopy, onDelete, onSelect });
  const [height, setHeight] = useState(360);
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

  const renderRow = useCallback(
    (props: NodeRendererProps<ConfirmedRequirementNode>) => (
      <ConfirmedTreeRow {...props} handlersRef={rowHandlersRef} />
    ),
    [],
  );

  const rowState = useMemo(
    () => ({ batchMode, selectedIds, onToggleRequirement, onToggleSource }),
    [batchMode, selectedIds, onToggleRequirement, onToggleSource],
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
          selection={selectedId ? `requirement:${selectedId}` : ""}
          selectionFollowsFocus
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
          {renderRow}
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

function ConfirmedTreeRow({ node, style, dragHandle, handlersRef }: ConfirmedTreeRowProps) {
  const data = node.data;
  const rowState = useContext(confirmedTreeRowContext);
  if (!rowState) return null;
  const Icon = data.type === "source" ? BookOpen : FileText;
  const guideCount = node.level;
  const requirement = data.requirement;
  const requirementId = requirement?.id ?? "";
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
      data-selected={node.isSelected ? "true" : undefined}
      data-open={node.isOpen ? "true" : undefined}
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
      {data.type === "source" ? <Badge variant="outline">{data.count}</Badge> : null}
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

    return {
      key: `source:${source.id}`,
      type: "source" as const,
      title: `${requirementSourceLabel(source)}${source.version}`,
      count: officialRequirements.length,
      children: officialRequirements.map((requirement) => ({
        key: `requirement:${requirement.id}`,
        type: "requirement" as const,
        title: `§${requirement.chapterNumber} ${requirement.name}`,
        count: 0,
        requirement,
        children: [],
      })),
    };
  });
}
