/** 统一的本地日期（YYYY-MM-DD）格式化；无效字符串原样返回，空值用调用方给的兜底文案。 */
export function formatDateOnly(value: string | Date | null | undefined, emptyFallback = "—") {
  if (!value) return emptyFallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : emptyFallback;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** 本地日期的中文展示（如 2026年9月11日）；无效与空值口径同 formatDateOnly。 */
export function formatDateMedium(value: string | Date | null | undefined, emptyFallback = "—") {
  if (!value) return emptyFallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : emptyFallback;
  return date.toLocaleDateString("zh-CN", { dateStyle: "medium" });
}
