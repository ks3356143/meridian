import type { NodeApi } from "react-arborist";
import type { ProjectPlatform } from "@/features/projects/types";
import type {
  TestCaseRecord,
  TestItemRecord,
  TestItemsWorkspace,
  TestItemType,
} from "@/features/test-items/types";

export type TestItemsTreeNode = {
  id: string;
  kind: "group" | "folder" | "item" | "case";
  label: string;
  identifier?: string;
  count?: number;
  typeCode?: string;
  category?: string;
  isStatic?: boolean;
  incomplete?: boolean;
  /** 未完善原因（与详情页完善度同口径），树徽章 tooltip 用。 */
  missing?: string[];
  implicit?: boolean;
  /** 静态测试进度徽标（已审/总数或文件数）。 */
  staticBadge?: string;
  status?: string;
  refId?: string;
  /** 用例节点所属测试项 id（跨测试项移动 / 复制时定位目标）。 */
  itemId?: string;
  /** 小写搜索文本（名称 / 标识 / 子项名 / 用例名 / YL_ID），树搜索用。 */
  searchText?: string;
  children?: TestItemsTreeNode[];
};

export function platformApplies(scope: string, platform: ProjectPlatform) {
  if (scope === "cpu") return platform === "CPU/非嵌";
  if (scope === "fpga") return platform === "FPGA";
  return true;
}

function buildCaseNodes(cases: TestCaseRecord[]): TestItemsTreeNode[] {
  return cases.map((record) => ({
    id: `case:${record.id}`,
    kind: "case" as const,
    label: record.name,
    identifier: record.identifier,
    status: record.status,
    refId: record.id,
    itemId: record.testItemId,
    searchText: `${record.name}\n${record.identifier}`.toLowerCase(),
  }));
}

// 树结构：类型分组（文档审查/静态分析/…按字典输出序，静态四类天然置顶）-> 文件夹 / 测试项 -> 用例。
export function buildTestItemsTree(
  workspace: TestItemsWorkspace,
  platform: ProjectPlatform,
): TestItemsTreeNode[] {
  const counts = workspace.counts ?? {};
  const types = workspace.types
    .filter((type) => type.isEnabled && platformApplies(type.platformScope, platform))
    .sort((left, right) => left.outputOrder - right.outputOrder);
  const typeByCode = new Map<string, TestItemType>(types.map((type) => [type.code, type]));
  const items = workspace.items.filter((item) => typeByCode.has(item.typeCode));
  const casesByItem = new Map<string, TestCaseRecord[]>();
  for (const record of workspace.cases) {
    const list = casesByItem.get(record.testItemId);
    if (list) list.push(record);
    else casesByItem.set(record.testItemId, [record]);
  }

  const buildItemNode = (item: TestItemRecord): TestItemsTreeNode => {
    const type = typeByCode.get(item.typeCode);
    const typeCounts = counts[item.id];
    const tracked = (typeCounts?.requirementCount ?? 0) > 0 || item.implicitRequirement;
    // 口径与详情页完善度一致：至少 1 个子项且每个子项的操作步骤/通过准则都非空才算"测试方法"完善。
    const missing: string[] = [];
    if (!tracked) missing.push("追踪关系");
    if ((typeCounts?.subItemCount ?? 0) === 0 || (typeCounts?.incompleteSubItemCount ?? 0) > 0)
      missing.push("测试方法");
    if (item.adequacy.trim() === "") missing.push("充分性要求");
    if (platform === "FPGA" && item.description.trim() === "") missing.push("测试项描述");
    const incomplete = type !== undefined && !type.isStatic && missing.length > 0;
    const staticBadge =
      type?.isStatic && item.typeCode === "CW"
        ? `${typeCounts?.staticFileCount ?? 0} 文件`
        : type?.isStatic && (item.typeCode === "DC" || item.typeCode === "CR")
          ? (typeCounts?.staticTotal ?? 0) > 0
            ? `已审 ${typeCounts?.staticReviewed ?? 0}/${typeCounts?.staticTotal ?? 0}`
            : "未开始"
          : undefined;
    return {
      id: `item:${item.id}`,
      kind: "item",
      label: item.name,
      identifier: item.identifier,
      searchText:
        `${item.name}\n${item.identifier}\n${(typeCounts?.subItemNames ?? []).join("\n")}`.toLowerCase(),
      typeCode: item.typeCode,
      category: type?.category,
      isStatic: type?.isStatic ?? false,
      incomplete,
      missing: incomplete ? missing : undefined,
      implicit: item.implicitRequirement,
      staticBadge,
      refId: item.id,
      children: buildCaseNodes(casesByItem.get(item.id) ?? []),
    };
  };

  // 分组按类型（老项目口径）：文档审查 / 静态分析 / 代码审查 / 代码走查 / 功能测试……，有内容才显示。
  const nodes: TestItemsTreeNode[] = [];
  for (const type of types) {
    const typeItems = items.filter((item) => item.typeCode === type.code);
    if (typeItems.length === 0) continue;

    const folders = workspace.folders
      .filter((folder) => folder.typeCode === type.code)
      .sort((left, right) => left.sortOrder - right.sortOrder);
    const rootItems = typeItems
      .filter((item) => item.folderId === null)
      .sort((left, right) => left.sortOrder - right.sortOrder);

    const children: TestItemsTreeNode[] = folders.map((folder) => {
      const folderItems = typeItems
        .filter((item) => item.folderId === folder.id)
        .sort((left, right) => left.sortOrder - right.sortOrder);
      return {
        id: `folder:${folder.id}`,
        kind: "folder",
        label: folder.name,
        count: folderItems.length,
        refId: folder.id,
        typeCode: folder.typeCode,
        children: folderItems.map(buildItemNode),
      };
    });
    for (const item of rootItems) children.push(buildItemNode(item));

    nodes.push({
      id: `group:${type.code}`,
      kind: "group",
      label: type.name,
      typeCode: type.code,
      category: type.category,
      count: typeItems.length,
      children,
    });
  }
  return nodes;
}

/**
 * 拖拽落位后的乐观工作台：只改容器归属与 sort_order，口径与后端 MoveItem 一致
 * （同类型同容器按 sort_order 重排，落点序号越界时夹到两端）。
 */
export function placeTestItem(
  workspace: TestItemsWorkspace,
  itemId: string,
  folderId: string | null,
  targetIndex: number,
): TestItemsWorkspace {
  const moved = workspace.items.find((item) => item.id === itemId);
  if (!moved) return workspace;
  const container = workspace.items
    .filter(
      (item) =>
        item.id !== itemId && item.typeCode === moved.typeCode && item.folderId === folderId,
    )
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item) => item.id);
  container.splice(Math.max(0, Math.min(targetIndex, container.length)), 0, itemId);
  const positions = new Map(container.map((id, position) => [id, position]));
  return {
    ...workspace,
    items: workspace.items.map((item) => {
      if (item.id === itemId) return { ...item, folderId, sortOrder: positions.get(itemId) ?? 0 };
      const position = positions.get(item.id);
      return position === undefined ? item : { ...item, sortOrder: position };
    }),
  };
}

/** 用例落位（同项排序 / 跨项移动）的乐观工作台，口径与后端 MoveCase 一致。 */
export function placeCase(
  workspace: TestItemsWorkspace,
  caseId: string,
  targetItemId: string,
  targetIndex: number,
): TestItemsWorkspace {
  const container = workspace.cases
    .filter((record) => record.id !== caseId && record.testItemId === targetItemId)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((record) => record.id);
  container.splice(Math.max(0, Math.min(targetIndex, container.length)), 0, caseId);
  const positions = new Map(container.map((id, position) => [id, position]));
  return {
    ...workspace,
    cases: workspace.cases.map((record) => {
      const position = positions.get(record.id);
      if (record.id === caseId) {
        return { ...record, testItemId: targetItemId, sortOrder: positions.get(caseId) ?? 0 };
      }
      return position === undefined ? record : { ...record, sortOrder: position };
    }),
  };
}

/** 行内重命名：右键菜单与 F2 快捷键共用（Enter 提交 / Esc 取消由行内输入框接管）。 */
export async function startInlineRename(
  node: NodeApi<TestItemsTreeNode>,
  onRenamed?: (node: TestItemsTreeNode, name: string) => void,
) {
  const result = await node.edit();
  if (result.cancelled) return;
  const name = result.value.trim();
  if (name !== "" && name !== node.data.label) onRenamed?.(node.data, name);
}

export type TestItemsQuickFilter = "all" | "incomplete" | "failed";

export type TestItemsFilterResult = {
  nodes: TestItemsTreeNode[];
  /** 过滤后可见的测试项数 / 用例数（树底部「显示 X 项 · Y 用例」）。 */
  itemMatches: number;
  caseMatches: number;
};

/**
 * 搜索（名称/标识/子项名/用例名/YL_ID）与快捷筛选（全部 / 未完善 / 有失败）叠加过滤：
 * 命中测试项保留其全部用例；仅用例命中时保留命中的用例与父测试项；容器整枝无命中则隐藏。
 * 搜索 / 筛选态由 TestItemsTree 强制展开命中分支（forceExpanded）。
 */
export function filterTestItemsTree(
  nodes: TestItemsTreeNode[],
  query: string,
  filter: TestItemsQuickFilter,
): TestItemsFilterResult {
  const keyword = query.trim().toLowerCase();
  if (keyword === "" && filter === "all") {
    return { nodes, itemMatches: 0, caseMatches: 0 };
  }

  const counters = { items: 0, cases: 0 };
  const filterNode = (node: TestItemsTreeNode): TestItemsTreeNode | null => {
    if (node.kind === "group" || node.kind === "folder") {
      const children = (node.children ?? [])
        .map(filterNode)
        .filter((child): child is TestItemsTreeNode => child !== null);
      return children.length > 0 ? { ...node, children } : null;
    }
    if (node.kind !== "item") return null;

    if (filter === "incomplete" && !node.incomplete) return null;
    let cases = node.children ?? [];
    if (filter === "failed") {
      cases = cases.filter((child) => child.status === "failed");
      if (cases.length === 0) return null;
    }
    const itemHit = keyword === "" || (node.searchText ?? "").includes(keyword);
    if (keyword !== "" && !itemHit) {
      const hitCases = cases.filter((child) => (child.searchText ?? "").includes(keyword));
      if (hitCases.length === 0) return null;
      cases = hitCases;
    }
    counters.items += 1;
    counters.cases += cases.length;
    return { ...node, children: cases };
  };

  const filtered = nodes.map(filterNode).filter((node): node is TestItemsTreeNode => node !== null);
  return { nodes: filtered, itemMatches: counters.items, caseMatches: counters.cases };
}
