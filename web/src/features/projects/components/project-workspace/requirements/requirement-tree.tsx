import { ChevronRight, FileText, FolderOpen, BookOpen } from "lucide-react";
import { useEffect, useImperativeHandle, useRef, useState, type RefObject } from "react";
import { Tree, type NodeRendererProps, type TreeApi } from "react-arborist";
import { Badge } from "@/components/ui/badge";
import { TruncatedText } from "@/components/shared/truncated-text";
import { getPrimaryKindMeta, statusMeta, type RequirementTreeNode } from "./requirement-model";

export type RequirementTreeControls = {
  expandAll: () => void;
  collapseAll: () => void;
};

export function RequirementTree({
  nodes,
  selectedKey,
  onSelect,
  controlsRef,
}: {
  nodes: RequirementTreeNode[];
  selectedKey: string;
  onSelect: (node: RequirementTreeNode) => void;
  controlsRef: RefObject<RequirementTreeControls | null>;
}) {
  const treeRef = useRef<TreeApi<RequirementTreeNode>>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(480);

  useEffect(() => {
    if (selectedKey) treeRef.current?.openParents(selectedKey);
  }, [selectedKey]);

  useEffect(() => {
    const element = shellRef.current;
    if (!element) return;
    const updateHeight = () => setHeight(Math.max(240, element.clientHeight));
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useImperativeHandle(
    controlsRef,
    () => ({
      expandAll: () => treeRef.current?.openAll(),
      collapseAll: () => treeRef.current?.closeAll(),
    }),
    [],
  );

  return (
    <div ref={shellRef} className="requirement-tree-shell">
      <Tree<RequirementTreeNode>
        key={nodes[0]?.key ?? "source"}
        ref={treeRef}
        data={nodes}
        className="requirement-tree"
        aria-label="软件需求章节树"
        height={height}
        width="100%"
        rowHeight={27}
        indent={14}
        overscanCount={12}
        openByDefault={false}
        initialOpenState={{ [nodes[0]?.key ?? "source"]: true }}
        idAccessor={(node) => node.key}
        selection={selectedKey}
        selectionFollowsFocus
        disableMultiSelection
        disableDrag
        disableDrop
        disableEdit
        onActivate={(node) => onSelect(node.data)}
        onFocus={(node) => onSelect(node.data)}
      >
        {ArboristRow}
      </Tree>
    </div>
  );
}

function ArboristRow({ node, style, dragHandle }: NodeRendererProps<RequirementTreeNode>) {
  const data = node.data;
  const Icon = data.type === "source" ? BookOpen : data.type === "section" ? FolderOpen : FileText;
  const kindMeta = data.requirement ? getPrimaryKindMeta(data.requirement.primaryKind) : null;
  const status = data.requirement ? statusMeta[data.requirement.status] : null;
  return (
    <div
      ref={dragHandle}
      style={style}
      data-node-type={data.type}
      data-selected={node.isSelected ? "true" : undefined}
      data-open={node.isOpen ? "true" : undefined}
      className="requirement-tree-row"
    >
      <span
        className="requirement-tree-chevron"
        aria-hidden
        onClick={(event) => {
          event.stopPropagation();
          node.toggle();
        }}
      >
        <ChevronRight />
      </span>
      <span className="requirement-tree-icon" aria-hidden>
        <Icon />
      </span>
      {data.chapterNumber ? (
        <TruncatedText value={data.chapterNumber} className="requirement-tree-chapter" />
      ) : null}
      <TruncatedText value={data.title} className="requirement-tree-title" />
      {data.requirement?.tags.length ? (
        <Badge variant="outline" className="requirement-tree-tag">
          <TruncatedText value={data.requirement.tags[0]} />
          {data.requirement.tags.length > 1 ? `+${data.requirement.tags.length - 1}` : null}
        </Badge>
      ) : null}
      {data.type === "section" && data.children.length ? (
        <Badge variant="outline" className="requirement-tree-count">
          {data.children.length}
        </Badge>
      ) : null}
      {kindMeta ? (
        <Badge variant={kindMeta.variant} className="requirement-tree-kind">
          {kindMeta.label.replace("需求", "")}
        </Badge>
      ) : null}
      {status && data.requirement?.status !== "official" ? (
        <Badge variant={status.variant} className="requirement-tree-status">
          {status.label}
        </Badge>
      ) : null}
    </div>
  );
}
