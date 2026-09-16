import { BookOpen, ChevronRight, FileText, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Tree, type NodeRendererProps, type TreeApi } from "react-arborist";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RequirementRecord, RequirementSource } from "@/features/requirements/types";

type ConfirmedRequirementNode = {
  key: string;
  type: "source" | "requirement";
  title: string;
  count: number;
  requirement?: RequirementRecord;
  children: ConfirmedRequirementNode[];
};

export function RequirementsTree({
  sources,
  requirements,
  selectedId,
  onSelect,
  onCreate,
}: {
  sources: RequirementSource[];
  requirements: RequirementRecord[];
  selectedId: string;
  onSelect: (requirement: RequirementRecord) => void;
  onCreate: () => void;
}) {
  const nodes = buildConfirmedTree(sources, requirements);

  return (
    <aside className="requirements-tree-shell" aria-label="需求目录容器">
      <Tabs defaultValue="confirmed" className="requirements-tree-tabs">
        <div className="requirements-tree-toolbar">
          <TabsList variant="line" className="requirements-tree-tabs-list">
            <TabsTrigger value="confirmed" className="requirements-tree-tab">
              已确认需求
            </TabsTrigger>
          </TabsList>
          <Button type="button" size="sm" className="h-7" onClick={onCreate}>
            <Plus data-icon="inline-start" aria-hidden />
            新增确认需求
          </Button>
        </div>
        <TabsContent value="confirmed" className="requirements-tree-content">
          <ConfirmedTree nodes={nodes} selectedId={selectedId} onSelect={onSelect} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function ConfirmedTree({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: ConfirmedRequirementNode[];
  selectedId: string;
  onSelect: (requirement: RequirementRecord) => void;
}) {
  const treeRef = useRef<TreeApi<ConfirmedRequirementNode>>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(360);

  useEffect(() => {
    const element = shellRef.current;
    if (!element) return;
    const updateHeight = () => setHeight(Math.max(240, element.clientHeight));
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (!nodes.length) return <div className="requirements-tree-empty" />;

  return (
    <div ref={shellRef} className="requirement-tree-shell">
      <Tree<ConfirmedRequirementNode>
        key={nodes[0]?.key ?? "confirmed"}
        ref={treeRef}
        data={nodes}
        className="requirement-tree"
        aria-label="已确认需求树"
        height={height}
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
        {ConfirmedTreeRow}
      </Tree>
    </div>
  );
}

function ConfirmedTreeRow({
  node,
  style,
  dragHandle,
}: NodeRendererProps<ConfirmedRequirementNode>) {
  const data = node.data;
  const Icon = data.type === "source" ? BookOpen : FileText;

  return (
    <div
      ref={dragHandle}
      style={style}
      data-node-type={data.type}
      data-selected={node.isSelected ? "true" : undefined}
      data-open={node.isOpen ? "true" : undefined}
      className="requirement-tree-row"
    >
      {data.children.length === 0 ? null : (
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
      )}
      <span className="requirement-tree-icon" aria-hidden>
        <Icon />
      </span>
      <TruncatedText value={data.title} className="requirement-tree-title" />
      {data.type === "source" ? (
        <Badge variant="outline" className="requirement-tree-count">
          {data.count}
        </Badge>
      ) : null}
    </div>
  );
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
