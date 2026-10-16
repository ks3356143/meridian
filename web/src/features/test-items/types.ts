import type { RequirementBlockNode } from "@/features/requirements/types";

export interface TestItemType {
  id: string;
  code: string;
  name: string;
  category: string;
  isStatic: boolean;
  platformScope: string;
  outputOrder: number;
  defaultAdequacy: string;
  defaultPassCriteria: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TestItemFolder {
  id: string;
  projectId: string;
  typeCode: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestItemRecord {
  id: string;
  projectId: string;
  typeCode: string;
  identifier: string;
  suffix: string;
  name: string;
  priority: string;
  folderId: string | null;
  sortOrder: number;
  description: string;
  adequacy: string;
  passCriteria: string;
  implicitRequirement: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TestSubItemRecord {
  id: string;
  testItemId: string;
  seq: number;
  name: string;
  description: string;
  /** 操作步骤（多行文本，行数与通过准则 1:1）。 */
  ops: string;
  /** 通过准则 / 预期结果（多行文本）。 */
  expected: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestCaseRecord {
  id: string;
  projectId: string;
  testItemId: string;
  identifier: string;
  seq: number;
  name: string;
  summary: string;
  initText: string;
  prerequisites: string;
  /** 终止条件（测试说明侧，切片 5b）。 */
  terminationText: string;
  /** 通过准则（测试说明侧，切片 5b）。 */
  passCriteria: string;
  designerId: string | null;
  testerId: string | null;
  monitorId: string | null;
  execDate: string | null;
  status: string;
  notes: string;
  notExecutedReason: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** 步骤富文本块视图（op = 输入及操作 / act = 实测结果，切片 5b）。 */
export interface StepBlockView {
  /** 结构化文档；无块记录时为 null。 */
  doc: RequirementBlockNode | null;
  plainText: string;
  hasContent: boolean;
}

export interface CaseStepRecord {
  id: string;
  testCaseId: string;
  seq: number;
  /** 预期结果（纯文本）。 */
  expectText: string;
  /** 通过状态：none 未执行 / pass 通过 / fail 未通过。 */
  passed: string;
  /** 输入及操作：富文本（文字 + 图片，不出现表格）。 */
  op: StepBlockView;
  /** 实测结果：富文本（文字 + 图片 + 表格）。 */
  act: StepBlockView;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestRoundRecord {
  id: string;
  projectId: string;
  roundNumber: number;
  name: string;
  roundType: string;
  status: string;
  startedOn: string | null;
  endedOn: string | null;
  dutVersion: string;
  changeReason: string;
  reasonSummary: string;
  sourceRoundId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TestItemRequirementRef {
  id: string;
  chapterNumber: string;
  name: string;
  externalIdentifier: string;
  status: string;
  sourceName: string;
  sourceVersion: string;
}

export interface TestItemCounts {
  subItemCount: number;
  requirementCount: number;
  /** 操作步骤或通过准则为空的子项数：>0 视为"测试方法未完善"。 */
  incompleteSubItemCount: number;
  /** 子项名称（树搜索按子项名匹配；无子项时为 null）。 */
  subItemNames?: string[] | null;
}

export interface TestItemsWorkspace {
  round: TestRoundRecord;
  types: TestItemType[];
  folders: TestItemFolder[];
  items: TestItemRecord[];
  cases: TestCaseRecord[];
  counts: Record<string, TestItemCounts>;
}

export interface TestItemDetail {
  item: TestItemRecord;
  subItems: TestSubItemRecord[];
  requirements: TestItemRequirementRef[];
  cases: TestCaseRecord[];
}

export type TestItemPriority = "高" | "中" | "低";
export type TestCaseStatus = "pending" | "passed" | "failed";
