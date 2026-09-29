import { request } from "@/api/client";
import type {
  BulkCreateRequirementPayload,
  BulkCreateRequirementResult,
  BulkCleanNamesPayload,
  BulkCleanNamesResult,
  BulkPurgeRequirementsPayload,
  BulkUpdateRequirementPayload,
  RequirementRecord,
  RequirementsWorkbenchSnapshot,
  RequirementIdentifierPreview,
  RequirementContent,
  RequirementSearchResult,
  RequirementStatusPayload,
  RequirementEvent,
  SaveRequirementPayload,
  RequirementParseResult,
} from "./types";

export const requirementsApi = {
  workbench: (projectId: string) =>
    request<RequirementsWorkbenchSnapshot>("GET", `/api/v1/projects/${projectId}/requirements`),
  content: (requirementId: string) =>
    request<RequirementContent>("GET", `/api/v1/software-requirements/${requirementId}/content`),
  search: (projectId: string, query: string, sourceVersionId = "") => {
    const params = new URLSearchParams({ q: query });
    if (sourceVersionId) params.set("sourceVersionId", sourceVersionId);
    return request<RequirementSearchResult>(
      "GET",
      `/api/v1/projects/${projectId}/requirements/search?${params}`,
      { skipErrorToast: true },
    );
  },
  previewIdentifier: (projectId: string, sourceVersionId: string, name: string) => {
    const query = new URLSearchParams({ sourceVersionId, name });
    return request<RequirementIdentifierPreview>(
      "GET",
      `/api/v1/projects/${projectId}/requirements/identifier-preview?${query}`,
      { skipErrorToast: true },
    );
  },
  create: (projectId: string, payload: SaveRequirementPayload) =>
    request<RequirementRecord>("POST", `/api/v1/projects/${projectId}/requirements`, {}, payload),
  update: (requirementId: string, payload: Omit<SaveRequirementPayload, "sourceVersionId">) =>
    request<RequirementRecord>(
      "PUT",
      `/api/v1/software-requirements/${requirementId}`,
      {},
      payload,
    ),
  changeStatus: (projectId: string, payload: RequirementStatusPayload) =>
    request<{ updatedCount: number }>(
      "POST",
      `/api/v1/projects/${projectId}/requirements/status`,
      {},
      payload,
    ),
  parse: (projectId: string, sourceVersionId: string) =>
    request<RequirementParseResult>(
      "POST",
      `/api/v1/projects/${projectId}/requirements/parse`,
      {},
      { sourceVersionId },
    ),
  events: (requirementId: string) =>
    request<RequirementEvent[]>("GET", `/api/v1/software-requirements/${requirementId}/events`),
  purge: (projectId: string, requirementId: string, reason: string) =>
    request<{ deletedCount: number }>(
      "POST",
      `/api/v1/projects/${projectId}/requirements/${requirementId}/purge`,
      {},
      { reason },
    ),
  bulkPurge: (projectId: string, payload: BulkPurgeRequirementsPayload) =>
    request<{ deletedCount: number }>(
      "POST",
      `/api/v1/projects/${projectId}/requirements/purge`,
      {},
      payload,
    ),
  bulkUpdate: (projectId: string, payload: BulkUpdateRequirementPayload) =>
    request<{ updatedCount: number }>(
      "POST",
      `/api/v1/projects/${projectId}/requirements/bulk-update`,
      {},
      payload,
    ),
  bulkCreate: (projectId: string, payload: BulkCreateRequirementPayload) =>
    request<BulkCreateRequirementResult>(
      "POST",
      `/api/v1/projects/${projectId}/requirements/bulk`,
      {},
      payload,
    ),
  bulkCleanNames: (projectId: string, payload: BulkCleanNamesPayload) =>
    request<BulkCleanNamesResult>(
      "POST",
      `/api/v1/projects/${projectId}/requirements/bulk-clean-names`,
      {},
      payload,
    ),
};
