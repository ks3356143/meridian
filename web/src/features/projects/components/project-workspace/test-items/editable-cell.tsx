import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "cn";
import styles from "./editable-cell.module.css";

type SavePhase = "idle" | "saving" | "saved";

const LEADING_INDEX = /^[（(]?\d{1,3}[）)、.．]\s*/;

/** 按非空行统一行首编号为「1、2、3、」；已有编号（1、1)（1）1. 等变体）先剥掉再重排（幂等）。 */
function normalizeNumbering(value: string): string {
  let index = 0;
  return value
    .split(/\r?\n/)
    .map((line) => {
      if (line.trim() === "") return line;
      index += 1;
      return `${index}、${line.replace(LEADING_INDEX, "")}`;
    })
    .join("\n");
}

/** 供外部（子项卡「自动编号」、用例综述「从描述回填」）程序化改值并走同一条保存链路。 */
export type EditableCellHandle = {
  /** 归一化行首编号（1、2、3、）；空内容或无需变化时返回 false。 */
  applyNumbering: () => boolean;
  /** 综述回填：整段写入外部文本并走同一条保存链路；空文本、内容相同或保存中返回 false。 */
  applyText: (next: string) => boolean;
};

/**
 * 即时编辑单元格：始终渲染同一个 contenteditable 元素。
 * 不再做「展示 div ↔ 编辑器」切换，文字基线不会因 focus 改变。
 */
export function EditableCell({
  value,
  label,
  placeholder = "点击填写",
  multiline = false,
  missing = false,
  bordered = false,
  onSave,
  onPhase,
  className,
  ref,
}: {
  /** React 19 ref 直传：暴露 applyNumbering / applyText。 */
  ref?: React.Ref<EditableCellHandle>;
  value: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  missing?: boolean;
  /** 兼容旧调用；边框现在始终可见。 */
  bordered?: boolean;
  onSave: (next: string) => Promise<unknown>;
  /** 上报编辑态：聚焦 / 失焦由单元格负责，保存中 / 已保存由外层 patch 统一负责。 */
  onPhase?: (phase: "editing-start" | "editing-end") => void;
  className?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef(value);
  const focusedRef = useRef(false);
  const cancelledRef = useRef(false);
  const [phase, setPhase] = useState<SavePhase>("idle");
  const savedTimerRef = useRef<number | null>(null);
  const onPhaseRef = useRef(onPhase);

  useEffect(() => {
    onPhaseRef.current = onPhase;
  });

  useEffect(
    () => () => {
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
    },
    [],
  );

  useEffect(
    () => () => {
      if (!focusedRef.current) return;
      focusedRef.current = false;
      onPhaseRef.current?.("editing-end");
    },
    [],
  );

  // contenteditable 的 Enter 在 Chromium 里生成 <div>/<br>，textContent 会丢掉换行；
  // innerText 按渲染结果读取，才能把多行步骤原样保存。
  const readText = (editor: HTMLDivElement) => editor.innerText.replace(/\r\n/g, "\n");

  const syncDom = (next: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    if (readText(editor) !== next) editor.textContent = next;
    editor.dataset.empty = next.trim() === "" ? "true" : "false";
    draftRef.current = next;
  };

  // 外部值变化（保存回写、撤销、回填）只在不聚焦时写回，避免打断当前输入和原生撤销栈。
  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    syncDom(value);
  }, [value]);

  const beginEditing = () => {
    if (focusedRef.current) return;
    focusedRef.current = true;
    onPhaseRef.current?.("editing-start");
  };

  const endEditing = () => {
    if (!focusedRef.current) return;
    focusedRef.current = false;
    onPhaseRef.current?.("editing-end");
  };

  const save = async (next: string) => {
    setPhase("saving");
    try {
      await onSave(next);
      setPhase("saved");
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => setPhase("idle"), 1200);
      return true;
    } catch {
      setPhase("idle");
      return false;
    }
  };

  const restore = () => {
    syncDom(value);
  };

  const commit = async () => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    const next = (editorRef.current ? readText(editorRef.current) : draftRef.current).trim();
    endEditing();
    if (next === value) return;
    syncDom(next);
    if (!(await save(next))) restore();
  };

  const applyValue = (next: string) => {
    syncDom(next);
    void save(next).then((ok) => {
      if (!ok) restore();
    });
    return true;
  };

  const currentValue = () => (editorRef.current ? readText(editorRef.current) : value);

  const applyNumbering = () => {
    const source = currentValue();
    const trimmed = source.trim();
    if (phase === "saving" || trimmed === "") return false;
    const next = normalizeNumbering(source).trim();
    if (next === trimmed) return false;
    return applyValue(next);
  };

  const applyText = (next: string) => {
    const text = next.trim();
    if (phase === "saving" || text === "") return false;
    if (text === currentValue().trim()) return false;
    return applyValue(text);
  };

  useImperativeHandle(ref, () => ({ applyNumbering, applyText }));

  const handleInput = (event: React.FormEvent<HTMLDivElement>) => {
    const next = readText(event.currentTarget);
    event.currentTarget.dataset.empty = next.trim() === "" ? "true" : "false";
    draftRef.current = next;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelledRef.current = true;
      restore();
      event.currentTarget.blur();
      return;
    }
    if (!multiline && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }
    if (multiline && event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  return (
    <div
      className={cn(styles.cell, className)}
      data-missing={missing ? "true" : undefined}
      data-bordered={bordered ? "true" : undefined}
      data-phase={phase}
    >
      <div
        ref={editorRef}
        role="textbox"
        tabIndex={0}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        aria-label={label}
        aria-multiline={multiline}
        aria-invalid={missing || undefined}
        data-placeholder={placeholder}
        data-empty={value.trim() === "" ? "true" : "false"}
        className={styles.editor}
        onFocus={beginEditing}
        onBlur={() => void commit()}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
      />
      {phase === "saving" ? <Loader2 className={styles.spinner} aria-label="保存中" /> : null}
    </div>
  );
}
