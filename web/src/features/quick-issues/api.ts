import { request } from "@/api/client";
import type { CreateQuickIssuePayload, QuickIssueNote, UpdateQuickIssuePayload } from "./types";

export const quickIssuesApi = {
  list: (caseId: string) =>
    request<QuickIssueNote[]>("GET", `/api/v1/test-cases/${caseId}/quick-issues`),
  create: (caseId: string, payload: CreateQuickIssuePayload) =>
    request<QuickIssueNote>("POST", `/api/v1/test-cases/${caseId}/quick-issues`, {}, payload),
  update: (noteId: string, payload: UpdateQuickIssuePayload) =>
    request<QuickIssueNote>("PATCH", `/api/v1/quick-issues/${noteId}`, {}, payload),
  delete: (noteId: string) => request<void>("DELETE", `/api/v1/quick-issues/${noteId}`),
};
