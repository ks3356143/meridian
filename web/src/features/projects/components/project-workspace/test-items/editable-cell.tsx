import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

/**
 * 把鼠标点击位置换算成显示文本里的字符偏移（点击点落在文本节点上才有效）。
 * 用户点哪儿光标就落哪儿；键盘激活（无坐标）时返回 null，由调用方回退到末尾。
 */
function caretOffsetFromPoint(clientX: number, clientY: number): number | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const position = doc.caretPositionFromPoint?.(clientX, clientY) ?? null;
  if (position && position.offsetNode) {
    if (position.offsetNode.nodeType === Node.TEXT_NODE) return position.offset;
    return null;
  }
  const range = doc.caretRangeFromPoint?.(clientX, clientY) ?? null;
  if (range && range.startContainer.nodeType === Node.TEXT_NODE) return range.startOffset;
  return null;
}

/** 供外部（子项卡「自动编号」、用例综述「从描述回填」）程序化改值并走同一条保存链路。 */
export type EditableCellHandle = {
  /** 归一化行首编号（1、2、3、）；空内容或无需变化时返回 false。 */
  applyNumbering: () => boolean;
  /** 综述回填：整段写入外部文本并走同一条保存链路；空文本、内容相同或保存中返回 false。 */
  applyText: (next: string) => boolean;
};

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
  /** React 19 ref 直传：暴露 applyNumbering（自动编号按钮）。 */
  ref?: React.Ref<EditableCellHandle>;
  value: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  missing?: boolean;
  /** 展示态直接画输入框边框（老项目口径），让用户一眼看出这里可输入。 */
  bordered?: boolean;
  onSave: (next: string) => Promise<unknown>;
  /** 上报编辑态：开始/结束编辑由单元格负责，保存中/已保存由外层 patch 统一负责。 */
  onPhase?: (phase: "editing-start" | "editing-end") => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  // 编辑器是非受控的（defaultValue）：受控写法会在每次输入后由 React 覆写 value，
  // 浏览器会因此丢掉原生撤销栈（Ctrl+Z 失效）。draft 只用于高度计算，提交读 draftRef。
  const draftRef = useRef(value);
  const [phase, setPhase] = useState<SavePhase>("idle");
  // 多行单元格：进入编辑时沿用展示态高度，行高不跳。
  const [editorBaseHeight, setEditorBaseHeight] = useState<number | undefined>(undefined);
  const cellRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const editingRef = useRef(false);
  /** 进入编辑时的目标光标偏移（点击位置换算；null = 回退末尾）。 */
  const caretOffsetRef = useRef<number | null>(null);
  /** 进入编辑时要还原的框选区间（展示态里拖出来的选区）。 */
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const cancelledRef = useRef(false);
  const savedTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
    },
    [],
  );

  // 编辑态高度钉死为展示态实测高度：textarea 的固有高度比展示态多 ~0.2px（亚像素取整），
  // 不钉死的话点击那一刻整行会被撑高，下面的行跟着往下走一点点。
  // 只有内容真的多出（超过 2px，即多了一行）时才增长，避免打字时看不到内容。
  useLayoutEffect(() => {
    const cell = cellRef.current;
    if (!cell) return;
    if (!editing) {
      cell.style.height = "";
      return;
    }
    const element = editorRef.current as HTMLTextAreaElement | HTMLInputElement | null;
    if (!element) return;
    const base = editorBaseHeight ?? 0;
    if (!multiline || base <= 0) {
      cell.style.height = "";
      return;
    }
    const style = getComputedStyle(element);
    const borders =
      (Number.parseFloat(style.borderTopWidth) || 0) +
      (Number.parseFloat(style.borderBottomWidth) || 0);
    const intrinsic = element.scrollHeight + borders;
    const target = intrinsic > base + 2 ? intrinsic : base;
    element.style.height = `${target}px`;
    element.style.overflowY = intrinsic > base + 2 ? "auto" : "hidden";
    cell.style.height = `${target}px`;
  }, [draft, editing, editorBaseHeight, multiline]);

  // 手动聚焦并禁止浏览器滚动（聚焦会把滚动容器顶一下，整张表跟着跳）；
  // 光标落点：跟随点击位置（用户点哪儿就是哪儿）；键盘激活时回退到末尾——
  // input 默认在末尾、textarea 默认在开头，必须显式统一，否则行为随机。
  useLayoutEffect(() => {
    if (!editing) return;
    const element = editorRef.current;
    if (!element) return;
    element.focus({ preventScroll: true });
    const end = element.value.length;
    const picked = pendingSelectionRef.current;
    pendingSelectionRef.current = null;
    if (picked) {
      const start = Math.max(0, Math.min(picked.start, end));
      const stop = Math.max(start, Math.min(picked.end, end));
      element.setSelectionRange(start, stop);
      caretOffsetRef.current = null;
      return;
    }
    const offset = caretOffsetRef.current ?? end;
    const target = Math.max(0, Math.min(offset, end));
    caretOffsetRef.current = null;
    element.setSelectionRange(target, target);
  }, [editing]);

  // 编辑态开始/结束严格配对，并在卸载时兜底收尾，避免状态芯片卡在"待自动保存"。
  const onPhaseRef = useRef(onPhase);
  useEffect(() => {
    onPhaseRef.current = onPhase;
  });
  const beginEditing = () => {
    editingRef.current = true;
    onPhaseRef.current?.("editing-start");
  };
  const endEditing = () => {
    if (!editingRef.current) return;
    editingRef.current = false;
    onPhaseRef.current?.("editing-end");
  };
  useEffect(
    () => () => {
      if (!editingRef.current) return;
      editingRef.current = false;
      onPhaseRef.current?.("editing-end");
    },
    [],
  );

  /**
   * 把展示态里框选的文字换算成字符偏移（只在选中的是真实值时才返回）。
   * 展示态文字与编辑框 value 是同一串字符，所以偏移可以直接搬进编辑框做选区。
   */
  const readSelectionOffsets = () => {
    const host = displayRef.current;
    const selection = window.getSelection();
    if (!host || !selection || selection.isCollapsed || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!host.contains(range.startContainer) || !host.contains(range.endContainer)) return null;
    const node = host.querySelector(`.${styles.text}`)?.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;
    const offsetOf = (container: Node, offset: number) => {
      if (container === node) return offset;
      const probe = document.createRange();
      probe.selectNodeContents(node as Node);
      probe.setEnd(container, offset);
      return probe.toString().length;
    };
    const start = offsetOf(range.startContainer, range.startOffset);
    const end = offsetOf(range.endContainer, range.endOffset);
    return { start: Math.min(start, end), end: Math.max(start, end) };
  };

  const handleDisplayClick = (event: React.MouseEvent<HTMLElement>) => {
    // 先框选再松手：把选区原样带进编辑框（老项目手感——选中哪儿就是哪儿）。
    const picked = readSelectionOffsets();
    if (picked) {
      pendingSelectionRef.current = picked;
      window.getSelection()?.removeAllRanges();
    }
    startEditing(event);
  };

  const handleDisplayKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      startEditing();
    }
  };

  const startEditing = (event?: React.MouseEvent<HTMLElement>) => {
    // 上一次 Esc 取消的标记必须在进入新一次编辑时清掉，否则会吞掉下一次失焦保存。
    cancelledRef.current = false;
    // 编辑框常驻 DOM（保住 Ctrl+Z 撤销栈）：只有"外部真的改了值"才写回 DOM，
    // 否则提交后再次进入编辑，撤销历史会被一次无谓的写值清空。
    const editor = editorRef.current;
    if (editor && editor.value !== value) editor.value = value;
    const displayHeight = displayRef.current?.getBoundingClientRect().height;
    setEditorBaseHeight(displayHeight && displayHeight > 0 ? displayHeight : undefined);
    // 鼠标点击（detail > 0）带着坐标：换算成字符偏移，进入编辑后光标落在那儿。
    caretOffsetRef.current =
      event && event.detail > 0 ? caretOffsetFromPoint(event.clientX, event.clientY) : null;
    draftRef.current = value;
    setDraft(value);
    setEditing(true);
    beginEditing();
  };

  const save = async (next: string) => {
    setPhase("saving");
    try {
      await onSave(next);
      setPhase("saved");
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => setPhase("idle"), 1200);
    } catch {
      setPhase("idle");
    }
  };

  const commit = async () => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    const next = draftRef.current.trim();
    setEditing(false);
    endEditing();
    if (next === value) return;
    await save(next);
  };

  /** 外部程序化改值：同步草稿与编辑框 DOM，再走同一条保存链路（保存脉冲、Ctrl+Z 同源）。 */
  const applyValue = (next: string) => {
    draftRef.current = next;
    const editor = editorRef.current;
    if (editor) editor.value = next;
    setDraft(next);
    void save(next);
    return true;
  };

  // 自动编号：与失焦保存同一条链路；保存中跳过，避免和 blur 保存竞态。
  const applyNumbering = () => {
    const source = editing ? draftRef.current : value;
    const trimmed = source.trim();
    if (phase === "saving" || trimmed === "") return false;
    const next = normalizeNumbering(source).trim();
    return next === trimmed ? false : applyValue(next);
  };

  // 综述回填：整段写入外部文本；空文本、内容相同或保存中不写。
  const applyText = (next: string) => {
    const text = next.trim();
    if (phase === "saving" || text === "") return false;
    if (text === (editing ? draftRef.current : value).trim()) return false;
    return applyValue(text);
  };

  useImperativeHandle(ref, () => ({ applyNumbering, applyText }));

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelledRef.current = true;
      setEditing(false);
      endEditing();
      return;
    }
    if (!multiline && event.key === "Enter") {
      event.preventDefault();
      void commit();
      return;
    }
    if (multiline && event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void commit();
    }
  };

  return (
    <div
      ref={cellRef}
      className={cn(styles.cell, className)}
      data-editing={editing ? "true" : undefined}
      data-missing={missing ? "true" : undefined}
      data-bordered={bordered ? "true" : undefined}
      data-phase={phase}
    >
      <div className={styles.editorSlot}>
        {multiline ? (
          <Textarea
            ref={editorRef as React.Ref<HTMLTextAreaElement>}
            maxRows={30}
            defaultValue={value}
            aria-label={label}
            className={styles.editor}
            onChange={(event) => {
              draftRef.current = event.target.value;
              setDraft(event.target.value);
            }}
            onBlur={() => void commit()}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <Input
            ref={editorRef as React.Ref<HTMLInputElement>}
            defaultValue={value}
            aria-label={label}
            className={styles.editor}
            onChange={(event) => {
              draftRef.current = event.target.value;
              setDraft(event.target.value);
            }}
            onBlur={() => void commit()}
            onKeyDown={handleKeyDown}
          />
        )}
      </div>
      <div
        ref={displayRef}
        role="button"
        tabIndex={0}
        className={styles.display}
        data-multiline={multiline ? "true" : undefined}
        aria-label={`编辑${label}`}
        onClick={handleDisplayClick}
        onKeyDown={handleDisplayKeyDown}
      >
        {value ? (
          <span className={styles.text}>{value}</span>
        ) : (
          <span className={styles.placeholder}>{placeholder}</span>
        )}
      </div>
      {phase === "saving" ? <Loader2 className={styles.spinner} aria-label="保存中" /> : null}
    </div>
  );
}
