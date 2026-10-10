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
  status?: string;
  refId?: string;
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
    return {
      id: `item:${item.id}`,
      kind: "item",
      label: item.name,
      identifier: item.identifier,
      typeCode: item.typeCode,
      category: type?.category,
      isStatic: type?.isStatic ?? false,
      incomplete,
      missing: incomplete ? missing : undefined,
      implicit: item.implicitRequirement,
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
