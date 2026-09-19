import { request } from "@/api/client";
import type {
  BulkCreateRequirementPayload,
  BulkCreateRequirementResult,
  BulkUpdateRequirementPayload,
  RequirementRecord,
  RequirementsWorkbenchSnapshot,
  RequirementStatusPayload,
  RequirementEvent,
  SaveRequirementPayload,
} from "./types";

export const requirementsApi = {
  workbench: (projectId: string) =>
    request<RequirementsWorkbenchSnapshot>("GET", `/api/v1/projects/${projectId}/requirements`),
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
  events: (requirementId: string) =>
    request<RequirementEvent[]>("GET", `/api/v1/software-requirements/${requirementId}/events`),
  purge: (projectId: string, requirementId: string, reason: string) =>
    request<{ deletedCount: number }>(
      "POST",
      `/api/v1/projects/${projectId}/requirements/${requirementId}/purge`,
      {},
      { reason },
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
};
