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
