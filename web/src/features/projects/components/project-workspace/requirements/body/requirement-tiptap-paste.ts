const TABLE_CAPTION_PATTERN = /^表\s*\d+(?:\s*[-－—]\s*\d+)?\s+.+$/;
const INDENT_PATTERN = /text-indent\s*:\s*(-?[\d.]+)\s*(pt|px|em|cm|mm|in)/i;
const ALIGN_PATTERN = /text-align\s*:\s*([^;]+)/i;
const WORD_LIST_LEVEL_PATTERN = /level\s*(\d+)/i;
const KEEP_ATTRIBUTES = new Set([
  "data-align",
  "data-first-line-indent",
  "data-list-level",
  "data-variant",
  "src",
  "alt",
  "width",
  "height",
  "colspan",
  "rowspan",
]);

export function normalizePastedHTML(html: string) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const root = parsed.body;
  removeComments(root);
  removeUnsupportedElements(root);
  unwrapUnsupportedInline(root);
  normalizeElements(parsed, root);
  convertWordLists(root);
  convertUnorderedLists(root);
  stripUnsupportedAttributes(root);
  return root.innerHTML;
}

function removeComments(root: Element) {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  const comments: Comment[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode as Comment);
  comments.forEach((comment) => comment.remove());
}

function removeUnsupportedElements(root: Element) {
  root
    .querySelectorAll("script, style, meta, link, iframe, object, embed, noscript, template")
    .forEach((element) => element.remove());
  root.querySelectorAll("*").forEach((element) => {
    if (element.tagName.includes(":")) element.remove();
  });
}

function unwrapUnsupportedInline(root: Element) {
  root.querySelectorAll("i, em, u, s, strike, del").forEach((element) => unwrap(element));
}

function normalizeElements(document: Document, root: Element) {
  root.querySelectorAll("p, div, li").forEach((element) => normalizeBlockElement(element));
  root.querySelectorAll("span").forEach((element) => {
    const style = element.getAttribute("style") ?? "";
    if (!/font-weight\s*:\s*(bold|[6-9]00)/i.test(style)) return;
    const strong = document.createElement("strong");
    while (element.firstChild) strong.appendChild(element.firstChild);
    element.replaceWith(strong);
  });

  root.querySelectorAll("table").forEach((table) => {
    const style = table.getAttribute("style") ?? "";
    const align = normalizeAlign(
      table.getAttribute("align") ??
        (style.includes("margin-left:auto") && style.includes("margin-right:auto") ? "center" : ""),
    );
    table.setAttribute("data-align", align || "center");
  });

  root.querySelectorAll("img").forEach((image) => {
    image.removeAttribute("style");
    image.removeAttribute("class");
  });
}

function normalizeBlockElement(element: Element) {
  const style = element.getAttribute("style") ?? "";
  const align = normalizeAlign(readMatch(style, ALIGN_PATTERN));
  if (align) element.setAttribute("data-align", align);

  const indent = Number(readMatch(style, INDENT_PATTERN));
  const indentUnit = style.match(INDENT_PATTERN)?.[2]?.toLowerCase();
  const hasFirstLineIndent =
    indent > 0 &&
    ((indentUnit === "em" && indent >= 1.5) ||
      (indentUnit === "pt" && indent >= 18) ||
      (indentUnit === "px" && indent >= 24) ||
      (indentUnit === "cm" && indent >= 0.6) ||
      (indentUnit === "mm" && indent >= 6));
  if (hasFirstLineIndent && align !== "center" && align !== "right") {
    element.setAttribute("data-first-line-indent", "2");
    // ProseMirror 的粘贴 slice 路径会丢掉独立的自定义属性，借道能存活下来的 data-align 传递首行缩进标记。
    element.setAttribute("data-align", align ? `${align}+indent2` : "left+indent2");
  }

  const text = element.textContent?.trim() ?? "";
  if (TABLE_CAPTION_PATTERN.test(text)) {
    element.setAttribute("data-variant", "tableCaption");
    element.setAttribute("data-align", "center");
    element.removeAttribute("data-first-line-indent");
  }

  if (hasWordListStyle(element, style)) {
    element.setAttribute("data-list-level", String(readWordListLevel(style)));
    element.querySelectorAll("span").forEach((span) => {
      if ((span.getAttribute("style") ?? "").toLowerCase().includes("mso-list:ignore")) {
        span.remove();
      }
    });
  }
}

function convertWordLists(root: Element) {
  Array.from(root.children).forEach((child) => convertWordLists(child));
  convertDirectWordListRun(root);
}

function convertDirectWordListRun(container: Element) {
  let run: HTMLElement[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const list = buildOrderedListFromWordRun(run);
    run[0].replaceWith(list);
    run.slice(1).forEach((element) => element.remove());
    run = [];
  };

  Array.from(container.children).forEach((child) => {
    if (
      child instanceof HTMLElement &&
      (child.tagName === "P" || child.tagName === "DIV") &&
      child.hasAttribute("data-list-level")
    ) {
      run.push(child);
      return;
    }
    flush();
  });
  flush();
}

function buildOrderedListFromWordRun(items: HTMLElement[]) {
  const document = items[0].ownerDocument;
  const root = document.createElement("ol");
  const stack: Array<{ level: number; list: HTMLOListElement }> = [{ level: 1, list: root }];

  items.forEach((item) => {
    const level = Math.max(1, Number(item.dataset.listLevel ?? 1) || 1);
    while (level > stack.length) {
      const parentItem = stack[stack.length - 1].list.lastElementChild;
      if (!(parentItem instanceof HTMLLIElement)) break;
      const nested = document.createElement("ol");
      parentItem.appendChild(nested);
      stack.push({ level: stack.length + 1, list: nested });
    }
    while (level < stack.length) stack.pop();

    const listItem = document.createElement("li");
    listItem.innerHTML = item.innerHTML;
    stack[stack.length - 1].list.appendChild(listItem);
  });
  return root;
}

function convertUnorderedLists(root: Element) {
  root.querySelectorAll("ul").forEach((list) => {
    const ordered = list.ownerDocument.createElement("ol");
    while (list.firstChild) ordered.appendChild(list.firstChild);
    list.replaceWith(ordered);
  });
}

function stripUnsupportedAttributes(root: Element) {
  root.querySelectorAll("*").forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (!KEEP_ATTRIBUTES.has(name)) element.removeAttribute(attribute.name);
    });
  });
}

function hasWordListStyle(element: Element, style: string) {
  return style.toLowerCase().includes("mso-list") || element.classList.contains("MsoListParagraph");
}

function readWordListLevel(style: string) {
  const match = style.match(WORD_LIST_LEVEL_PATTERN);
  return match ? Math.max(1, Number(match[1])) : 1;
}

function readMatch(style: string, pattern: RegExp) {
  return style.match(pattern)?.[1]?.trim() ?? "";
}

function normalizeAlign(raw: string) {
  switch (raw.trim().toLowerCase()) {
    case "start":
      return "left";
    case "end":
      return "right";
    case "both":
    case "distribute":
      return "justify";
    case "left":
    case "center":
    case "right":
    case "justify":
      return raw.trim().toLowerCase();
    default:
      return "";
  }
}

function unwrap(element: Element) {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  element.remove();
}
