/** 统一的本地日期（YYYY-MM-DD）格式化；无效字符串原样返回，空值用调用方给的兜底文案。 */
export function formatDateOnly(value: string | Date | null | undefined, emptyFallback = "—") {
  if (!value) return emptyFallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : emptyFallback;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
