import type { ReactNode } from "react";
import {
  Bold as BoldIcon,
  Columns3,
  ImagePlus,
  ListIndentDecrease,
  ListIndentIncrease,
  ListOrdered,
  Merge,
  PanelTop,
  Redo2,
  Rows3,
  Split,
  Table2,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  TextAlignStart,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import type { useEditor } from "@tiptap/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  insertAfterNodeSelection,
  normalizeSplitHeaderRows,
  setImageAlign,
  setTableAlign,
  toggleCurrentRowHeader,
} from "./requirement-body-editor-utils";
import styles from "./requirement-body-editor.module.css";

// 工具栏状态由宿主组件通过 useEditorState 计算后传入，便于编辑器核心与工具栏复用到其它业务域。
export type RequirementBodyToolbarState = {
  bold: boolean;
  paragraph: boolean;
  align: string;
  firstLineIndent: number;
  caption: boolean;
  orderedList: boolean;
  table: boolean;
  tableAlign: string;
  image: boolean;
  imageAlign: string;
  canSinkList: boolean;
  canLiftList: boolean;
  canUndo: boolean;
  canRedo: boolean;
  tableHeaderRow: boolean;
  canMergeOrSplit: boolean;
  canDeleteRow: boolean;
  canDeleteColumn: boolean;
};

type RequirementBodyToolbarProps = {
  editor: NonNullable<ReturnType<typeof useEditor>>;
  state: RequirementBodyToolbarState;
  onPickImage: () => void;
};

export function RequirementBodyToolbar({
  editor,
  state,
  onPickImage,
}: RequirementBodyToolbarProps) {
  return (
    <div className={styles.toolbar} role="toolbar" aria-label="正文格式工具栏">
      <ToolbarGroup label="基础">
        <ToolbarButton
          label="撤销"
          disabled={!state.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="重做"
          disabled={!state.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="加粗"
          active={state.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldIcon aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="正文段落"
          active={state.paragraph}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <Type aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="表题"
          active={state.caption}
          onClick={() => editor.chain().focus().toggleTableCaption().run()}
        >
          表题
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarGroup label="段落对齐">
        <ToolbarButton
          label="左对齐"
          active={state.align === "left"}
          onClick={() => editor.chain().focus().setParagraphAlign("left").run()}
        >
          <TextAlignStart aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="居中"
          active={state.align === "center"}
          onClick={() => editor.chain().focus().setParagraphAlign("center").run()}
        >
          <TextAlignCenter aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="右对齐"
          active={state.align === "right"}
          onClick={() => editor.chain().focus().setParagraphAlign("right").run()}
        >
          <TextAlignEnd aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="两端对齐"
          active={state.align === "justify"}
          onClick={() => editor.chain().focus().setParagraphAlign("justify").run()}
        >
          <TextAlignJustify aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="首行缩进 2 字符"
          active={state.firstLineIndent === 2}
          onClick={() =>
            editor
              .chain()
              .focus()
              .setParagraphFirstLineIndent(state.firstLineIndent === 2 ? 0 : 2)
              .run()
          }
        >
          首行缩进
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarGroup label="有序列表">
        <ToolbarButton
          label="有序列表"
          active={state.orderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="增加列表层级"
          disabled={!state.canSinkList}
          onClick={() => editor.chain().focus().sinkListItem("listItem").run()}
        >
          <ListIndentIncrease aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="减少列表层级"
          disabled={!state.canLiftList}
          onClick={() => editor.chain().focus().liftListItem("listItem").run()}
        >
          <ListIndentDecrease aria-hidden />
        </ToolbarButton>
      </ToolbarGroup>

      {/* 表格 / 图片工具常驻，避免光标进出表格时工具栏跳变；不在表格内时按钮置灰。 */}
      <ToolbarGroup label="表格">
        <ToolbarButton
          label="插入表格"
          disabled={state.table}
          onClick={() =>
            insertAfterNodeSelection(editor)
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          <Table2 aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="表格靠左"
          disabled={!state.table}
          active={state.table && state.tableAlign === "left"}
          onClick={() => setTableAlign(editor, "left")}
        >
          左
        </ToolbarButton>
        <ToolbarButton
          label="表格居中"
          disabled={!state.table}
          active={state.table && state.tableAlign === "center"}
          onClick={() => setTableAlign(editor, "center")}
        >
          中
        </ToolbarButton>
        <ToolbarButton
          label="表格靠右"
          disabled={!state.table}
          active={state.table && state.tableAlign === "right"}
          onClick={() => setTableAlign(editor, "right")}
        >
          右
        </ToolbarButton>
        <ToolbarButton
          label="插入行"
          disabled={!state.table}
          onClick={() => editor.chain().focus().addRowAfter().run()}
        >
          <Rows3 aria-hidden />
          插入行
        </ToolbarButton>
        <ToolbarButton
          label="删除行"
          disabled={!state.table || !state.canDeleteRow}
          onClick={() => editor.chain().focus().deleteRow().run()}
        >
          <Trash2 aria-hidden />
          删行
        </ToolbarButton>
        <ToolbarButton
          label="插入列"
          disabled={!state.table}
          onClick={() => editor.chain().focus().addColumnAfter().run()}
        >
          <Columns3 aria-hidden />
          插入列
        </ToolbarButton>
        <ToolbarButton
          label="删除列"
          disabled={!state.table || !state.canDeleteColumn}
          onClick={() => editor.chain().focus().deleteColumn().run()}
        >
          <Trash2 aria-hidden />
          删列
        </ToolbarButton>
        <ToolbarButton
          label="切换表头"
          disabled={!state.table}
          active={state.tableHeaderRow}
          onClick={() => toggleCurrentRowHeader(editor)}
        >
          <PanelTop aria-hidden />
          表头
        </ToolbarButton>
        <ToolbarButton
          label="合并或拆分单元格"
          disabled={!state.table || !state.canMergeOrSplit}
          onClick={() => {
            const merging = editor.can().mergeCells();
            editor.chain().focus().mergeOrSplit().run();
            // 只在拆分路径上做表头降级修正，避免影响既有非首行表头（历史数据）。
            if (!merging) normalizeSplitHeaderRows(editor);
          }}
        >
          <Merge aria-hidden />
          <Split aria-hidden />
          合并/拆分
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarGroup label="图片">
        <ToolbarButton label="插入图片" disabled={state.table} onClick={() => onPickImage()}>
          <ImagePlus aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label="图片靠左"
          disabled={!state.image}
          active={state.image && state.imageAlign === "left"}
          onClick={() => setImageAlign(editor, "left")}
        >
          左
        </ToolbarButton>
        <ToolbarButton
          label="图片居中"
          disabled={!state.image}
          active={state.image && state.imageAlign !== "left" && state.imageAlign !== "right"}
          onClick={() => setImageAlign(editor, "center")}
        >
          中
        </ToolbarButton>
        <ToolbarButton
          label="图片靠右"
          disabled={!state.image}
          active={state.image && state.imageAlign === "right"}
          onClick={() => setImageAlign(editor, "right")}
        >
          右
        </ToolbarButton>
      </ToolbarGroup>
    </div>
  );
}
function ToolbarGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.toolbarGroup} role="group" aria-label={label}>
      <Badge variant="primary" className={styles.toolbarGroupLabel}>
        {label}
      </Badge>
      <div className={styles.toolbarGroupItems}>{children}</div>
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="xs"
      variant={active ? "default" : "ghost"}
      className={styles.toolbarButton}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      title={label}
      disabled={disabled}
      // 编辑器工具栏标准做法：不让按钮抢走编辑器焦点，否则点击后 Ctrl+Z 等快捷键会失效。
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
