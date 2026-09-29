import { BookOpen, ChevronRight, FileText, Folder, FolderOpen, Undo2 } from "lucide-react";
import {
  createContext,
  useCallback,
  memo,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Tree, type NodeRendererProps, type RowRendererProps, type TreeApi } from "react-arborist";
import styles from "./requirements-tree.module.css";
import { TREE_BASE_OVERSCAN, useRequirementTreeMotion } from "./use-requirement-tree-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TruncatedText } from "@/components/shared/truncated-text";
import type {
  RequirementRecord,
  RequirementSection,
  RequirementSource,
} from "@/features/requirements/types";
import { requirementSourceLabel } from "./requirement-form";

const candidateSelectedIdContext = createContext("");

type CandidateTreeNode = {
  key: string;
  type: "source" | "section" | "requirement";
  title: string;
  count: number;
  requirement?: RequirementRecord;
  children: CandidateTreeNode[];
};

function RequirementsCandidateTreeImpl({
  sources,
  sections,
  requirements,
  selectedId,
  onSelect,
  naturalHeight,
  toolbarTabs,
  excludedCount,
  onOpenRecycleBin,
}: {
  sources: RequirementSource[];
  sections: RequirementSection[];
  requirements: RequirementRecord[];
  selectedId: string;
  onSelect: (requirement: RequirementRecord) => void;
  naturalHeight: boolean;
  toolbarTabs: ReactNode;
  excludedCount: number;
  onOpenRecycleBin: () => void;
}) {
  const treeRef = useRef<TreeApi<CandidateTreeNode>>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(360);

  const candidateRequirements = useMemo(
    () => requirements.filter((item) => item.origin === "parsed" && item.status === "candidate"),
    [requirements],
  );
  const nodes = useMemo(
    () => buildCandidateTree(sources, sections, candidateRequirements),
    [candidateRequirements, sections, sources],
  );
  const structureSignature = useMemo(() => getStructureSignature(nodes), [nodes]);
  const selectedTreeId = selectedId ? `requirement:${selectedId}` : "";
  const { overscanBoost, requestTreeToggle } = useRequirementTreeMotion<CandidateTreeNode>({
    treeRef,
    shellRef,
    structureSignature,
    selectedTreeId,
  });

  useEffect(() => {
    const tree = treeRef.current;
    if (!tree) return;

    if (!selectedTreeId) {
      if (tree.selectedIds.size > 0) tree.deselectAll();
      return;
    }

    // 树内点击已在 renderRow 里完成选中，这里只处理外部选中（如点击右侧表格行）。
    if (tree.isSelected(selectedTreeId)) return;
    tree.setSelection({
      ids: [selectedTreeId],
      anchor: selectedTreeId,
      mostRecent: selectedTreeId,
    });
    tree.openParents(selectedTreeId);
    window.requestAnimationFrame(() => {
      void tree.scrollTo(selectedTreeId, "center");
    });
  }, [selectedTreeId, treeRef]);

  // 空状态分支不挂载树容器：解析完成后 nodes 由 0 变非空时才出现 shellRef，
  // 依赖 nodes.length 重新测量，否则虚拟列表会停留在初始高度、下方出现空白。
  useLayoutEffect(() => {
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
  }, [naturalHeight, nodes.length]);

  const renderNode = useCallback(
    (props: NodeRendererProps<CandidateTreeNode>) => <CandidateTreeRow {...props} />,
    [],
  );

  if (!nodes.length) {
    return (
      <aside className={styles.shell} aria-label="待确认需求目录容器">
        <div className={styles.tabs}>
          <div className={styles.toolbar}>{toolbarTabs}</div>
          <div className={styles.content}>
            <div className={styles.empty}>
              <div className={styles.emptyState}>
                <FolderOpen aria-hidden className={styles.emptyStateIcon} />
                <p className={styles.emptyStateText}>暂无待确认需求章节</p>
                {excludedCount > 0 ? (
                  <div className={styles.emptyStateAction}>
                    <p className={styles.emptyStateHint}>
                      已排除 {excludedCount} 条需求，可随时撤回
                    </p>
                    <Button type="button" variant="outline" size="xs" onClick={onOpenRecycleBin}>
                      <Undo2 data-icon="inline-start" aria-hidden />
                      查看并撤回
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.shell} aria-label="待确认需求目录容器">
      <div className={styles.tabs}>
        <div className={styles.toolbar}>{toolbarTabs}</div>
        <div className={styles.content}>
          <div
            ref={shellRef}
            className={styles.treeShell}
            data-candidate="true"
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
            <candidateSelectedIdContext.Provider value={selectedId}>
              <Tree<CandidateTreeNode>
                key={nodes[0]?.key ?? "candidate"}
                ref={treeRef}
                data={nodes}
                className={styles.tree}
                aria-label="待确认需求章节树"
                height={naturalHeight ? getNaturalCandidateTreeHeight(nodes) : height}
                width="100%"
                rowHeight={30}
                indent={14}
                overscanCount={TREE_BASE_OVERSCAN + overscanBoost}
                openByDefault
                initialOpenState={{ [nodes[0].key]: true }}
                idAccessor={(node) => node.key}
                renderRow={CandidateTreeRowRenderer}
                selectionFollowsFocus={false}
                disableMultiSelection
                disableDrag
                disableDrop
                disableEdit
                onActivate={(node) => {
                  if (node.data.requirement) onSelect(node.data.requirement);
                }}
                onFocus={(node) => {
                  if (node.data.requirement) onSelect(node.data.requirement);
                }}
              >
                {renderNode}
              </Tree>
            </candidateSelectedIdContext.Provider>
          </div>
        </div>
      </div>
    </aside>
  );
}

type CandidateTreeRowProps = NodeRendererProps<CandidateTreeNode>;

function CandidateTreeRowRenderer({
  node,
  attrs,
  innerRef,
  children,
}: RowRendererProps<CandidateTreeNode>) {
  const selectNode = () => {
    node.tree.setSelection({
      ids: [node.id],
      anchor: node.id,
      mostRecent: node.id,
    });
    node.tree.focus(node, { scroll: false });
  };

  return (
    <div
      {...attrs}
      role="treeitem"
      tabIndex={-1}
      ref={innerRef}
      onFocus={(event) => event.stopPropagation()}
      onClick={selectNode}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        selectNode();
      }}
    >
      {children}
    </div>
  );
}

function CandidateTreeRow({ node, style, dragHandle }: CandidateTreeRowProps) {
  const selectedId = useContext(candidateSelectedIdContext);
  const data = node.data;
  const requirementId = data.requirement?.id ?? "";

  return (
    <div
      ref={dragHandle}
      style={style}
      className={styles.row}
      data-node-type={data.type}
      data-node-id={node.id}
      data-tree-row="true"
      data-selected={requirementId && requirementId === selectedId ? "true" : undefined}
      data-open={node.isOpen ? "true" : undefined}
    >
      <CandidateRowContent
        type={data.type}
        title={data.title}
        count={data.count}
        hasChildren={data.children.length > 0}
        guideCount={node.level}
      />
    </div>
  );
}

/**
 * 行的静态内容按原始值 memo：react-window 每次滚动都会重渲染窗口内的行，
 * 内容不变时直接跳过，只留最外层 div 参与对账（选中/展开态走行上的 data-* 属性 + CSS）。
 */
const CandidateRowContent = memo(function CandidateRowContent({
  type,
  title,
  count,
  hasChildren,
  guideCount,
}: {
  type: CandidateTreeNode["type"];
  title: string;
  count: number;
  hasChildren: boolean;
  guideCount: number;
}) {
  const Icon = type === "source" ? BookOpen : type === "section" ? Folder : FileText;

  return (
    <>
      <span className={styles.guides} aria-hidden>
        {Array.from({ length: guideCount }, (_, index) => (
          <span
            key={index}
            className={styles.guide}
            data-guide-level={index + 1}
            data-guide-current={index === guideCount - 1 ? "true" : undefined}
          />
        ))}
      </span>
      {hasChildren ? (
        <span className={styles.chevron} aria-hidden>
          <ChevronRight />
        </span>
      ) : (
        <span className={styles.chevronSpacer} aria-hidden />
      )}
      <span className={styles.icon} aria-hidden>
        <Icon />
      </span>
      <TruncatedText value={title} className={styles.title} />
      {type !== "requirement" && count > 0 ? (
        <Badge variant="primary" className={styles.countBadge}>
          {count}
        </Badge>
      ) : null}
    </>
  );
});

function getNaturalCandidateTreeHeight(nodes: CandidateTreeNode[]) {
  const countRows = (items: CandidateTreeNode[]): number =>
    items.reduce((total, node) => total + 1 + countRows(node.children), 0);
  return Math.max(150, Math.round(countRows(nodes) * 30 + 5));
}

function buildCandidateTree(
  sources: RequirementSource[],
  sections: RequirementSection[],
  requirements: RequirementRecord[],
): CandidateTreeNode[] {
  const sectionsBySource = new Map<string, RequirementSection[]>();
  for (const section of sections) {
    const grouped = sectionsBySource.get(section.sourceVersionId);
    if (grouped) grouped.push(section);
    else sectionsBySource.set(section.sourceVersionId, [section]);
  }

  const requirementsBySection = new Map<string, RequirementRecord[]>();
  const orphanRequirements = new Map<string, RequirementRecord[]>();
  for (const requirement of requirements) {
    const target = requirement.sectionId ? requirementsBySection : orphanRequirements;
    const grouped = target.get(requirement.sectionId || requirement.sourceVersionId);
    if (grouped) grouped.push(requirement);
    else target.set(requirement.sectionId || requirement.sourceVersionId, [requirement]);
  }

  return sources.flatMap((source) => {
    const sourceSections = sectionsBySource.get(source.id) ?? [];
    const sectionsById = new Map(sourceSections.map((section) => [section.id, section]));
    const childrenByParent = new Map<string, RequirementSection[]>();
    const roots: RequirementSection[] = [];
    for (const section of sourceSections) {
      if (section.parentId && sectionsById.has(section.parentId)) {
        const grouped = childrenByParent.get(section.parentId);
        if (grouped) grouped.push(section);
        else childrenByParent.set(section.parentId, [section]);
      } else {
        roots.push(section);
      }
    }

    const sectionNodes = roots
      .map((section) => buildSectionNode(section, childrenByParent, requirementsBySection))
      .filter((node): node is CandidateTreeNode => node !== null);
    const orphanNodes = (orphanRequirements.get(source.id) ?? []).map(toRequirementNode);
    const children = [...sectionNodes, ...orphanNodes];
    if (children.length === 0) return [];

    return [
      {
        key: `source:${source.id}`,
        type: "source" as const,
        title: `${requirementSourceLabel(source)}${source.version}`,
        count: children.reduce((total, child) => total + child.count, 0),
        children,
      },
    ];
  });
}

function buildSectionNode(
  section: RequirementSection,
  childrenByParent: Map<string, RequirementSection[]>,
  requirementsBySection: Map<string, RequirementRecord[]>,
): CandidateTreeNode | null {
  const childSections = childrenByParent.get(section.id) ?? [];
  const childNodes = childSections
    .map((child) => buildSectionNode(child, childrenByParent, requirementsBySection))
    .filter((node): node is CandidateTreeNode => node !== null);
  const requirementNodes = (requirementsBySection.get(section.id) ?? []).map(toRequirementNode);
  const children = [...childNodes, ...requirementNodes];
  if (children.length === 0) return null;

  return {
    key: `section:${section.id}`,
    type: "section" as const,
    title: `§${section.chapterNumber} ${section.title}`,
    count: children.reduce((total, child) => total + child.count, 0),
    children,
  };
}

function toRequirementNode(requirement: RequirementRecord): CandidateTreeNode {
  return {
    key: `requirement:${requirement.id}`,
    type: "requirement" as const,
    title: `§${requirement.chapterNumber} ${requirement.name}`,
    count: 1,
    requirement,
    children: [],
  };
}

function getStructureSignature(nodes: CandidateTreeNode[]): string {
  return nodes.map((node) => `${node.key}:${getStructureSignature(node.children)}`).join("|");
}
export const RequirementsCandidateTree = memo(RequirementsCandidateTreeImpl);
