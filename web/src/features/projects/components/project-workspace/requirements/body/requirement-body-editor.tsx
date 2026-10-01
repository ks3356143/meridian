import { memo, useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { useMutation } from "@tanstack/react-query";
import { UndoRedo } from "@tiptap/extensions";
import { EditorState } from "@tiptap/pm/state";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { requirementsApi } from "@/features/requirements/api";
import type { RequirementBlockNode } from "@/features/requirements/types";
import { currentRowIsHeaderRow, insertAfterNodeSelection } from "./requirement-body-editor-utils";
import { RequirementBodyToolbar } from "./requirement-body-toolbar";
import {
  Bold,
  Document,
  Heading,
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
} from "./requirement-tiptap-extensions";
import { AssetImage } from "./requirement-tiptap-image";
import styles from "./requirement-body-editor.module.css";

// ponytail: 文档 JSON 只在保存时读取，避免每次输入都序列化整篇正文。
export type RequirementBodyEditorHandle = {
  getDoc: () => RequirementBlockNode | null;
};

type RequirementBodyEditorProps = {
  doc: RequirementBlockNode;
  projectCode: string;
  session: number;
  focusOnOpen: boolean;
  busy?: boolean;
  handleRef?: Ref<RequirementBodyEditorHandle>;
  onChange: () => void;
};

function RequirementBodyEditorImpl({
  doc,
  projectCode,
  session,
  focusOnOpen,
  busy = false,
  handleRef,
  onChange,
}: RequirementBodyEditorProps) {
  const onChangeRef = useRef(onChange);
  const docRef = useRef(doc);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const suppressUpdateRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

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
        UndoRedo,
        Heading.configure({ levels: [2, 3, 4] }),
        RequirementOrderedList,
        ListItem,
        ListKeymap.configure({
          listTypes: [{ itemName: "listItem", wrapperNames: ["orderedList"] }],
        }),
        RequirementTable.configure({ resizable: false }),
        TableRow,
        RequirementTableHeader,
        RequirementTableCell,
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
      onUpdate: () => {
        if (suppressUpdateRef.current) {
          suppressUpdateRef.current = false;
          return;
        }
        onChangeRef.current();
      },
    },
    [projectCode],
  );

  useImperativeHandle(
    handleRef,
    () => ({
      getDoc: () =>
        editor && !editor.isDestroyed ? (editor.getJSON() as RequirementBlockNode) : null,
    }),
    [editor],
  );

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    suppressUpdateRef.current = true;
    // ponytail: 切需求是整篇替换，直接重建 EditorState —— 正文与撤销历史一起换新，
    // 否则 Ctrl+Z 会退回到上一份需求的正文（Tiptap 实例保持挂载，不重建编辑器）。
    try {
      editor.view.updateState(
        EditorState.create({
          doc: editor.schema.nodeFromJSON(docRef.current),
          plugins: editor.state.plugins,
        }),
      );
      // 空事务只为刷新工具栏状态；docChanged 为 false，不触发 onUpdate / 脏标记。
      editor.view.dispatch(editor.state.tr.setMeta("addToHistory", false));
    } catch {
      editor
        .chain()
        .setMeta("addToHistory", false)
        .setContent(docRef.current, { emitUpdate: false })
        .run();
    }
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
    selector: ({ editor: currentEditor }) => {
      return {
        bold: currentEditor.isActive("bold"),
        paragraph: currentEditor.isActive("paragraph"),
        align: String(currentEditor.getAttributes("paragraph").align ?? ""),
        firstLineIndent: Number(currentEditor.getAttributes("paragraph").firstLineIndent ?? 0),
        caption: currentEditor.getAttributes("paragraph").variant === "tableCaption",
        orderedList: currentEditor.isActive("orderedList"),
        table: currentEditor.isActive("table"),
        tableAlign: String(currentEditor.getAttributes("table").align ?? "center"),
        image: currentEditor.isActive("assetImage"),
        imageAlign: String(currentEditor.getAttributes("assetImage").align ?? ""),
        canSinkList: currentEditor.can().sinkListItem("listItem"),
        canLiftList: currentEditor.can().liftListItem("listItem"),
        canUndo: currentEditor.can().undo(),
        canRedo: currentEditor.can().redo(),
        tableHeaderRow: currentRowIsHeaderRow(currentEditor),
        canMergeOrSplit: currentEditor.can().mergeOrSplit(),
        canDeleteRow: currentEditor.can().deleteRow(),
        canDeleteColumn: currentEditor.can().deleteColumn(),
      };
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => requirementsApi.uploadAsset(projectCode, file),
    onSuccess: (asset) => {
      if (!editor || editor.isDestroyed) return;
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
      <RequirementBodyToolbar
        editor={editor}
        state={state}
        onPickImage={() => imageInputRef.current?.click()}
      />
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

export const RequirementBodyEditor = memo(RequirementBodyEditorImpl);
