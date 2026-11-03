/** TipTap 空文档是 `<p></p>`，不能只按 trim 判断是否配置了做法。 */
export function hasRichContent(html?: string) {
  if (!html) return false;
  if (/<(img|table|video|iframe)\b/i.test(html)) return true;
  return (
    html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .trim().length > 0
  );
}
