import type {
  RequirementPrimaryKind,
  RequirementSection,
  RequirementStatus,
  RequirementSource,
  RequirementsWorkbench,
  SoftwareRequirement,
} from "@/features/requirements/types";

export const primaryKindOptions: Array<{
  value: RequirementPrimaryKind;
  label: string;
  variant: "primary" | "info" | "warning" | "danger" | "success" | "secondary";
}> = [
  { value: "functional", label: "功能需求", variant: "primary" },
  { value: "performance", label: "性能需求", variant: "warning" },
  { value: "interface", label: "接口需求", variant: "info" },
  { value: "safety", label: "安全性需求", variant: "danger" },
  { value: "reliability", label: "可靠性需求", variant: "success" },
  { value: "other", label: "其他", variant: "secondary" },
];

export const statusMeta: Record<
  RequirementStatus,
  { label: string; variant: "warning" | "primary" | "secondary" | "destructive" }
> = {
  candidate: { label: "候选", variant: "warning" },
  official: { label: "正式", variant: "primary" },
  excluded: { label: "已排除", variant: "secondary" },
  superseded: { label: "已替代", variant: "secondary" },
};

export type RequirementTreeNode = {
  key: string;
  id: string;
  type: "source" | "section" | "requirement";
  title: string;
  chapterNumber: string;
  source?: RequirementSource;
  section?: RequirementSection;
  requirement?: SoftwareRequirement;
  children: RequirementTreeNode[];
};

export function getPrimaryKindMeta(kind: RequirementPrimaryKind) {
  return primaryKindOptions.find((option) => option.value === kind) ?? primaryKindOptions.at(-1)!;
}

export function buildRequirementTree(workbench: RequirementsWorkbench): RequirementTreeNode[] {
  if (!workbench.sources.length) return [];
  const source = workbench.sources[0];
  const sectionNodes = new Map<string, RequirementTreeNode>();
  const roots: RequirementTreeNode[] = [];

  for (const section of workbench.sections) {
    const node: RequirementTreeNode = {
      key: `section:${section.id}`,
      id: section.id,
      type: "section",
      title: section.title,
      chapterNumber: section.chapterNumber,
      section,
      children: [],
    };
    sectionNodes.set(section.id, node);
  }
  for (const section of workbench.sections) {
    const node = sectionNodes.get(section.id)!;
    const parent = section.parentId ? sectionNodes.get(section.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  for (const requirement of workbench.requirements) {
    const parent = requirement.sectionId ? sectionNodes.get(requirement.sectionId) : undefined;
    const node: RequirementTreeNode = {
      key: `requirement:${requirement.id}`,
      id: requirement.id,
      type: "requirement",
      title: requirement.name,
      chapterNumber: requirement.chapterNumber,
      requirement,
      children: [],
    };
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return [
    {
      key: `source:${source.id}`,
      id: source.id,
      type: "source",
      title: `${source.objectName} ${source.version}`,
      chapterNumber: "",
      source,
      children: roots,
    },
  ];
}

export function filterRequirementTree(
  nodes: RequirementTreeNode[],
  keyword: string,
  statusFilter: "active" | "candidate" | "all",
  kindFilter: RequirementPrimaryKind | "all",
): RequirementTreeNode[] {
  const search = keyword.trim().toLowerCase();
  return nodes
    .map((node) => filterNode(node, search, statusFilter, kindFilter))
    .filter((node): node is RequirementTreeNode => Boolean(node));
}

function filterNode(
  node: RequirementTreeNode,
  search: string,
  statusFilter: "active" | "candidate" | "all",
  kindFilter: RequirementPrimaryKind | "all",
): RequirementTreeNode | null {
  const children = node.children
    .map((child) => filterNode(child, search, statusFilter, kindFilter))
    .filter((child): child is RequirementTreeNode => Boolean(child));
  const matchesStatus = matchStatus(node, statusFilter);
  const matchesKind = matchKind(node, kindFilter);
  const haystack = `${node.chapterNumber} ${node.title} ${node.requirement?.description ?? ""} ${
    node.requirement?.externalIdentifier ?? ""
  } ${node.requirement?.tags.join(" ") ?? ""}`.toLowerCase();
  const matchesSearch = search === "" || haystack.includes(search);
  if (!matchesStatus || !matchesKind || (!matchesSearch && children.length === 0)) return null;
  return { ...node, children: matchesSearch && node.type !== "source" ? node.children : children };
}

function matchKind(node: RequirementTreeNode, kindFilter: RequirementPrimaryKind | "all"): boolean {
  if (kindFilter === "all" || node.type !== "requirement") return true;
  return node.requirement?.primaryKind === kindFilter;
}

function matchStatus(
  node: RequirementTreeNode,
  statusFilter: "active" | "candidate" | "all",
): boolean {
  if (statusFilter === "all" || node.type !== "requirement") return true;
  if (statusFilter === "candidate") return node.requirement?.status === "candidate";
  return node.requirement?.status === "official" || node.requirement?.status === "candidate";
}

export function countRequirements(
  nodes: RequirementTreeNode[],
  status?: RequirementStatus,
): number {
  return nodes.reduce((sum, node) => {
    const selfCount =
      node.type === "requirement" && (!status || node.requirement?.status === status) ? 1 : 0;
    return sum + selfCount + countRequirements(node.children, status);
  }, 0);
}

export function suggestChapterNumber(
  sections: RequirementSection[],
  requirements: SoftwareRequirement[],
  parentChapter: string,
): string {
  if (!parentChapter) return "";

  const prefix = parentChapter ? `${parentChapter}.` : "";
  let max = 0;
  const chapters = [
    ...sections.map((section) => section.chapterNumber),
    ...requirements.map((requirement) => requirement.chapterNumber),
  ];
  for (const chapter of chapters) {
    if (!chapter.startsWith(prefix)) continue;
    const suffix = Number(chapter.slice(prefix.length).split(".")[0]);
    if (Number.isFinite(suffix) && suffix > max) max = suffix;
  }
  return max > 0 ? `${prefix}${max + 1}` : "";
}

export function parseBulkLines(content: string): Array<{
  line: number;
  chapterNumber: string;
  title: string;
  nodeType: "section" | "requirement";
  primaryKind: RequirementPrimaryKind;
  description: string;
  error?: string;
}> {
  return content
    .split(/\r?\n/)
    .map((lineText, index) => ({ lineText, lineNumber: index + 1 }))
    .filter((item) => item.lineText.trim())
    .map(({ lineText, lineNumber }) => {
      const lineMatch = lineText.trim().match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
      if (!lineMatch) {
        return {
          line: lineNumber,
          chapterNumber: "",
          title: "",
          nodeType: "section",
          primaryKind: "functional",
          description: "",
          error: "每行至少需要“章节号 名称”",
        };
      }
      const chapterNumber = lineMatch[1];
      const [mainText, description = ""] = lineMatch[2].split(/\s*[|｜]\s*/);
      const kindMatch = mainText.match(
        /\s+(功能需求|性能需求|接口需求|安全性需求|可靠性需求|其他)$/,
      );
      const kind = kindMatch
        ? kindMatch[1] === "其他"
          ? "other"
          : parseKindText(kindMatch[1])
        : null;
      const title = kindMatch ? mainText.slice(0, kindMatch.index) : mainText;
      return {
        line: lineNumber,
        chapterNumber,
        title,
        nodeType: kind ? "requirement" : "section",
        primaryKind: kind ?? "functional",
        description,
        error: validateBulkLine(chapterNumber, title),
      };
    });
}

function parseKindText(text: string): RequirementPrimaryKind | null {
  const normalized = text?.trim();
  const option = primaryKindOptions.find(
    (item) => item.label === normalized || item.value === normalized,
  );
  return option?.value ?? null;
}

function validateBulkLine(chapterNumber: string, title: string): string | undefined {
  if (!/^\d+(?:\.\d+)*$/.test(chapterNumber)) return "章节号应为数字层级";
  if (!title.trim()) return "名称不能为空";
  return undefined;
}
