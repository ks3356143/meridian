import { request } from "@/api/client";
import type {
  TestCaseRecord,
  TestItemDetail,
  TestItemFolder,
  TestItemRecord,
  TestItemRequirementRef,
  TestItemsWorkspace,
  TestSubItemRecord,
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

export const testItemsApi = {
  workspace: (projectCode: string) =>
    request<TestItemsWorkspace>("GET", `/api/v1/projects/${projectCode}/test-items`),
  detail: (testItemId: string) =>
    request<TestItemDetail>("GET", `/api/v1/test-items/${testItemId}`),
  createItem: (projectCode: string, payload: CreateTestItemPayload) =>
    request<TestItemRecord>("POST", `/api/v1/projects/${projectCode}/test-items`, {}, payload),
  updateItem: (testItemId: string, payload: UpdateTestItemPayload) =>
    request<TestItemRecord>("PATCH", `/api/v1/test-items/${testItemId}`, {}, payload),
  deleteItem: (testItemId: string) => request<void>("DELETE", `/api/v1/test-items/${testItemId}`),
  createFolder: (projectCode: string, payload: CreateTestItemFolderPayload) =>
    request<TestItemFolder>(
      "POST",
      `/api/v1/projects/${projectCode}/test-item-folders`,
      {},
      payload,
    ),
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
