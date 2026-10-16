import { useEffect, useRef, type ReactNode } from "react";
import { Bold as BoldIcon, ImagePlus, ListOrdered, Redo2, Table2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Fragment, Slice } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { Gapcursor, UndoRedo } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { requirementsApi } from "@/features/requirements/api";
import type { RequirementBlockNode } from "@/features/requirements/types";
import { insertAfterNodeSelection } from "../requirements/body/requirement-body-editor-utils";
import {
  Bold,
  Document,
  ListItem,
  ListKeymap,
  RequirementOrderedList,
  RequirementParagraph,
  RequirementPasteCleanup,
  RequirementTable,
  RequirementTableCell,
  RequirementTableHeader,
  TableRow,
  Text,
  shapePastedSlice,
} from "../requirements/body/requirement-tiptap-extensions";
import { AssetImage } from "../requirements/body/requirement-tiptap-image";
import contentStyles from "../requirements/body/requirement-body-content.module.css";
import styles from "./step-rich-cell.module.css";

const EMPTY_DOC: RequirementBlockNode = { type: "doc", content: [{ type: "paragraph" }] };

/** 「输入及操作」禁表格：粘贴切片里的 table 顶层节点直接剥掉（不含表格扩展，粘贴的表格也不保留）。 */
function dropTables(slice: Slice, view: EditorView): Slice {
  const shaped = shapePastedSlice(slice, view);
  const nodes = shaped.content.content;
  const kept = nodes.filter((node) => node.type.name !== "table");
  if (kept.length === nodes.length) return shaped;
  return new Slice(Fragment.fromArray(kept), shaped.openStart, shaped.openEnd);
}

type StepRichEditorProps = {
  doc: RequirementBlockNode | null;
  /** op = 输入及操作（无表格）；act = 实测结果（含表格）。 */
  kind: "op" | "act";
  projectCode: string;
  onDone: (doc: RequirementBlockNode) => void;
  onCancel: () => void;
};

/** 步骤单元格内联编辑器：复用需求正文的扩展集，编辑时顶部出现迷你工具栏。 */
export function StepRichEditor({ doc, kind, projectCode, onDone, onCancel }: StepRichEditorProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);
  const onDoneRef = useRef(onDone);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onDoneRef.current = onDone;
    onCancelRef.current = onCancel;
  });

  const editor = useEditor(
    {
      extensions: [
        Document,
        Text,
        RequirementParagraph,
        Bold,
        UndoRedo,
        // 表格/图片独占单元格时靠 GapCursor 把光标落到块外。
        Gapcursor,
        RequirementOrderedList,
        ListItem,
        ListKeymap.configure({
          listTypes: [{ itemName: "listItem", wrapperNames: ["orderedList"] }],
        }),
        ...(kind === "act"
          ? [
              RequirementTable.configure({ resizable: false }),
              TableRow,
              RequirementTableHeader,
              RequirementTableCell,
            ]
          : []),
        AssetImage.configure({
          projectCode,
          upload: (file: File) => requirementsApi.uploadAsset(projectCode, file),
        }),
        RequirementPasteCleanup,
      ],
      content: doc && (doc.content?.length ?? 0) > 0 ? doc : EMPTY_DOC,
      autofocus: "end",
      editorProps: {
        attributes: {
          class: `${styles.proseMirror} ${contentStyles.surface}`,
          spellcheck: "false",
        },
        transformPasted: kind === "op" ? dropTables : shapePastedSlice,
        handleKeyDown: (_view, event) => {
          if (event.key === "Escape") {
            committedRef.current = true;
            onCancelRef.current();
            return true;
          }
          return false;
        },
      },
    },
    [kind, projectCode],
  );

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      orderedList: current.isActive("orderedList"),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });

  const commit = () => {
    if (!editor || editor.isDestroyed || committedRef.current) return;
    committedRef.current = true;
    onDoneRef.current(editor.getJSON() as RequirementBlockNode);
  };

  // 焦点移出编辑器+工具栏整体才算完成（工具栏按钮用 mousedown preventDefault 不夺焦，这里是兜底）。
  // 提交延迟到 click 派发之后：blur 会立刻把上一格从编辑态切回展示态（行高微变），
  // 若同步重排，本次点击的 mouseup 可能落空、邻格要点两次才进编辑。
  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (next && wrapRef.current?.contains(next)) return;
    window.setTimeout(commit, 0);
  };

  const handleImageChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !editor || editor.isDestroyed) return;
    try {
      const asset = await requirementsApi.uploadAsset(projectCode, file);
      if (editor.isDestroyed) return;
      insertAfterNodeSelection(editor)
        .insertContent({
          type: "assetImage",
          attrs: {
            assetId: asset.id,
            alt: null,
            width: `${asset.width}px`,
            height: `${asset.height}px`,
          },
        })
        .run();
    } catch {
      toast.error("图片上传失败，请重试");
    }
  };

  return (
    <div ref={wrapRef} className={styles.editorWrap} onBlur={handleBlur}>
      <div className={styles.toolbar} role="toolbar" aria-label="步骤格式工具栏">
        <ToolButton
          label="撤销"
          disabled={!state?.canUndo}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 aria-hidden />
        </ToolButton>
        <ToolButton
          label="重做"
          disabled={!state?.canRedo}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 aria-hidden />
        </ToolButton>
        <span className={styles.toolDivider} aria-hidden />
        <ToolButton
          label="粗体"
          active={state?.bold}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <BoldIcon aria-hidden />
        </ToolButton>
        <ToolButton
          label="有序列表"
          active={state?.orderedList}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered aria-hidden />
        </ToolButton>
        <ToolButton label="插入图片" onClick={() => imageInputRef.current?.click()}>
          <ImagePlus aria-hidden />
        </ToolButton>
        {kind === "act" ? (
          <ToolButton
            label="插入表格"
            onClick={() =>
              editor?.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()
            }
          >
            <Table2 aria-hidden />
          </ToolButton>
        ) : null}
      </div>
      <EditorContent editor={editor} />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => void handleImageChosen(event)}
      />
    </div>
  );
}

function ToolButton({
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
    <button
      type="button"
      className={styles.toolButton}
      data-active={active ? "true" : undefined}
      disabled={disabled}
      title={label}
      aria-label={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
