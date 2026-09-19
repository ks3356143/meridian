import type { RequirementPrimaryKind, RequirementRecord } from "@/features/requirements/types";
import { requirementKindOptions } from "./requirement-form";

export type BulkPasteRow = {
  id: string;
  line: number;
  columnCount: number;
  chapterNumber: string;
  name: string;
  primaryKind: RequirementPrimaryKind | "";
  included: boolean;
};

export type BulkPasteDirectoryNode = {
  key: string;
  chapter: string;
  rows: BulkPasteRow[];
  children: BulkPasteDirectoryNode[];
};

const kindByLabel = new Map<string, RequirementPrimaryKind>([
  ...requirementKindOptions.map((option) => [option.label, option.value] as const),
  ...requirementKindOptions.map((option) => [option.value, option.value] as const),
]);

export function parseBulkPasteText(text: string): BulkPasteRow[] {
  const rows: BulkPasteRow[] = [];
  let lineNumber = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    lineNumber += 1;
    const line = rawLine.trim();
    if (!line) continue;

    const cells = splitPasteLine(line).map((cell) => cell.trim());
    if (isPasteHeader(cells)) {
      continue;
    }

    const kind = kindByLabel.get(cells[2] ?? "") ?? "";
    rows.push({
      id: `line-${lineNumber}`,
      line: lineNumber,
      columnCount: cells.length,
      chapterNumber: cells[0]?.replace(/^§/, "").trim() ?? "",
      name: cells[1] ?? "",
      primaryKind: kind,
      included: cells.length === 3 && isBasicPasteRowValid(cells[0] ?? "", cells[1] ?? "", kind),
    });
  }

  return rows;
}

export function getBulkPasteErrors(
  rows: BulkPasteRow[],
  requirements: RequirementRecord[],
  sourceVersionId: string,
) {
  const errors = new Map<string, string[]>();
  const includedRows = rows.filter((row) => row.included);

  const chapterCounts = new Map<string, number>();
  const nameCounts = new Map<string, number>();
  for (const row of includedRows) {
    const chapter = row.chapterNumber.trim();
    const name = row.name.trim();
    chapterCounts.set(chapter, (chapterCounts.get(chapter) ?? 0) + 1);
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }

  for (const row of rows) {
    const rowErrors: string[] = [];
    const chapter = row.chapterNumber.trim();
    const name = row.name.trim();

    if (row.columnCount !== 3) rowErrors.push("必须正好为三列");
    if (!chapter) rowErrors.push("章节号必填");
    else if (!/^\d+(?:\.\d+)*$/.test(chapter)) rowErrors.push("章节号格式不正确");

    if (!name) rowErrors.push("名称必填");
    else if ([...name].length > 240) rowErrors.push("名称最多 240 个字符");

    if (!row.primaryKind) rowErrors.push("主类型必填");

    if (row.included && (chapterCounts.get(chapter) ?? 0) > 1) {
      rowErrors.push("批内章节号重复");
    }
    if (row.included && (nameCounts.get(name) ?? 0) > 1) {
      rowErrors.push("批内名称重复");
    }

    if (chapter && name) {
      const chapterConflict = findActiveConflict(
        requirements,
        sourceVersionId,
        (requirement) => requirement.chapterNumber === chapter,
      );
      if (chapterConflict) {
        rowErrors.push(`章节号已被 §${chapterConflict.chapterNumber} ${chapterConflict.name} 使用`);
      }

      const nameConflict = findActiveConflict(
        requirements,
        sourceVersionId,
        (requirement) => requirement.name === name,
      );
      if (nameConflict) {
        rowErrors.push(`名称与 §${nameConflict.chapterNumber} ${nameConflict.name} 重复`);
      }
    }

    errors.set(row.id, rowErrors);
  }

  return errors;
}

export function buildBulkPasteDirectory(rows: BulkPasteRow[]) {
  const root: BulkPasteDirectoryNode[] = [];
  const nodeByChapter = new Map<string, BulkPasteDirectoryNode>();
  const unplacedRows: BulkPasteRow[] = [];

  for (const row of rows) {
    const chapter = row.chapterNumber.trim();
    if (!/^\d+(?:\.\d+)*$/.test(chapter)) {
      unplacedRows.push(row);
      continue;
    }

    const parts = chapter.split(".");
    let prefix = "";
    let siblings = root;
    let node: BulkPasteDirectoryNode | undefined;

    for (const part of parts) {
      prefix = prefix ? `${prefix}.${part}` : part;
      node = nodeByChapter.get(prefix);
      if (!node) {
        node = { key: prefix, chapter: prefix, rows: [], children: [] };
        nodeByChapter.set(prefix, node);
        siblings.push(node);
      }
      siblings = node.children;
    }

    node?.rows.push(row);
  }

  sortDirectory(root);
  return { root, unplacedRows };
}

function splitPasteLine(line: string) {
  const normalized = line.replaceAll("｜", "|");
  return normalized.includes("\t") ? normalized.split("\t") : normalized.split("|");
}

function isPasteHeader(cells: string[]) {
  return (
    cells.length >= 3 &&
    cells[0].replace(/^§/, "").includes("章节号") &&
    cells[1].includes("名称") &&
    cells[2].includes("主类型")
  );
}

function isBasicPasteRowValid(
  chapterNumber: string,
  name: string,
  primaryKind: RequirementPrimaryKind | "",
) {
  return /^\d+(?:\.\d+)*$/.test(chapterNumber.trim()) && name.trim() !== "" && primaryKind !== "";
}

function findActiveConflict(
  requirements: RequirementRecord[],
  sourceVersionId: string,
  predicate: (requirement: RequirementRecord) => boolean,
) {
  return requirements.find(
    (requirement) =>
      requirement.sourceVersionId === sourceVersionId &&
      (requirement.status === "candidate" || requirement.status === "official") &&
      predicate(requirement),
  );
}

function sortDirectory(nodes: BulkPasteDirectoryNode[]) {
  nodes.sort(compareChapters);
  for (const node of nodes) sortDirectory(node.children);
}

function compareChapters(left: BulkPasteDirectoryNode, right: BulkPasteDirectoryNode) {
  const leftParts = left.chapter.split(".").map(Number);
  const rightParts = right.chapter.split(".").map(Number);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return left.chapter.localeCompare(right.chapter);
}
