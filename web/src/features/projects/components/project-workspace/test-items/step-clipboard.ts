/**
 * 步骤剪贴板（跨用例复制步骤，切片 5c）：
 * 只存源步骤 id 与摘要，粘贴时由服务端复制设计内容（op + 期望结果），执行数据不带。
 * 存 localStorage：切用例、刷新、跨标签页都保留。
 */

const CLIPBOARD_KEY = "cm:case-step-clipboard";

export type StepClipboard = {
  stepId: string;
  /** 「第 N 步 · 摘要」这类展示文本，用于粘贴按钮提示。 */
  summary: string;
};

export function readStepClipboard(): StepClipboard | null {
  try {
    const raw = window.localStorage.getItem(CLIPBOARD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StepClipboard>;
    if (typeof parsed.stepId !== "string" || parsed.stepId === "") return null;
    return {
      stepId: parsed.stepId,
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
    };
  } catch {
    return null;
  }
}

export function writeStepClipboard(value: StepClipboard) {
  try {
    window.localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(value));
  } catch {
    // 存储不可用时静默降级：本页内粘贴按钮不出现，不阻断行内复制。
  }
}
