import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { useEditor } from "@tiptap/react";

// 编辑器工具栏的领域操作（表格表头规则、原子节点插入位置等）。
// 抽成独立模块以便富文本在其它业务域复用时共用同一套行为。

// 图片等原子节点被整体选中（NodeSelection）时，直接插入内容会被 replaceSelectionWith
// 替换掉原节点（例如"点图片后插表格/传图片"会删除图片）。统一先把光标折叠到节点之后的
// 最近合法文本位置，再执行插入。
export function insertAfterNodeSelection(editor: NonNullable<ReturnType<typeof useEditor>>) {
  const chain = editor.chain().focus();
  const { selection } = editor.state;
  if (selection instanceof NodeSelection) {
    const pos = TextSelection.near(editor.state.doc.resolve(selection.to), 1).from;
    chain.setTextSelection(pos);
  }
  return chain;
}

// 光标所在行是否整行都是表头格；“表头”按钮的高亮跟随这个状态。
export function currentRowIsHeaderRow(editor: NonNullable<ReturnType<typeof useEditor>>) {
  const { $from } = editor.state.selection;
  let rowNode: PMNode | null = null;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "tableRow") {
      rowNode = node;
      break;
    }
  }
  if (!rowNode || rowNode.childCount === 0) return false;
  for (let index = 0; index < rowNode.childCount; index += 1) {
    if (rowNode.child(index).type.name !== "tableHeader") return false;
  }
  return true;
}

// 把光标所在行的所有单元格在“表头行 / 普通行”之间整行切换。
// 不用 Tiptap 的 toggleHeaderRow：该命令在当前 schema 下恒作用于首行，
// 导致拆分残留的非首行表头格无法取消。
export function toggleCurrentRowHeader(editor: NonNullable<ReturnType<typeof useEditor>>) {
  const { state } = editor;
  const { $from } = state.selection;
  let rowDepth = -1;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "tableRow") {
      rowDepth = depth;
      break;
    }
  }
  if (rowDepth < 0) return;
  const row = $from.node(rowDepth);
  if (row.childCount === 0) return;
  let allHeader = true;
  for (let index = 0; index < row.childCount; index += 1) {
    if (row.child(index).type.name !== "tableHeader") {
      allHeader = false;
      break;
    }
  }
  const targetType = allHeader ? state.schema.nodes.tableCell : state.schema.nodes.tableHeader;
  if (!targetType) return;
  const rowStart = $from.before(rowDepth);
  const tr = state.tr;
  let changed = false;
  row.forEach((cell, offset) => {
    if (cell.type !== targetType) {
      tr.setNodeMarkup(rowStart + 1 + offset, targetType, cell.attrs);
      changed = true;
    }
  });
  if (changed) editor.view.dispatch(tr.scrollIntoView());
}

// prosemirror-tables 拆分跨行表头格时，会把表头类型沿用到非首行的新格子，
// 产生“一行里既有表头又有普通格”的混合行。整行表头是用户主动设置的表头行
// （表头按钮按整行切换），混合行则判定为拆分残留：把非首行的混合行整行降级
// 为普通格。修正只作用于光标所在表格，且不进撤销历史，Ctrl+Z 一次可撤回整个拆分。
export function normalizeSplitHeaderRows(editor: NonNullable<ReturnType<typeof useEditor>>) {
  const { state } = editor;
  const cellType = state.schema.nodes.tableCell;
  if (!cellType) return;
  const $pos = state.selection.$from;
  let tableStart = -1;
  let tableEnd = -1;
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name !== "table") continue;
    tableStart = $pos.before(depth);
    tableEnd = tableStart + $pos.node(depth).nodeSize;
    break;
  }
  if (tableStart < 0) return;
  const tr = state.tr;
  let changed = false;
  state.doc.descendants((node, pos, parent, index) => {
    if (node.type.name !== "tableRow" || parent?.type.name !== "table" || index === 0) return true;
    if (pos < tableStart || pos >= tableEnd) return true;
    let headerCount = 0;
    let cellCount = 0;
    const headerCells: { pos: number; attrs: PMNode["attrs"] }[] = [];
    node.forEach((cell, offset) => {
      cellCount += 1;
      if (cell.type.name === "tableHeader") {
        headerCount += 1;
        headerCells.push({ pos: pos + 1 + offset, attrs: cell.attrs });
      }
    });
    if (headerCount === 0 || headerCount === cellCount) return false;
    for (const cell of headerCells) tr.setNodeMarkup(cell.pos, cellType, cell.attrs);
    changed = true;
    return false;
  });
  if (changed) editor.view.dispatch(tr.setMeta("addToHistory", false));
}

export function setTableAlign(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  align: "left" | "center" | "right",
) {
  editor.chain().focus().updateAttributes("table", { align }).run();
}

export function setImageAlign(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  align: "left" | "center" | "right",
) {
  editor.chain().focus().updateAttributes("assetImage", { align }).run();
}
