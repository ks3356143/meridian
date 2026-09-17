import { BookOpen, ChevronRight, FileText, Keyboard, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Tree, type NodeRendererProps, type TreeApi } from "react-arborist";
import styles from "./requirements-tree.module.css";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useRequirementTreeMotion } from "./use-requirement-tree-motion";

type ConfirmedRequirementNode = {
  key: string;
  type: "source" | "requirement";
  title: string;
  count: number;
  requirement?: RequirementRecord;
  children: ConfirmedRequirementNode[];
};

type ConfirmedTreeRowProps = NodeRendererProps<ConfirmedRequirementNode> & {
  handlersRef: RefObject<{
    onDelete: (requirement: RequirementRecord) => void;
    onSelect: (requirement: RequirementRecord) => void;
  }>;
};

export function RequirementsTree({
  sources,
  requirements,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  onRegisterExitAnimation,
  naturalHeight,
}: {
  sources: RequirementSource[];
  requirements: RequirementRecord[];
  selectedId: string;
  onSelect: (requirement: RequirementRecord) => void;
  onCreate: () => void;
  onDelete: (requirement: RequirementRecord) => void;
  onRegisterExitAnimation: (requestExit: (id: string) => Promise<void>) => void;
  naturalHeight: boolean;
}) {
  const nodes = buildConfirmedTree(sources, requirements);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const structureSignature = nodes
    .flatMap((source) => source.children.map((requirement) => requirement.key))
    .join("|");

  return (
    <aside className={styles.shell} aria-label="需求目录容器">
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
            <Button type="button" size="sm" className="h-7" onClick={onCreate}>
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
            onSelect={onSelect}
            onDelete={onDelete}
            onRegisterExitAnimation={onRegisterExitAnimation}
            naturalHeight={naturalHeight}
          />
        </TabsContent>
      </Tabs>
      <RequirementShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </aside>
  );
}

function ConfirmedTree({
  nodes,
  selectedId,
  structureSignature,
  onSelect,
  onDelete,
  onRegisterExitAnimation,
  naturalHeight,
}: {
  nodes: ConfirmedRequirementNode[];
  selectedId: string;
  structureSignature: string;
  onSelect: (requirement: RequirementRecord) => void;
  onDelete: (requirement: RequirementRecord) => void;
  onRegisterExitAnimation: (requestExit: (id: string) => Promise<void>) => void;
  naturalHeight: boolean;
}) {
  const treeRef = useRef<TreeApi<ConfirmedRequirementNode>>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const rowHandlersRef = useRef({ onDelete, onSelect });
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

  useEffect(() => {
    rowHandlersRef.current = { onDelete, onSelect };
  }, [onDelete, onSelect]);

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
    </div>
  );
}

function ConfirmedTreeRow({ node, style, dragHandle, handlersRef }: ConfirmedTreeRowProps) {
  const data = node.data;
  const Icon = data.type === "source" ? BookOpen : FileText;
  const guideCount = node.level;
  const requirement = data.requirement;

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

function requirementSourceLabel(source: RequirementSource) {
  switch (source.objectKind) {
    case "srs":
      return "需求规格说明";
    case "task_book":
      return "研制任务书";
    case "technical_requirement":
      return "技术要求";
    case "development_requirement":
      return "研制总要求";
    default:
      return source.objectName.replace(/^【[^】]+】/, "");
  }
}
