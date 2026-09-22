import { BookOpen, ChevronRight, FileText, Folder } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Tree, type NodeRendererProps, type RowRendererProps, type TreeApi } from "react-arborist";
import styles from "./requirements-tree.module.css";
import { Badge } from "@/components/ui/badge";
import type {
  RequirementRecord,
  RequirementSection,
  RequirementSource,
} from "@/features/requirements/types";
import { requirementSourceLabel } from "./requirement-form";

type CandidateTreeNode = {
  key: string;
  type: "source" | "section" | "requirement";
  title: string;
  count: number;
  requirement?: RequirementRecord;
  children: CandidateTreeNode[];
};

export function RequirementsCandidateTree({
  sources,
  sections,
  requirements,
  selectedId,
  onSelect,
  naturalHeight,
}: {
  sources: RequirementSource[];
  sections: RequirementSection[];
  requirements: RequirementRecord[];
  selectedId: string;
  onSelect: (requirement: RequirementRecord) => void;
  naturalHeight: boolean;
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

  const renderNode = (props: NodeRendererProps<CandidateTreeNode>) => (
    <CandidateTreeRow {...props} selectedId={selectedId} onSelect={onSelect} />
  );

  if (!nodes.length) {
    return (
      <div className={styles.empty}>
        <p className="text-muted-foreground px-3 text-xs">暂无待确认需求章节</p>
      </div>
    );
  }

  return (
    <div ref={shellRef} className={styles.treeShell}>
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
        overscanCount={12}
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
    </div>
  );
}

type CandidateTreeRowProps = NodeRendererProps<CandidateTreeNode> & {
  selectedId: string;
  onSelect: (requirement: RequirementRecord) => void;
};

function CandidateTreeRowRenderer({
  attrs,
  innerRef,
  children,
}: RowRendererProps<CandidateTreeNode>) {
  return (
    <div
      {...attrs}
      role="treeitem"
      tabIndex={-1}
      ref={innerRef}
      onFocus={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}

function CandidateTreeRow({ node, style, dragHandle, selectedId }: CandidateTreeRowProps) {
  const data = node.data;
  const Icon = data.type === "source" ? BookOpen : data.type === "section" ? Folder : FileText;
  const requirementId = data.requirement?.id ?? "";

  return (
    <div
      ref={dragHandle}
      style={style}
      className={styles.row}
      data-node-type={data.type}
      data-tree-row="true"
      data-selected={requirementId && requirementId === selectedId ? "true" : undefined}
      data-open={node.isOpen ? "true" : undefined}
    >
      {data.children.length > 0 ? (
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
      ) : null}
      <span className={styles.icon} aria-hidden>
        <Icon />
      </span>
      <span className={styles.title}>{data.title}</span>
      {data.count > 0 ? <Badge variant="warning">{data.count}</Badge> : null}
    </div>
  );
}

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
