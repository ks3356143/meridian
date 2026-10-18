import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

type UndoEntry = { label: string; restore: () => Promise<unknown> };

/**
 * 保存级撤销栈（Ctrl+Z，上限 20）：只记「已经保存成功」的字段改动，
 * 结构化操作（新增 / 删除 / 移动步骤）不进栈；编辑框聚焦时让位给浏览器原生撤销
 * （输入过程中按 Ctrl+Z 应该逐字回退，而不是把上一次保存整条回滚）。
 */
export function useCellUndo() {
  const stackRef = useRef<UndoEntry[]>([]);
  const restoringRef = useRef(false);

  const recordChange = useCallback((label: string, restore: () => Promise<unknown>) => {
    stackRef.current.push({ label, restore });
    if (stackRef.current.length > 20) stackRef.current.shift();
  }, []);

  const undo = useCallback(async () => {
    if (restoringRef.current) return;
    const entry = stackRef.current.pop();
    if (!entry) return;
    restoringRef.current = true;
    try {
      await entry.restore();
      toast.success(`已撤销：${entry.label}`);
    } catch {
      // 失败原因由 api client 统一 toast；条目放回栈里让用户能重试。
      stackRef.current.push(entry);
    } finally {
      restoringRef.current = false;
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      if (event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      // 编辑中交给浏览器原生撤销（保住逐字回退）。
      if (target && (target.closest("input, textarea") || target.isContentEditable)) return;
      if (stackRef.current.length === 0) return;
      event.preventDefault();
      void undo();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo]);

  return { recordChange, undo };
}
