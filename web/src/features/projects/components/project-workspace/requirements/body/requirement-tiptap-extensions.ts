import { Extension } from "@tiptap/core";
import { Bold } from "@tiptap/extension-bold";
import { Document } from "@tiptap/extension-document";
import { Heading } from "@tiptap/extension-heading";
import { ListItem, ListKeymap, OrderedList } from "@tiptap/extension-list";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Table, TableCell, TableHeader, TableRow, TableView } from "@tiptap/extension-table";
import { Text } from "@tiptap/extension-text";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { normalizePastedHTML } from "./requirement-tiptap-paste";

const pastedFirstLineIndent = new WeakMap<Element, number>();

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    requirementParagraph: {
      setParagraphAlign: (align: "left" | "center" | "right" | "justify" | null) => ReturnType;
      setParagraphFirstLineIndent: (indent: 0 | 2) => ReturnType;
      toggleTableCaption: () => ReturnType;
    };
  }
}

export const RequirementParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: null,
        parseHTML: (element) => {
          const rawAlign = element.getAttribute("data-align") ?? "";
          const [baseAlign, ...flags] = rawAlign.split("+");
          if (flags.includes("indent2")) {
            pastedFirstLineIndent.set(element, 2);
          }
          const styleAlign = element instanceof HTMLElement ? element.style.textAlign : "";
          return normalizeAlign(baseAlign || styleAlign) || null;
        },
        renderHTML: (attributes) => {
          const align = normalizeAlign(String(attributes.align ?? ""));
          return align ? { "data-align": align, style: `text-align: ${align}` } : {};
        },
      },
      firstLineIndent: {
        default: 0,
        parseHTML: (element) => {
          const carriedIndent = pastedFirstLineIndent.get(element);
          if (carriedIndent === 2) return 2;
          const dataIndent = element.getAttribute("data-first-line-indent");
          if (dataIndent === "2") return 2;
          const textIndent = element instanceof HTMLElement ? element.style.textIndent : "";
          return /^2(?:\.0+)?em$/i.test(textIndent) ? 2 : 0;
        },
        renderHTML: (attributes) =>
          Number(attributes.firstLineIndent) === 2
            ? { "data-first-line-indent": "2", style: "text-indent: 2em" }
            : {},
      },
      variant: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-variant") || null,
        renderHTML: (attributes) =>
          attributes.variant === "tableCaption" ? { "data-variant": "tableCaption" } : {},
      },
    };
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setParagraphAlign:
        (align) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, {
            align,
            ...(align === "center" || align === "right" ? { firstLineIndent: 0 } : {}),
          }),
      setParagraphFirstLineIndent:
        (firstLineIndent) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { firstLineIndent }),
      toggleTableCaption:
        () =>
        ({ editor, commands }) => {
          const isCaption = editor.getAttributes(this.name).variant === "tableCaption";
          return commands.updateAttributes(this.name, {
            variant: isCaption ? null : "tableCaption",
            ...(isCaption ? {} : { align: "center", firstLineIndent: 0 }),
          });
        },
    };
  },
});

export const RequirementOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: "ordered-paren",
        parseHTML: (element) => element.getAttribute("data-list-style") || "ordered-paren",
        renderHTML: (attributes) => ({ "data-list-style": attributes.style || "ordered-paren" }),
      },
    };
  },
});

class RequirementTableView extends TableView {
  constructor(
    node: ProseMirrorNode,
    cellMinWidth: number,
    view: EditorView,
    HTMLAttributes?: Record<string, unknown>,
  ) {
    super(node, cellMinWidth, view, HTMLAttributes);
    syncTableAlign(this.table, node);
    syncTableWidth(this.table, node);
  }

  update(node: ProseMirrorNode) {
    if (!super.update(node)) return false;
    syncTableAlign(this.table, node);
    syncTableWidth(this.table, node);
    return true;
  }
}
export const RequirementTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "center",
        parseHTML: (element) =>
          normalizeTableAlign(
            element.getAttribute("data-align") ?? element.getAttribute("align"),
          ) || "center",
        renderHTML: (attributes) => ({
          "data-align": normalizeTableAlign(String(attributes.align ?? "")) || "center",
        }),
      },
    };
  },
  addNodeView() {
    return (props) =>
      new RequirementTableView(
        props.node,
        this.options.cellMinWidth,
        props.view,
        this.options.HTMLAttributes,
      );
  },
});

// ponytail: Tiptap 的单元格只有 align，没有 valign；补齐后编辑器保存不会丢掉模型里的垂直对齐。
export const RequirementTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      valign: {
        default: null,
        parseHTML: (element) =>
          normalizeValign(element.getAttribute("data-valign") ?? "") ||
          normalizeValign(element.style.verticalAlign) ||
          null,
        renderHTML: (attributes) => {
          const valign = normalizeValign(String(attributes.valign ?? ""));
          return valign ? { "data-valign": valign, style: `vertical-align: ${valign}` } : {};
        },
      },
    };
  },
});

export const RequirementTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      valign: {
        default: null,
        parseHTML: (element) =>
          normalizeValign(element.getAttribute("data-valign") ?? "") ||
          normalizeValign(element.style.verticalAlign) ||
          null,
        renderHTML: (attributes) => {
          const valign = normalizeValign(String(attributes.valign ?? ""));
          return valign ? { "data-valign": valign, style: `vertical-align: ${valign}` } : {};
        },
      },
    };
  },
});

export const RequirementPasteCleanup = Extension.create({
  name: "requirementPasteCleanup",
  transformPastedHTML(html) {
    return normalizePastedHTML(html);
  },
});

export { Bold, Document, Heading, ListItem, ListKeymap, TableRow, Text };

function syncTableAlign(table: HTMLTableElement, node: ProseMirrorNode) {
  const align = normalizeTableAlign(String(node.attrs.align ?? "")) || "center";
  if (table.getAttribute("data-align") !== align) table.setAttribute("data-align", align);
}

// Tiptap 会给 table 写死 min-width（列数 × cellMinWidth），盖掉样式表；
// 无列宽数据时交回 CSS（60% 最小宽度）决定，有列宽时按列宽渲染并放开最小宽度。
function syncTableWidth(table: HTMLTableElement, node: ProseMirrorNode) {
  const firstRow = node.firstChild;
  const hasColwidth =
    firstRow !== null &&
    Array.from({ length: firstRow.childCount }, (_, index) => firstRow.child(index)).some(
      (cell) => Array.isArray(cell.attrs.colwidth) && cell.attrs.colwidth.length > 0,
    );
  if (table.dataset.colwidth !== String(hasColwidth)) table.dataset.colwidth = String(hasColwidth);
  if (!hasColwidth && table.style.minWidth) table.style.minWidth = "";
}

function normalizeValign(raw: string) {
  switch (raw.trim().toLowerCase()) {
    case "top":
    case "center":
    case "bottom":
      return raw.trim().toLowerCase();
    default:
      return "";
  }
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

function normalizeTableAlign(raw: string | null) {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "left":
    case "center":
    case "right":
      return raw?.trim().toLowerCase() ?? "";
    default:
      return "";
  }
}
