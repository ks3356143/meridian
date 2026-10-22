import { useCallback, useEffect, useRef, useState, memo } from "react";
import {
  ChevronRight,
  ClipboardList,
  CopyPlus,
  Folder,
  FolderOpen,
  ListChecks,
  Pencil,
  Trash2,
  Wand2,
} from "lucide-react";
import {
  Tree,
  type MoveHandler,
  type NodeApi,
  type NodeRendererProps,
  type RowRendererProps,
  type TreeApi,
} from "react-arborist";
import { cn } from "cn";
import { TruncatedText } from "@/components/shared/truncated-text";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { caseStatusLabel, categoryTone } from "./test-items-design";
import { startInlineRename, type TestItemsTreeNode } from "./test-items-tree-model";
import styles from "./test-items-tree.module.css";

/** 右键菜单动作：删除类动作由工作台弹二次确认，不在这里直接执行。 */
export type TestItemsTreeAction = "duplicate" | "delete" | "generateCase";

/** 拖拽信息：dragIds / parentId 都是树节点 id（item: / case: / folder: / group: 前缀）。 */
export type TestItemsTreeMove = {
  dragIds: string[];
  parentId: string | null;
  index: number;
  /** 按住 Ctrl/Command 拖拽：复制而非移动。 */
  copy: boolean;
};

/** 搜索/筛选态整树不参与拖拽：过滤后的落点序号与真实数据会错位。 */
function blockDragDuringSearch() {
  return true;
}

/** 分组与文件夹只做容器，不允许被拖动。 */
function isNodeDragDisabled(data: TestItemsTreeNode) {
  return data.kind === "group" || data.kind === "folder";
}

/**
 * 拖拽落点规则（返回 true = 禁止落下）：用例只能在测试项之间落位；
 * 测试项只能落在同类型的分组或文件夹下，避免跨类型串枝。
 */
function isDropBlocked({
  parentNode,
  dragNodes,
}: {
  parentNode: NodeApi<TestItemsTreeNode>;
  dragNodes: NodeApi<TestItemsTreeNode>[];
}) {
  const target = parentNode.data;
  const drag = dragNodes[0]?.data;
  if (!drag) return true;
  if (drag.kind === "case") return target.kind !== "item";
  if (drag.kind === "item") {
    if (target.kind !== "group" && target.kind !== "folder") return true;
    return target.typeCode !== drag.typeCode;
  }
  return true;
}

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
  selectedCaseId,
  onSelect,
  treeRef,
  forceExpanded = false,
  onAction,
  onRenameNode,
  onMoveNode,
}: {
  nodes: TestItemsTreeNode[];
  storageKey: string;
  selectedId: string;
  /** 详情用例行点过来的用例 id：树里高亮该用例节点。 */
  selectedCaseId?: string;
  onSelect: (node: TestItemsTreeNode) => void;
  treeRef: React.RefObject<TreeApi<TestItemsTreeNode> | null>;
  /** 搜索/筛选态：强制展开全部命中分支，退出时恢复手动展开记忆。 */
  forceExpanded?: boolean;
  onAction?: (node: TestItemsTreeNode, action: TestItemsTreeAction) => void;
  onRenameNode?: (node: TestItemsTreeNode, name: string) => void;
  onMoveNode?: (move: TestItemsTreeMove) => void;
}) {
  const { ref: shellRef, height } = useElementHeight<HTMLDivElement>();
  const [initialOpenState] = useState(() => readOpenState(storageKey));
  const forceExpandedRef = useRef(forceExpanded);
  // 右键菜单只挂一个（树级），按右键落点找目标行：每行一个 Radix 菜单会把整行重渲染成本抬高一倍。
  const [menuNode, setMenuNode] = useState<NodeApi<TestItemsTreeNode> | null>(null);
  // react-arborist 的 onMove 不暴露原生事件，按键状态在树级监听；拖拽过程中按下/松开 Ctrl 都即时生效。
  const copyModifierRef = useRef(false);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Control" || event.key === "Meta") copyModifierRef.current = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Control" || event.key === "Meta") copyModifierRef.current = false;
    };
    const onBlur = () => {
      copyModifierRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
  // 树的 props 保持稳定引用：react-arborist 的拖拽/行渲染都以 props 变更为失效信号，
  // 每次渲染换新回调会让所有行重挂拖拽源，行数一多就掉帧。
  //
  // onToggle 在 openAll/closeAll 时是"每个节点回调一次"（200 个节点就是 200 次）：
  // 每次写一遍 localStorage 会把一次展开钉成几百毫秒的长任务，必须先合并再落盘。
  const saveTimerRef = useRef<number | null>(null);
  const handleToggle = useCallback(() => {
    // 搜索/筛选态不覆写展开记忆：退出筛选后要还原用户手动开合。
    if (forceExpandedRef.current) return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      const tree = treeRef.current;
      if (tree) writeOpenState(storageKey, tree);
    }, 200);
  }, [storageKey, treeRef]);
  useEffect(
    () => () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    },
    [],
  );

  const renderRow = useCallback(
    (rowProps: RowRendererProps<TestItemsTreeNode>) => (
      <TestItemsTreeRowHost {...rowProps} onSelect={onSelect} />
    ),
    [onSelect],
  );
  const renderNode = useCallback(
    ({ node, style, dragHandle }: NodeRendererProps<TestItemsTreeNode>) => (
      <TestItemsTreeRow node={node} style={style} dragHandle={dragHandle} />
    ),
    [],
  );
  const handleMove = useCallback<MoveHandler<TestItemsTreeNode>>(
    (move) => onMoveNode?.({ ...move, copy: copyModifierRef.current }),
    [onMoveNode],
  );
  const selectedKey = selectedCaseId
    ? `case:${selectedCaseId}`
    : selectedId
      ? `item:${selectedId}`
      : "";

  // 搜索/筛选激活：展开全部命中分支；退出：恢复用户手动记忆的展开态。
  useEffect(() => {
    const tree = treeRef.current;
    if (!tree) return;
    if (forceExpanded) {
      tree.openAll();
    } else if (forceExpandedRef.current) {
      tree.closeAll();
      const state = readOpenState(storageKey);
      for (const [id, open] of Object.entries(state)) {
        if (open) tree.open(id);
      }
    }
    forceExpandedRef.current = forceExpanded;
  }, [forceExpanded, nodes, storageKey, treeRef]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={styles.shell}
          ref={shellRef}
          onContextMenu={(event) => {
            const target = event.target as HTMLElement | null;
            const row = target?.closest?.('[role="treeitem"]');
            const id = row?.getAttribute("data-id") ?? "";
            const kind = row?.getAttribute("data-kind") ?? "";
            // 分组行没有菜单：阻止 Radix 打开空菜单盒。
            if (id === "" || kind === "group") {
              setMenuNode(null);
              event.preventDefault();
              return;
            }
            setMenuNode(treeRef.current?.get(id) ?? null);
          }}
        >
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
              disableDrag={forceExpanded ? blockDragDuringSearch : isNodeDragDisabled}
              disableDrop={isDropBlocked}
              onMove={handleMove}
              onToggle={handleToggle}
              renderRow={renderRow}
            >
              {renderNode}
            </Tree>
          ) : null}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {menuNode ? (
          <TestItemsContextMenuContent
            node={menuNode}
            onAction={onAction}
            onRenameNode={onRenameNode}
          />
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
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
  const row = (
    <div
      {...attrs}
      ref={innerRef}
      role="treeitem"
      tabIndex={-1}
      data-id={node.id}
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
  return row;
}

/** 菜单项按节点类型渲染；动作由工作台接管（删除类先弹二次确认）。 */
function TestItemsContextMenuContent({
  node,
  onAction,
  onRenameNode,
}: {
  node: NodeApi<TestItemsTreeNode>;
  onAction?: (node: TestItemsTreeNode, action: TestItemsTreeAction) => void;
  onRenameNode?: (node: TestItemsTreeNode, name: string) => void;
}) {
  const startRename = () => void startInlineRename(node, onRenameNode);
  const data = node.data;
  if (data.kind === "folder") {
    return (
      <>
        <ContextMenuItem onSelect={startRename}>
          <Pencil aria-hidden />
          重命名
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={() => onAction?.(data, "delete")}>
          <Trash2 aria-hidden />
          删除文件夹
        </ContextMenuItem>
      </>
    );
  }
  if (data.kind === "item") {
    return (
      <>
        <ContextMenuItem disabled={data.isStatic} onSelect={() => onAction?.(data, "duplicate")}>
          <CopyPlus aria-hidden />
          复制新增
        </ContextMenuItem>
        <ContextMenuItem onSelect={startRename}>
          <Pencil aria-hidden />
          重命名
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onAction?.(data, "generateCase")}>
          <Wand2 aria-hidden />
          生成用例
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={() => onAction?.(data, "delete")}>
          <Trash2 aria-hidden />
          删除测试项
        </ContextMenuItem>
      </>
    );
  }
  return (
    <>
      <ContextMenuItem onSelect={startRename}>
        <Pencil aria-hidden />
        重命名
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => onAction?.(data, "duplicate")}>
        <CopyPlus aria-hidden />
        复制新增
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onSelect={() => onAction?.(data, "delete")}>
        <Trash2 aria-hidden />
        删除用例
      </ContextMenuItem>
    </>
  );
}

/** 行内重命名输入：复用行高，Enter 提交 / Esc 取消 / 失焦取消。 */
function TreeRenameInput({ node }: { node: NodeApi<TestItemsTreeNode> }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      className={styles.renameInput}
      defaultValue={node.data.label}
      aria-label="重命名"
      onClick={(event) => event.stopPropagation()}
      onBlur={() => node.reset()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          node.reset();
        }
        if (event.key === "Enter") {
          event.preventDefault();
          node.submit(event.currentTarget.value);
        }
      }}
    />
  );
}

function TestItemsTreeRow({
  node,
  style,
  dragHandle,
}: {
  node: NodeApi<TestItemsTreeNode>;
  style: React.CSSProperties;
  dragHandle?: (el: HTMLDivElement | null) => void;
}) {
  const data = node.data;
  const tone = categoryTone(data.category ?? "");
  const isContainer = data.kind === "group" || data.kind === "folder";
  // 每层都给类型图标：文件夹 Folder / 测试项 ListChecks / 用例 ClipboardList，层级一眼分清。
  const Icon = isContainer
    ? node.isOpen
      ? FolderOpen
      : Folder
    : data.kind === "case"
      ? ClipboardList
      : ListChecks;
  const hasMeta =
    data.count !== undefined ||
    (data.kind === "group" && Boolean(data.typeCode)) ||
    (data.kind === "item" && Boolean(data.staticBadge || data.implicit || data.incomplete)) ||
    data.kind === "case";

  return (
    <div style={style} className={styles.row} ref={dragHandle}>
      <span
        className={styles.twisty}
        data-open={node.isOpen ? "true" : "false"}
        // 折叠箭头自己消费点击：行点击是"选中"，箭头才是展开/收起。
        onClick={(event) => {
          event.stopPropagation();
          if (!node.isLeaf) node.toggle();
        }}
        aria-hidden
      >
        {node.isLeaf ? (
          <span className={styles.leafDot} />
        ) : (
          <ChevronRight className={styles.twistyIcon} />
        )}
      </span>
      <Icon className={styles.icon} aria-hidden />
      {data.kind === "case" ? <span className={styles.caseDot} data-status={data.status} /> : null}
      {data.kind === "item" && !data.isStatic ? (
        <span className={styles.toneDot} data-tone={tone} aria-hidden />
      ) : null}
      {data.identifier ? <span className={styles.ident}>{data.identifier}</span> : null}
      {node.isEditing ? (
        <TreeRenameInput node={node} />
      ) : (
        // 只在真实溢出时挂 Tooltip；长标签省略后不再挤开右侧状态徽章。
        <TruncatedText value={data.label} tooltipValue={data.label} className={styles.label} />
      )}
      {hasMeta ? (
        <span className={styles.meta}>
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
              {data.staticBadge ? (
                <span className={styles.staticProgress}>{data.staticBadge}</span>
              ) : null}
              {data.implicit ? <span className={styles.implicitChip}>隐含</span> : null}
              {data.incomplete ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={styles.incomplete}>未完善</span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {data.missing?.length ? `缺：${data.missing.join("、")}` : "未完善"}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </>
          ) : null}
          {data.kind === "case" ? (
            <span className={styles.caseStatus} data-status={data.status}>
              {caseStatusLabel(data.status ?? "pending")}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

/** 树的 props 全部稳定（nodes/selectedId/onSelect/treeRef），memo 掉无关重渲染。 */
export const TestItemsTree = memo(TestItemsTreeInner);
