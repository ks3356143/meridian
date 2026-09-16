import { request } from "@/api/client";
import type {
  RequirementRecord,
  RequirementsWorkbenchSnapshot,
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
};
