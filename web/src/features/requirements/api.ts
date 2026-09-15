import { request } from "@/api/client";
import type {
  RequirementBulkCreatePayload,
  RequirementParseResult,
  RequirementSection,
  RequirementsWorkbench,
  SoftwareRequirement,
} from "./types";

export interface SaveRequirementPayload {
  sourceVersionId: string;
  sectionId?: string;
  chapterNumber: string;
  externalIdentifier: string;
  name: string;
  description: string;
  primaryKind: string;
  tags: string[];
}

export const requirementsApi = {
  workbench: (projectId: string, sourceVersionId?: string) =>
    request<RequirementsWorkbench>(
      "GET",
      `/api/v1/projects/${projectId}/requirements${sourceVersionId ? `?sourceVersionId=${sourceVersionId}` : ""}`,
    ),
  createSection: (
    projectId: string,
    payload: { sourceVersionId: string; parentId?: string; chapterNumber: string; title: string },
  ) =>
    request<RequirementSection>(
      "POST",
      `/api/v1/projects/${projectId}/requirement-sections`,
      {},
      payload,
    ),
  create: (projectId: string, payload: SaveRequirementPayload) =>
    request<SoftwareRequirement>("POST", `/api/v1/projects/${projectId}/requirements`, {}, payload),
  bulkCreate: (projectId: string, payload: RequirementBulkCreatePayload) =>
    request<{ sectionCount: number; requirementCount: number }>(
      "POST",
      `/api/v1/projects/${projectId}/requirements/bulk`,
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
  update: (requirementId: string, payload: Omit<SaveRequirementPayload, "sourceVersionId">) =>
    request<SoftwareRequirement>(
      "PUT",
      `/api/v1/software-requirements/${requirementId}`,
      {},
      payload,
    ),
  changeStatus: (
    projectId: string,
    payload: { ids: string[]; action: "confirm" | "exclude"; reason?: string },
  ) =>
    request<{ updatedCount: number }>(
      "POST",
      `/api/v1/projects/${projectId}/requirements/status`,
      {},
      payload,
    ),
};
