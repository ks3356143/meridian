import { useState } from "react";

/**
 * 弹窗退出动画要求父级在 open 翻 false 后仍继续渲染最后一份非空数据，
 * 否则条件卸载会在动画开始前把整棵子树拔掉。本 hook 只负责“记住最后一次出现的非空值”，
 * 挂载保持一律交给 Dialog/AlertDialog 的 open 属性控制。
 */
export function useLastPresent<T>(value: T | null | undefined): T | null {
  const [last, setLast] = useState<T | null>(value ?? null);
  if (value != null && value !== last) setLast(value);
  return last;
}
