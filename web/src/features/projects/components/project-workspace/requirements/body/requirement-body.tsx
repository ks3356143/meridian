import { ImageOff, Loader2, ScanText } from "lucide-react";
import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { requestBlob } from "@/api/client";
import type { RequirementBlockNode } from "@/features/requirements/types";
import styles from "./requirement-body.module.css";

type RequirementBodyProps = {
  doc: RequirementBlockNode;
  projectCode: string;
};

function RequirementBodyImpl({ doc, projectCode }: RequirementBodyProps) {
  const blocks = doc.content ?? [];

  if (blocks.length === 0) {
    return <EmptyBody />;
  }

  return (
    <section className={styles.frame} aria-label="需求正文">
      <div className={styles.viewport} role="document" aria-label="结构化需求正文">
        {blocks.map((block, index) => (
          <div key={`${block.type}-${index}`} className={styles.block}>
            <RequirementBlock block={block} projectCode={projectCode} />
          </div>
        ))}
      </div>
    </section>
  );
}

const RequirementBlock = memo(function RequirementBlock({
  block,
  projectCode,
}: {
  block: RequirementBlockNode;
  projectCode: string;
}) {
  switch (block.type) {
    case "heading":
      return <HeadingBlock block={block} />;
    case "paragraph":
      return <ParagraphBlock block={block} />;
    case "bulletList":
    case "orderedList":
      return <ListBlock block={block} />;
    case "table":
      return <TableBlock block={block} />;
    case "assetImage":
      return <AssetImageBlock block={block} projectCode={projectCode} />;
    case "pagebreak":
      return null;
    default:
      return <ParagraphBlock block={block} />;
  }
});

function HeadingBlock({ block }: { block: RequirementBlockNode }) {
  const level = clampHeadingLevel(readNumberAttr(block.attrs, "level"));
  const content = <InlineContent content={block.content} />;
  if (level === 4) {
    return (
      <h6 className={styles.heading} data-level={level}>
        {content}
      </h6>
    );
  }
  if (level === 3) {
    return (
      <h5 className={styles.heading} data-level={level}>
        {content}
      </h5>
    );
  }
  return (
    <h4 className={styles.heading} data-level={level}>
      {content}
    </h4>
  );
}

function ParagraphBlock({ block }: { block: RequirementBlockNode }) {
  const align = readStringAttr(block.attrs, "align");
  const indent = readNumberAttr(block.attrs, "firstLineIndent");
  const variant = readStringAttr(block.attrs, "variant");
  return (
    <p
      className={styles.paragraph}
      data-align={align || undefined}
      data-first-line-indent={indent === 2 ? "2" : undefined}
      data-variant={variant || undefined}
    >
      <InlineContent content={block.content} />
    </p>
  );
}

function ListBlock({ block }: { block: RequirementBlockNode }) {
  const style = readStringAttr(block.attrs, "style") || "ordered-paren";
  return (
    <ol className={styles.list} data-list-style={style}>
      {(block.content ?? []).map((item, index) => (
        <ListItemBlock key={index} item={item} />
      ))}
    </ol>
  );
}

function ListItemBlock({ item }: { item: RequirementBlockNode }) {
  return (
    <li className={styles.listItem}>
      {(item.content ?? []).map((child, childIndex) =>
        child.type === "paragraph" ? (
          <p key={childIndex} className={styles.listParagraph}>
            <InlineContent content={child.content} />
          </p>
        ) : child.type === "orderedList" || child.type === "bulletList" ? (
          <ListBlock key={childIndex} block={child} />
        ) : null,
      )}
    </li>
  );
}

function TableBlock({ block }: { block: RequirementBlockNode }) {
  const rows = block.content ?? [];
  const headerRows = rows.filter(
    (row) =>
      (row.content ?? []).length > 0 &&
      (row.content ?? []).every((cell) => cell.type === "tableHeader"),
  );
  const bodyRows = rows.filter((row) => !headerRows.includes(row));
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table} data-align={readStringAttr(block.attrs, "align") || "center"}>
        {headerRows.length > 0 ? (
          <thead>
            {headerRows.map((row, rowIndex) => (
              <TableRow key={rowIndex} row={row} header />
            ))}
          </thead>
        ) : null}
        <tbody>
          {bodyRows.map((row, rowIndex) => (
            <TableRow key={rowIndex} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableRow({ row, header = false }: { row: RequirementBlockNode; header?: boolean }) {
  return (
    <tr>
      {(row.content ?? []).map((cell, cellIndex) => {
        const CellTag = cell.type === "tableHeader" || header ? "th" : "td";
        const align = readStringAttr(cell.attrs, "align") || (CellTag === "th" ? "center" : "left");
        const valign = readStringAttr(cell.attrs, "valign") || "center";
        return (
          <CellTag
            key={cellIndex}
            className={styles.tableCell}
            data-align={align}
            data-valign={valign}
            colSpan={Math.max(1, readNumberAttr(cell.attrs, "colspan"))}
            rowSpan={Math.max(1, readNumberAttr(cell.attrs, "rowspan"))}
            scope={CellTag === "th" ? "col" : undefined}
          >
            {(cell.content ?? []).map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex} className={styles.tableParagraph}>
                <InlineContent content={paragraph.content} />
              </p>
            ))}
          </CellTag>
        );
      })}
    </tr>
  );
}

function AssetImageBlock({
  block,
  projectCode,
}: {
  block: RequirementBlockNode;
  projectCode: string;
}) {
  const assetId = readStringAttr(block.attrs, "assetId");
  const alt = readStringAttr(block.attrs, "alt") || "需求正文图片";
  const caption = readCaption(block.attrs);
  const width = sanitizeCssLength(readStringAttr(block.attrs, "width"));
  const aspectRatio = readAspectRatio(block.attrs);
  const frameStyle = useMemo(() => {
    const style: CSSProperties = {};
    if (width) style.maxWidth = `min(100%, ${width})`;
    if (aspectRatio) style.aspectRatio = aspectRatio;
    return style;
  }, [aspectRatio, width]);

  const assetQuery = useQuery({
    queryKey: ["requirement-asset", projectCode, assetId, 320],
    queryFn: ({ signal }) =>
      requestBlob(
        `/api/v1/projects/${encodeURIComponent(projectCode)}/assets/${encodeURIComponent(assetId ?? "")}?w=320`,
        signal,
      ),
    enabled: Boolean(assetId),
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });

  const [objectUrl, setObjectUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!assetQuery.data) {
      // oxlint-disable-next-line react/set-state-in-effect -- object URL 必须在副作用中创建并随查询结果生命周期回收。
      setObjectUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(assetQuery.data);
    setObjectUrl(url);
    setFailed(false);
    return () => URL.revokeObjectURL(url);
  }, [assetQuery.data]);

  const showFallback = !assetId || failed || assetQuery.isError;

  return (
    <figure className={styles.figure}>
      <div
        className={styles.imageFrame}
        style={frameStyle}
        data-state={showFallback ? "fallback" : "ready"}
      >
        {showFallback ? (
          <span className={styles.imageFallback}>
            <ImageOff aria-hidden />
            <span>{assetId ? "图片加载失败" : "图片资源缺失"}</span>
          </span>
        ) : objectUrl ? (
          <img src={objectUrl} alt={alt} decoding="async" onError={() => setFailed(true)} />
        ) : (
          <span className={styles.imageLoading} aria-busy="true">
            <Loader2 aria-hidden />
            <span>图片加载中</span>
          </span>
        )}
      </div>
      {caption ? <figcaption className={styles.caption}>{caption}</figcaption> : null}
    </figure>
  );
}

function InlineContent({ content }: { content?: RequirementBlockNode[] }) {
  return (
    <>
      {(content ?? []).map((node, index) =>
        node.type === "text" ? <TextRun key={index} node={node} /> : null,
      )}
    </>
  );
}

function TextRun({ node }: { node: RequirementBlockNode }) {
  const bold = (node.marks ?? []).some((mark) => mark.type === "bold");
  const content: ReactNode = bold ? <strong>{node.text ?? ""}</strong> : (node.text ?? "");
  return <span>{content}</span>;
}

function EmptyBody() {
  return (
    <div className={styles.empty}>
      <ScanText aria-hidden />
      <p>暂无正文内容，点击“编辑正文”录入。</p>
    </div>
  );
}

function readStringAttr(attrs: Record<string, unknown> | undefined, key: string) {
  const value = attrs?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function readNumberAttr(attrs: Record<string, unknown> | undefined, key: string) {
  const value = attrs?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function clampHeadingLevel(value: number) {
  if (value <= 2) return 2;
  if (value >= 4) return 4;
  return 3;
}

function sanitizeCssLength(value: string) {
  const match = value.match(/^(\d+(?:\.\d+)?)(cm|mm|in|pt|px)$/i);
  return match ? `${match[1]}${match[2].toLowerCase()}` : "";
}

function readAspectRatio(attrs: Record<string, unknown> | undefined) {
  const width = parseCssLength(readStringAttr(attrs, "width"));
  const height = parseCssLength(readStringAttr(attrs, "height"));
  if (!width || !height) return "";
  return `${width} / ${height}`;
}

function parseCssLength(value: string) {
  const match = sanitizeCssLength(value).match(/^(\d+(?:\.\d+)?)(cm|mm|in|pt|px)$/);
  if (!match) return 0;
  const amount = Number(match[1]);
  switch (match[2]) {
    case "pt":
      return amount * (96 / 72);
    case "in":
      return amount * 96;
    case "cm":
      return amount * (96 / 2.54);
    case "mm":
      return amount * (96 / 25.4);
    default:
      return amount;
  }
}

function readCaption(attrs: Record<string, unknown> | undefined) {
  const value = attrs?.caption;
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && "text" in value) {
    const text = (value as { text?: unknown }).text;
    return typeof text === "string" ? text.trim() : "";
  }
  return "";
}

export const RequirementBody = memo(RequirementBodyImpl);
