// Word 剪贴板里的表格结构规整：表头提升、单元格编号补字面数字、列宽回写、单元格内列表压平。
// 列表标记判定同时导出，题注与段落归一化复用同一套规则。

export function normalizePastedTables(root: Element) {
  promoteHeaderRow(root);
  materializeCellNumbers(root);
  flattenCellLists(root);
  applyColumnWidths(root);
}

// 单元格里的 Word 自动编号不能变成列表（后端只放行 paragraph）：按列序补字面 “1.” “2.”。
// 不能直接沿用 Word 的字面标记——每个单元格是独立列表，Word 常给每格都是 “1.”。
function materializeCellNumbers(root: Element) {
  root.querySelectorAll("table").forEach((table) => {
    const counters = new Map<number, number>();
    Array.from(table.querySelectorAll("tr")).forEach((row) => {
      let column = 0;
      Array.from(row.children).forEach((cell) => {
        const span = Math.max(1, Number.parseInt(cell.getAttribute("colspan") ?? "", 10) || 1);
        cell.querySelectorAll("p, div").forEach((paragraph) => {
          const style = paragraph.getAttribute("style") ?? "";
          if (!hasWordListStyle(paragraph, style)) return;
          const marker = listMarkerSpan(paragraph);
          if (marker && !isNumericListMarker(marker)) return;
          marker?.remove();
          const next = (counters.get(column) ?? 0) + 1;
          counters.set(column, next);
          paragraph.insertBefore(
            paragraph.ownerDocument.createTextNode(`${next}. `),
            paragraph.firstChild,
          );
        });
        column += span;
      });
    });
  });
}

// Word 自动编号段落与编号标记识别：段落归一化与单元格编号共用同一套判定。
export function hasWordListStyle(element: Element, style: string) {
  return style.toLowerCase().includes("mso-list") || element.classList.contains("MsoListParagraph");
}

// Word 自动编号标记（mso-list:ignore）识别，段落、题注与单元格共用同一套判定。
function isListMarkerSpan(span: Element) {
  return (span.getAttribute("style") ?? "").toLowerCase().includes("mso-list:ignore");
}

// 纯数字标记才算“序号”，避免把项目符号也当作编号补字面数字。
function isNumericListMarker(span: Element) {
  return isListMarkerSpan(span) && /^\d+\s*[.．、,，)）]?$/.test((span.textContent ?? "").trim());
}

function listMarkerSpan(element: Element) {
  return Array.from(element.querySelectorAll("span")).find(isListMarkerSpan) ?? null;
}

// 去掉段落里的 Word 编号标记；numericOnly 为真时只去纯数字标记（题注编号）。
export function removeListMarkerSpans(element: Element, numericOnly = false) {
  element.querySelectorAll("span").forEach((span) => {
    if (!isListMarkerSpan(span)) return;
    if (numericOnly && !isNumericListMarker(span)) return;
    span.remove();
  });
}

// Word 剪贴板里的表头是 <td>（没有 <th>），表格首行整行加粗或有底纹时提升为表头，
// 免得用户粘贴后还要手动「转为表头」。
function promoteHeaderRow(root: Element) {
  root.querySelectorAll("table").forEach((table) => {
    if (table.querySelector("th")) return;
    const firstRow = table.querySelector("tr");
    if (!firstRow) return;
    const cells = Array.from(firstRow.children).filter((cell) => cell.tagName === "TD");
    if (cells.length === 0 || !cells.every(looksLikeHeaderCell)) return;

    cells.forEach((cell) => {
      const header = cell.ownerDocument.createElement("th");
      Array.from(cell.attributes).forEach((attribute) =>
        header.setAttribute(attribute.name, attribute.value),
      );
      while (cell.firstChild) header.appendChild(cell.firstChild);
      cell.replaceWith(header);
    });
  });
}

// 首行单元格是否像表头：有底纹，或整行加粗。
function looksLikeHeaderCell(cell: Element) {
  if ((cell.textContent ?? "").trim() === "") return false;
  const style = `${cell.getAttribute("style") ?? ""} ${cell.getAttribute("class") ?? ""}`;
  if (/\bbackground(?:-color)?\s*:\s*(?!transparent|none|inherit)/i.test(style)) return true;
  if (cell.hasAttribute("bgcolor")) return true;
  const blocks = Array.from(cell.querySelectorAll("p, div")).filter(
    (element) => (element.textContent ?? "").trim() !== "",
  );
  const targets = blocks.length > 0 ? blocks : [cell];
  return targets.every(
    (element) =>
      element.querySelector("b, strong") !== null ||
      /font-weight\s*:\s*(bold|[6-9]00)/i.test(
        `${element.getAttribute("style") ?? ""} ${element.getAttribute("class") ?? ""}`,
      ),
  );
}

// 只读预览用 <colgroup><col style="width:230px"> 表达列宽，Tiptap 只认单元格 colwidth，
// 这里按 colspan 展开成逻辑列回写到每个单元格；带 rowspan 的表无法按行推算逻辑列，整表跳过。
function applyColumnWidths(root: Element) {
  root.querySelectorAll("table").forEach((table) => {
    if (table.querySelector('[rowspan]:not([rowspan="1"])')) return;
    const widths = Array.from(table.querySelectorAll("colgroup > col")).map(readColumnWidth);
    if (widths.length === 0 || widths.some((width) => width <= 0)) return;

    table.querySelectorAll("tr").forEach((row) => {
      let column = 0;
      Array.from(row.children).forEach((cell) => {
        const span = Math.max(1, Number.parseInt(cell.getAttribute("colspan") ?? "", 10) || 1);
        const slice = widths.slice(column, column + span);
        column += span;
        if (slice.length === span && !cell.hasAttribute("colwidth")) {
          cell.setAttribute("colwidth", slice.join(","));
        }
      });
    });
  });
}

// 读取 col 的像素列宽（width 属性或 style 里的 px/pt）。
function readColumnWidth(column: Element) {
  const style = column.getAttribute("style") ?? "";
  const match = style.match(/(?:^|;)\s*width\s*:\s*([\d.]+)\s*(px|pt)?\s*(?:;|$)/i);
  if (match) return toPixels(Number(match[1]), match[2]);
  const attribute = Number.parseFloat(column.getAttribute("width") ?? "");
  return Number.isFinite(attribute) && attribute > 0 ? Math.round(attribute) : 0;
}

// pt → px（96dpi）。
function toPixels(value: number, unit?: string) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return unit?.toLowerCase() === "pt" ? Math.round((value * 96) / 72) : Math.round(value);
}

// 单元格内不允许列表（后端白名单），把列表压平成段落，避免解析器把内容挤出单元格。
function flattenCellLists(root: Element) {
  root.querySelectorAll("td ol, td ul, th ol, th ul").forEach((list) => {
    const document = list.ownerDocument;
    const paragraphs = Array.from(list.querySelectorAll("li")).flatMap((item) => {
      const blocks = Array.from(item.children).filter(
        (node) => node.tagName === "P" || node.tagName === "DIV",
      );
      const inline = Array.from(item.childNodes).filter(
        (node) =>
          !(
            node instanceof Element &&
            (node.tagName === "OL" ||
              node.tagName === "UL" ||
              node.tagName === "P" ||
              node.tagName === "DIV")
          ),
      );
      if (inline.every((node) => (node.textContent ?? "").trim() === "")) return blocks;
      const paragraph = document.createElement("p");
      inline.forEach((node) => paragraph.appendChild(node));
      return [paragraph, ...blocks];
    });
    if (paragraphs.length === 0) return;
    list.replaceWith(...paragraphs);
  });
}
