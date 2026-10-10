import { useEffect, useRef, useState, memo } from "react";
import { ChevronRight, Folder, FolderOpen, ListChecks } from "lucide-react";
import {
  Tree,
  type NodeApi,
  type NodeRendererProps,
  type RowRendererProps,
  type TreeApi,
} from "react-arborist";
import { cn } from "cn";
import { TruncatedText } from "@/components/shared/truncated-text";
import { caseStatusLabel, categoryTone } from "./test-items-design";
import type { TestItemsTreeNode } from "./test-items-tree-model";
import styles from "./test-items-tree.module.css";

function useElementHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      setHeight(Math.round(entries[0].contentRect.height));
    });
    observer.observe(element);
    setHeight(element.clientHeight);
    return () => observer.disconnect();
  }, []);

  return { ref, height };
}

type OpenState = Record<string, boolean>;

function readOpenState(storageKey: string): OpenState {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as OpenState) : {};
  } catch {
    return {};
  }
}

// 展开状态按项目记忆：只记录可见节点的开合，隐藏祖先的开合状态保持不变。
function writeOpenState(storageKey: string, tree: TreeApi<TestItemsTreeNode>) {
  const state: OpenState = {};
  for (const node of tree.visibleNodes) {
    if (!node.isLeaf) state[node.id] = node.isOpen;
  }
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // 本地存储不可用时忽略，展开状态仅本次会话有效。
  }
}

function TestItemsTreeInner({
  nodes,
  storageKey,
  selectedId,
  onSelect,
  treeRef,
}: {
  nodes: TestItemsTreeNode[];
  storageKey: string;
  selectedId: string;
  onSelect: (node: TestItemsTreeNode) => void;
  treeRef: React.RefObject<TreeApi<TestItemsTreeNode> | null>;
}) {
  const { ref: shellRef, height } = useElementHeight<HTMLDivElement>();
  const [initialOpenState] = useState(() => readOpenState(storageKey));
  const selectedKey = selectedId ? `item:${selectedId}` : "";

  return (
    <div className={styles.shell} ref={shellRef}>
      {height > 0 ? (
        <Tree<TestItemsTreeNode>
          ref={treeRef}
          data={nodes}
          className={styles.tree}
          aria-label="测试项树"
          height={height}
          width="100%"
          rowHeight={30}
          indent={14}
          overscanCount={12}
          openByDefault={false}
          initialOpenState={initialOpenState}
          selection={selectedKey || undefined}
          disableMultiSelection
          disableDrag
          disableDrop
          disableEdit
          onToggle={() => {
            const tree = treeRef.current;
            if (tree) writeOpenState(storageKey, tree);
          }}
          renderRow={(rowProps) => <TestItemsTreeRowHost {...rowProps} onSelect={onSelect} />}
        >
          {({ node, style }: NodeRendererProps<TestItemsTreeNode>) => (
            <TestItemsTreeRow node={node} style={style} />
          )}
        </Tree>
      ) : null}
    </div>
  );
}

function handleNodeClick(
  node: NodeApi<TestItemsTreeNode>,
  onSelect?: (node: TestItemsTreeNode) => void,
) {
  const data = node.data;
  if (data.kind === "group" || data.kind === "folder") {
    node.toggle();
    return;
  }
  node.select();
  node.focus();
  onSelect?.(data);
}

function TestItemsTreeRowHost({
  node,
  attrs,
  innerRef,
  children,
  onSelect,
}: RowRendererProps<TestItemsTreeNode> & {
  onSelect: (node: TestItemsTreeNode) => void;
}) {
  return (
    <div
      {...attrs}
      ref={innerRef}
      role="treeitem"
      tabIndex={-1}
      className={cn(styles.rowHost, node.isSelected && styles.rowSelected)}
      data-kind={node.data.kind}
      data-tone={categoryTone(node.data.category ?? "")}
      data-incomplete={node.data.incomplete ? "true" : undefined}
      onClick={() => handleNodeClick(node, onSelect)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        handleNodeClick(node, onSelect);
      }}
    >
      {children}
    </div>
  );
}

function TestItemsTreeRow({
  node,
  style,
}: {
  node: NodeApi<TestItemsTreeNode>;
  style: React.CSSProperties;
}) {
  const data = node.data;
  const tone = categoryTone(data.category ?? "");
  const isContainer = data.kind === "group" || data.kind === "folder";
  const Icon = isContainer ? (node.isOpen ? FolderOpen : Folder) : ListChecks;

  return (
    <div style={style} className={styles.row}>
      <span className={styles.twisty} data-open={node.isOpen ? "true" : "false"} aria-hidden>
        {node.isLeaf ? (
          <span className={styles.leafDot} />
        ) : (
          <ChevronRight className={styles.twistyIcon} />
        )}
      </span>
      {data.kind === "case" ? (
        <span className={styles.caseDot} data-status={data.status} />
      ) : (
        <Icon className={styles.icon} aria-hidden />
      )}
      {data.kind === "item" && !data.isStatic ? (
        <span className={styles.toneDot} data-tone={tone} aria-hidden />
      ) : null}
      {data.identifier ? <span className={styles.ident}>{data.identifier}</span> : null}
      <TruncatedText value={data.label} className={styles.label} tooltipValue={data.label} />
      {data.count !== undefined ? (
        <span className={styles.count} data-tone={data.kind === "group" ? tone : undefined}>
          {data.count}
        </span>
      ) : null}
      {data.kind === "group" && data.typeCode ? (
        <span className={styles.typeChip} data-tone={tone}>
          {data.typeCode}
        </span>
      ) : null}
      {data.kind === "item" ? (
        <>
          {data.implicit ? <span className={styles.implicitChip}>隐含</span> : null}
          {data.incomplete ? (
            <span
              className={styles.incomplete}
              title={data.missing?.length ? `缺：${data.missing.join("、")}` : "未完善"}
            >
              未完善
            </span>
          ) : null}
        </>
      ) : null}
      {data.kind === "case" ? (
        <span className={styles.caseStatus} data-status={data.status}>
          {caseStatusLabel(data.status ?? "pending")}
        </span>
      ) : null}
    </div>
  );
}

/** 树的 props 全部稳定（nodes/selectedId/onSelect/treeRef），memo 掉无关重渲染。 */
export const TestItemsTree = memo(TestItemsTreeInner);
