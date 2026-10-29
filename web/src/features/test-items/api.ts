import { request } from "@/api/client";
import type { RequirementBlockNode } from "@/features/requirements/types";
import type {
  BatchCreateTestItemsResult,
  CaseStepRecord,
  TestCaseRecord,
  StaticState,
  StaticWorkbench,
  RequirementTestItemPreview,
  TestCaseSearchHit,
  TestItemDetail,
  TestItemFolder,
  TestItemRecord,
  TestItemRequirementRef,
  TestItemsWorkspace,
  TestSubItemRecord,
  RoundCopyPreview,
  CreateRoundCopyPayload,
  RoundCopyResult,
  TestRoundRecord,
  PreviousRoundResult,
} from "./types";

export interface CreateTestItemPayload {
  typeCode: string;
  name: string;
  suffix?: string;
  priority?: string;
  folderId?: string | null;
  description?: string;
  adequacy?: string;
  passCriteria?: string;
  implicitRequirement?: boolean;
}

export interface UpdateTestItemPayload {
  /** 修改类型：标识、用例编号、树分组与未改动的套话随之更新。 */
  typeCode?: string;
  name?: string;
  suffix?: string;
  priority?: string;
  folderId?: string | null;
  clearFolder?: boolean;
  description?: string;
  adequacy?: string;
  passCriteria?: string;
  implicitRequirement?: boolean;
}

export interface UpdateSubItemPayload {
  name?: string;
  description?: string;
  ops?: string;
  expected?: string;
}

export interface CreateTestItemFolderPayload {
  typeCode: string;
  name: string;
  parentId?: string | null;
}

export interface BatchAssignCasesPayload {
  caseIds: string[];
  /** 空字符串清除指派；省略表示不修改。 */
  testerId?: string;
  status?: "pending" | "passed" | "failed";
  /** YYYY-MM-DD；空字符串清除；省略表示不修改。 */
  execDate?: string;
}

export interface UpdateCasePayload {
  name?: string;
  summary?: string;
  initText?: string;
  prerequisites?: string;
  terminationText?: string;
  passCriteria?: string;
  designerId?: string;
  testerId?: string;
  monitorId?: string;
  notes?: string;
  notExecutedReason?: string;
  clearExecDate?: boolean;
}

export const testItemsApi = {
  workspace: (projectCode: string, roundId: string) =>
    request<TestItemsWorkspace>(
      "GET",
      `/api/v1/projects/${projectCode}/test-items?roundId=${encodeURIComponent(roundId)}`,
    ),
  rounds: (projectCode: string) =>
    request<TestRoundRecord[]>("GET", `/api/v1/projects/${projectCode}/test-rounds`),
  roundCopyPreview: (projectCode: string, sourceRoundId: string) =>
    request<RoundCopyPreview>(
      "GET",
      `/api/v1/projects/${projectCode}/test-rounds/${sourceRoundId}/copy-preview`,
    ),
  createRoundCopy: (projectCode: string, payload: CreateRoundCopyPayload) =>
    request<RoundCopyResult>("POST", `/api/v1/projects/${projectCode}/test-rounds`, {}, payload),
  detail: (testItemId: string) =>
    request<TestItemDetail>("GET", `/api/v1/test-items/${testItemId}`),
  createItem: (projectCode: string, roundId: string, payload: CreateTestItemPayload) =>
    request<TestItemRecord>(
      "POST",
      `/api/v1/projects/${projectCode}/test-items?roundId=${encodeURIComponent(roundId)}`,
      {},
      payload,
    ),
  /** 按需求默认值创建并关联测试项；createAnother 为真时跳过同类型同名称复用。 */
  createFromRequirement: (projectCode: string, requirementId: string, createAnother = false) =>
    request<TestItemRecord>(
      "POST",
      `/api/v1/projects/${projectCode}/test-items`,
      {},
      { requirementId, createAnother },
    ),
  /** 全部或选中的已确认需求批量创建测试项；已关联和待补描述默认跳过。 */
  createFromRequirements: (
    projectCode: string,
    roundId: string,
    payload: { all?: boolean; requirementIds?: string[] },
  ) =>
    request<BatchCreateTestItemsResult>(
      "POST",
      `/api/v1/projects/${projectCode}/test-items/from-requirements?roundId=${encodeURIComponent(roundId)}`,
      {},
      payload,
    ),
  /** 测试项页入口：已确认需求的创建候选与关联状态。 */
  requirementCreatePreview: (projectCode: string, roundId: string) =>
    request<RequirementTestItemPreview>(
      "GET",
      `/api/v1/projects/${projectCode}/test-items/from-requirements/preview?roundId=${encodeURIComponent(roundId)}`,
    ),
  /** 需求详情侧的已关联测试项。 */
  requirementItems: (requirementId: string) =>
    request<TestItemRecord[]>("GET", `/api/v1/software-requirements/${requirementId}/test-items`),
  updateItem: (testItemId: string, payload: UpdateTestItemPayload) =>
    request<TestItemRecord>("PATCH", `/api/v1/test-items/${testItemId}`, {}, payload),
  deleteItem: (testItemId: string) => request<void>("DELETE", `/api/v1/test-items/${testItemId}`),
  /** 复制新增：内容字段与子项一起复制，标识按「-副本」重排；静态类型后端拒绝。 */
  duplicateItem: (testItemId: string) =>
    request<TestItemRecord>("POST", `/api/v1/test-items/${testItemId}/duplicate`),
  createFolder: (projectCode: string, roundId: string, payload: CreateTestItemFolderPayload) =>
    request<TestItemFolder>(
      "POST",
      `/api/v1/projects/${projectCode}/test-item-folders?roundId=${encodeURIComponent(roundId)}`,
      {},
      payload,
    ),
  updateFolder: (folderId: string, name: string) =>
    request<TestItemFolder>("PATCH", `/api/v1/test-item-folders/${folderId}`, {}, { name }),
  deleteFolder: (folderId: string) =>
    request<void>("DELETE", `/api/v1/test-item-folders/${folderId}`),
  /** 拖拽落位：folderId 为 null 表示移到类型根目录。 */
  moveItem: (testItemId: string, folderId: string | null, targetIndex: number) =>
    request<void>("POST", `/api/v1/test-items/${testItemId}/move`, {}, { folderId, targetIndex }),
  moveCase: (caseId: string, targetItemId: string, targetIndex: number) =>
    request<void>("POST", `/api/v1/test-cases/${caseId}/move`, {}, { targetItemId, targetIndex }),
  createSubItem: (testItemId: string, name: string) =>
    request<TestSubItemRecord>("POST", `/api/v1/test-items/${testItemId}/sub-items`, {}, { name }),
  updateSubItem: (subItemId: string, payload: UpdateSubItemPayload) =>
    request<TestSubItemRecord>("PATCH", `/api/v1/test-sub-items/${subItemId}`, {}, payload),
  deleteSubItem: (subItemId: string) =>
    request<void>("DELETE", `/api/v1/test-sub-items/${subItemId}`),
  duplicateSubItem: (subItemId: string) =>
    request<TestSubItemRecord>("POST", `/api/v1/test-sub-items/${subItemId}/duplicate`),
  moveSubItem: (subItemId: string, targetIndex: number) =>
    request<void>("POST", `/api/v1/test-sub-items/${subItemId}/move`, {}, { targetIndex }),
  createCase: (testItemId: string, name: string) =>
    request<TestCaseRecord>("POST", `/api/v1/test-items/${testItemId}/cases`, {}, { name }),
  updateCase: (caseId: string, payload: UpdateCasePayload) =>
    request<TestCaseRecord>("PATCH", `/api/v1/test-cases/${caseId}`, {}, payload),
  /** 同一测试项内批量设置测试人员、状态与执行日期。 */
  batchAssignCases: (testItemId: string, payload: BatchAssignCasesPayload) =>
    request<{ cases: TestCaseRecord[] }>(
      "POST",
      `/api/v1/test-items/${testItemId}/cases/batch-assign`,
      {},
      payload,
    ).then((result) => result.cases),
  staticWorkbench: (testItemId: string) =>
    request<StaticWorkbench>("GET", `/api/v1/test-items/${testItemId}/static-workbench`),
  saveStaticWorkbench: (testItemId: string, expectedVersion: number, state: StaticState) =>
    request<StaticWorkbench>(
      "PUT",
      `/api/v1/test-items/${testItemId}/static-workbench`,
      {},
      { expectedVersion, state },
    ),
  ensureStaticItems: (projectCode: string) =>
    request<{ created: TestItemRecord[] }>(
      "POST",
      `/api/v1/projects/${projectCode}/static-items/ensure`,
    ).then((result) => result.created),
  deleteStaticItems: (projectCode: string) =>
    request<{ removed: number }>("DELETE", `/api/v1/projects/${projectCode}/static-items`).then(
      (result) => result.removed,
    ),
  /** 测试项内查找用例字段与步骤正文。 */
  searchCases: (testItemId: string, query: string) =>
    request<{ hits: TestCaseSearchHit[] }>(
      "GET",
      `/api/v1/test-items/${testItemId}/search?q=${encodeURIComponent(query)}`,
    ).then((result) => result.hits),
  caseSteps: (caseId: string) =>
    request<CaseStepRecord[]>("GET", `/api/v1/test-cases/${caseId}/steps`),
  previousRoundResult: (caseId: string) =>
    request<PreviousRoundResult>("GET", `/api/v1/test-cases/${caseId}/previous-round-result`, {
      skipErrorToast: true,
    }),
  createCaseStep: (caseId: string, expectText: string) =>
    request<CaseStepRecord>("POST", `/api/v1/test-cases/${caseId}/steps`, {}, { expectText }),
  updateCaseStep: (stepId: string, payload: { expectText?: string; passed?: string }) =>
    request<CaseStepRecord>("PATCH", `/api/v1/test-case-steps/${stepId}`, {}, payload),
  /** 三态循环：未执行 → 通过 → 未通过 → 未执行。 */
  toggleCaseStep: (stepId: string) =>
    request<CaseStepRecord>("POST", `/api/v1/test-case-steps/${stepId}/toggle`),
  duplicateCaseStep: (stepId: string) =>
    request<CaseStepRecord>("POST", `/api/v1/test-case-steps/${stepId}/duplicate`),
  /** 在目标步骤上方插入空步骤（步骤表 Ctrl+Shift+Enter）。 */
  insertCaseStepBefore: (stepId: string) =>
    request<CaseStepRecord>("POST", `/api/v1/test-case-steps/${stepId}/insert-before`),
  /** 跨用例复制步骤：把源步骤的设计内容复制到目标用例末尾。 */
  importCaseStep: (targetCaseId: string, sourceStepId: string) =>
    request<CaseStepRecord>(
      "POST",
      `/api/v1/test-cases/${targetCaseId}/steps/import`,
      {},
      { sourceStepId },
    ),
  deleteCaseStep: (stepId: string) => request<void>("DELETE", `/api/v1/test-case-steps/${stepId}`),
  /** 保存步骤富文本块（op 输入及操作 / act 实测结果），至少提交一个。 */
  saveCaseStepBlocks: (
    stepId: string,
    payload: { op?: RequirementBlockNode; act?: RequirementBlockNode },
  ) => request<CaseStepRecord>("PUT", `/api/v1/test-case-steps/${stepId}/blocks`, {}, payload),
  moveCaseStep: (stepId: string, targetIndex: number) =>
    request<void>("POST", `/api/v1/test-case-steps/${stepId}/move`, {}, { targetIndex }),
  duplicateCase: (caseId: string) =>
    request<TestCaseRecord>("POST", `/api/v1/test-cases/${caseId}/duplicate`),
  /** Ctrl+拖拽：复制到目标测试项的目标位置。 */
  copyCase: (caseId: string, targetItemId: string, targetIndex: number) =>
    request<TestCaseRecord>(
      "POST",
      `/api/v1/test-cases/${caseId}/copy`,
      {},
      { targetItemId, targetIndex },
    ),
  deleteCase: (caseId: string) => request<void>("DELETE", `/api/v1/test-cases/${caseId}`),
  linkRequirement: (testItemId: string, requirementId: string) =>
    request<TestItemRequirementRef[]>(
      "POST",
      `/api/v1/test-items/${testItemId}/requirements`,
      {},
      { requirementId },
    ),
  unlinkRequirement: (testItemId: string, requirementId: string) =>
    request<TestItemRequirementRef[]>(
      "DELETE",
      `/api/v1/test-items/${testItemId}/requirements/${requirementId}`,
    ),
};
