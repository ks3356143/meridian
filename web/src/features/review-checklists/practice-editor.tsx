import { useEffect } from "react";
import { Bold as BoldIcon, Highlighter, ListOrdered, Trash2 } from "lucide-react";
import { UndoRedo } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  Bold,
  Document,
  ListItem,
  ListKeymap,
  RequirementHighlight,
  RequirementOrderedList,
  RequirementParagraph,
  Text,
} from "@/features/projects/components/project-workspace/requirements/body/requirement-tiptap-extensions";
import styles from "./practice-editor.module.css";

/** 审查单做法富文本编辑器：粗体、有序列表、高亮、清除格式。 */
export function PracticeEditor({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (html: string) => void;
  ariaLabel: string;
}) {
  const editor = useEditor({
    extensions: [
      Document,
      Text,
      RequirementParagraph,
      Bold,
      RequirementHighlight,
      UndoRedo,
      RequirementOrderedList,
      ListItem,
      ListKeymap.configure({
        listTypes: [{ itemName: "listItem", wrapperNames: ["orderedList"] }],
      }),
    ],
    content: value || "<p></p>",
    editorProps: {
      attributes: { class: styles.surface, "aria-label": ariaLabel, spellcheck: "false" },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return null;
  const activeList = editor.isActive("orderedList");
  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.tool}
          data-active={editor.isActive("bold") ? "true" : undefined}
          aria-label="加粗"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldIcon aria-hidden />
        </button>
        <button
          type="button"
          className={styles.tool}
          data-active={activeList ? "true" : undefined}
          aria-label="有序列表"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered aria-hidden />
        </button>
        <button
          type="button"
          className={styles.tool}
          data-active={editor.isActive("highlight") ? "true" : undefined}
          aria-label="高亮"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <Highlighter aria-hidden />
        </button>
        <button
          type="button"
          className={styles.tool}
          aria-label="清除格式"
          onClick={() => editor.chain().focus().clearContent().run()}
        >
          <Trash2 aria-hidden />
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
