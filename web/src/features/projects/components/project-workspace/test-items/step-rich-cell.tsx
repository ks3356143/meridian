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
  kind: "op" | "act";
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
  kind,
  projectCode,
  onSave,
}: StepRichCellProps) {
  const [editing, setEditing] = useState(false);
  const [phase, setPhase] = useState<"idle" | "saving" | "saved">("idle");
  const savedTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
    },
    [],
  );

  const commit = (doc: RequirementBlockNode) => {
    setEditing(false);
    // 「打开就走」不算改动：内容与展示态一致时不发请求。
    if (block.doc && JSON.stringify(doc) === JSON.stringify(block.doc)) return;
    setPhase("saving");
    void onSave(doc)
      .then(() => {
        setPhase("saved");
        if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
        savedTimerRef.current = window.setTimeout(() => setPhase("idle"), 1200);
      })
      .catch(() => setPhase("idle"));
  };

  return (
    <div className={styles.cell} data-phase={phase}>
      {editing ? (
        <StepRichEditor
          doc={block.doc}
          kind={kind}
          projectCode={projectCode}
          onDone={commit}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div
          role="button"
          tabIndex={0}
          className={styles.display}
          aria-label={`编辑${label}`}
          onClick={() => setEditing(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
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
