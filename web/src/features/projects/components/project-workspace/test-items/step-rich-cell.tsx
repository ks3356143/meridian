import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { RequirementBlockNode } from "@/features/requirements/types";
import type { StepBlockView } from "@/features/test-items/types";
import { RequirementBlocks } from "../requirements/body/requirement-body";
import { StepRichEditor } from "./step-rich-editor";
import styles from "./step-rich-cell.module.css";

type StepRichCellProps = {
  /** 步骤富文本块（op / act）。 */
  block: StepBlockView;
  label: string;
  placeholder: string;
  projectCode: string;
  onSave: (doc: RequirementBlockNode) => Promise<unknown>;
};

/**
 * 用例步骤富文本单元格：展示态渲染结构化内容（表格/图片），点击进入内联编辑器；
 * 失焦或 Esc 退出，失焦提交（内容未变不发请求），保存走保存相位（saving spinner → saved 脉冲）。
 */
export function StepRichCell({
  block,
  label,
  placeholder,
  projectCode,
  onSave,
}: StepRichCellProps) {
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [phase, setPhase] = useState<"idle" | "saving" | "saved">("idle");
  const savedTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  // 记录打开编辑前的点击坐标；编辑器挂载后用它把光标放到点击处。
  const [clickPoint, setClickPoint] = useState<{ x: number; y: number } | null>(null);
  const [selectionRange, setSelectionRange] = useState<{
    anchor: { x: number; y: number };
    head: { x: number; y: number };
  } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(
    () => () => {
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    },
    [],
  );

  const closeEditor = () => {
    setClosing(true);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setEditing(false);
      setClosing(false);
    }, 150);
  };

  const commit = async (doc: RequirementBlockNode, changed: boolean): Promise<boolean> => {
    // 「打开就走」不算改动：Tiptap 规范化后的初始文档也不应触发保存。
    if (!changed || (block.doc && JSON.stringify(doc) === JSON.stringify(block.doc))) {
      closeEditor();
      return true;
    }
    setPhase("saving");
    try {
      await onSave(doc);
      setPhase("saved");
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => setPhase("idle"), 1200);
      closeEditor();
      return true;
    } catch {
      // 保存失败时保持编辑器挂载，内容留在原地供用户重试；Esc 仍可主动放弃。
      setPhase("idle");
      return false;
    }
  };

  return (
    <div className={styles.cell} data-phase={phase}>
      {editing ? (
        <StepRichEditor
          doc={block.doc}
          projectCode={projectCode}
          initialPoint={clickPoint}
          initialRange={selectionRange}
          closing={closing}
          onDone={commit}
          onCancel={closeEditor}
        />
      ) : (
        <div
          role="button"
          tabIndex={0}
          className={styles.display}
          aria-label={`编辑${label}`}
          onMouseDown={(event) => {
            if (event.button === 0) {
              dragStartRef.current = { x: event.clientX, y: event.clientY };
            }
          }}
          onClick={(event) => {
            const start = dragStartRef.current;
            dragStartRef.current = null;
            const dragged =
              start && Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 3;
            setSelectionRange(
              dragged
                ? {
                    anchor: start,
                    head: { x: event.clientX, y: event.clientY },
                  }
                : null,
            );
            setClickPoint({ x: event.clientX, y: event.clientY });
            setEditing(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setClickPoint(null);
              setSelectionRange(null);
              setEditing(true);
            }
          }}
        >
          {block.hasContent && block.doc ? (
            <RequirementBlocks
              doc={block.doc}
              projectCode={projectCode}
              className={styles.content}
            />
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )}
        </div>
      )}
      {phase === "saving" ? <Loader2 className={styles.spinner} aria-label="保存中" /> : null}
    </div>
  );
}
