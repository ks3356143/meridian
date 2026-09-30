import { memo, useEffect, useRef, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Bold as BoldIcon,
  Columns3,
  ImagePlus,
  ListIndentDecrease,
  ListIndentIncrease,
  ListOrdered,
  Merge,
  PanelTop,
  Rows3,
  Split,
  Table2,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  TextAlignStart,
  Trash2,
  Type,
} from "lucide-react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { requirementsApi } from "@/features/requirements/api";
import type { RequirementBlockNode } from "@/features/requirements/types";
import {
  AssetImage,
  Bold,
  Document,
  Heading,
  ListItem,
  ListKeymap,
  RequirementOrderedList,
  RequirementParagraph,
  RequirementPasteCleanup,
  RequirementTable,
  TableCell,
  TableHeader,
  TableRow,
  Text,
} from "./requirement-tiptap-extensions";
import styles from "./requirement-body-editor.module.css";

type RequirementBodyEditorProps = {
  doc: RequirementBlockNode;
  projectCode: string;
  session: number;
  focusOnOpen: boolean;
  busy?: boolean;
  onChange: (doc: RequirementBlockNode) => void;
  onReady?: (doc: RequirementBlockNode) => void;
};

function RequirementBodyEditorImpl({
  doc,
  projectCode,
  session,
  focusOnOpen,
  busy = false,
  onChange,
  onReady,
}: RequirementBodyEditorProps) {
  const onChangeRef = useRef(onChange);
  const onReadyRef = useRef(onReady);
  const docRef = useRef(doc);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const suppressUpdateRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  const editor = useEditor(
    {
      extensions: [
        Document,
        Text,
        RequirementParagraph,
        Bold,
        Heading.configure({ levels: [2, 3, 4] }),
        RequirementOrderedList,
        ListItem,
        ListKeymap.configure({
          listTypes: [{ itemName: "listItem", wrapperNames: ["orderedList"] }],
        }),
        RequirementTable.configure({ resizable: false }),
        TableRow,
        TableHeader,
        TableCell,
        AssetImage.configure({
          projectCode,
          upload: (file: File) => requirementsApi.uploadAsset(projectCode, file),
        }),
        RequirementPasteCleanup,
      ],
      content: doc,
      editorProps: {
        attributes: {
          class: styles.proseMirror,
          spellcheck: "false",
        },
      },
      onUpdate: ({ editor: currentEditor }) => {
        if (suppressUpdateRef.current) {
          suppressUpdateRef.current = false;
          return;
        }
        onChangeRef.current(currentEditor.getJSON() as RequirementBlockNode);
      },
    },
    [projectCode],
  );

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    suppressUpdateRef.current = true;
    editor.commands.setContent(docRef.current, { emitUpdate: false });
    onReadyRef.current?.(editor.getJSON() as RequirementBlockNode);
    const frame = window.requestAnimationFrame(() => {
      suppressUpdateRef.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editor, session]);

  useEffect(() => {
    if (!editor || !focusOnOpen || editor.isDestroyed) return;
    const frame = window.requestAnimationFrame(() => {
      if (!editor.isDestroyed) editor.commands.focus("start");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editor, focusOnOpen, session]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(!busy);
  }, [busy, editor]);

  const state = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor.isActive("bold"),
      align: String(currentEditor.getAttributes("paragraph").align ?? ""),
      firstLineIndent: Number(currentEditor.getAttributes("paragraph").firstLineIndent ?? 0),
      caption: currentEditor.getAttributes("paragraph").variant === "tableCaption",
      orderedList: currentEditor.isActive("orderedList"),
      table: currentEditor.isActive("table"),
      tableAlign: String(currentEditor.getAttributes("table").align ?? "center"),
      canSinkList: currentEditor.can().sinkListItem("listItem"),
      canLiftList: currentEditor.can().liftListItem("listItem"),
    }),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => requirementsApi.uploadAsset(projectCode, file),
    onSuccess: (asset) => {
      editor
        ?.chain()
        .focus()
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
    },
  });

  if (!editor || !state) {
    return <div className={styles.editorLoading}>正在初始化正文编辑器…</div>;
  }

  return (
    <section
      className={styles.editorShell}
      data-busy={busy ? "true" : undefined}
      aria-busy={busy ? true : undefined}
      aria-label="需求正文编辑器"
    >
      <div className={styles.toolbar} role="toolbar" aria-label="正文格式工具栏">
        <ToolbarGroup label="基础">
          <ToolbarButton
            label="加粗"
            active={state.bold}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <BoldIcon aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            label="正文段落"
            active={editor.isActive("paragraph")}
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

        <ToolbarGroup label="表格与图片">
          <ToolbarButton
            label="插入表格"
            disabled={state.table}
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
          >
            <Table2 aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            label="插入图片"
            disabled={state.table}
            onClick={() => imageInputRef.current?.click()}
          >
            <ImagePlus aria-hidden />
          </ToolbarButton>
        </ToolbarGroup>

        {state.table ? (
          <ToolbarGroup label="当前表格">
            <ToolbarButton
              label="表格靠左"
              active={state.tableAlign === "left"}
              onClick={() => setTableAlign(editor, "left")}
            >
              表格靠左
            </ToolbarButton>
            <ToolbarButton
              label="表格居中"
              active={state.tableAlign === "center"}
              onClick={() => setTableAlign(editor, "center")}
            >
              表格居中
            </ToolbarButton>
            <ToolbarButton
              label="表格靠右"
              active={state.tableAlign === "right"}
              onClick={() => setTableAlign(editor, "right")}
            >
              表格靠右
            </ToolbarButton>
            <ToolbarButton
              label="插入行"
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              <Rows3 aria-hidden />
              插入行
            </ToolbarButton>
            <ToolbarButton label="删除行" onClick={() => editor.chain().focus().deleteRow().run()}>
              <Trash2 aria-hidden />
              删行
            </ToolbarButton>
            <ToolbarButton
              label="插入列"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            >
              <Columns3 aria-hidden />
              插入列
            </ToolbarButton>
            <ToolbarButton
              label="删除列"
              onClick={() => editor.chain().focus().deleteColumn().run()}
            >
              <Trash2 aria-hidden />
              删列
            </ToolbarButton>
            <ToolbarButton
              label="切换表头"
              onClick={() => editor.chain().focus().toggleHeaderRow().run()}
            >
              <PanelTop aria-hidden />
              表头
            </ToolbarButton>
            <ToolbarButton
              label="合并或拆分单元格"
              onClick={() => editor.chain().focus().mergeOrSplit().run()}
            >
              <Merge aria-hidden />
              <Split aria-hidden />
              合并/拆分
            </ToolbarButton>
          </ToolbarGroup>
        ) : null}
      </div>

      <input
        ref={imageInputRef}
        className={styles.hiddenInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) uploadMutation.mutate(file);
          event.target.value = "";
        }}
      />

      <EditorContent editor={editor} className={styles.editorContent} />
      {uploadMutation.isPending ? (
        <p className={styles.uploadStatus} aria-live="polite">
          正在上传图片…
        </p>
      ) : null}
      {uploadMutation.isError ? (
        <p className={styles.uploadError} role="alert">
          图片上传失败，请重试。
        </p>
      ) : null}
    </section>
  );
}

function ToolbarGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.toolbarGroup} role="group" aria-label={label}>
      <span className={styles.toolbarGroupLabel}>{label}</span>
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
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function setTableAlign(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  align: "left" | "center" | "right",
) {
  editor.chain().focus().updateAttributes("table", { align }).run();
}

export const RequirementBodyEditor = memo(RequirementBodyEditorImpl);
