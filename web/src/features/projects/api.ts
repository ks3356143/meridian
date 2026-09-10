import { request } from "@/api/client";
import type {
  CreateProjectPayload,
  DictionaryOption,
  Project,
  ProjectOptions,
  ReferenceStandard,
  SaveDictionaryPayload,
  RelatedParty,
  SaveRelatedPartyPayload,
  SaveReferenceStandardPayload,
} from "./types";

export const projectsApi = {
  list: () => request<Project[]>("GET", "/api/v1/projects"),
  detail: (projectId: string) => request<Project>("GET", `/api/v1/projects/${projectId}`),
  options: () => request<ProjectOptions>("GET", "/api/v1/project-options"),
  create: (payload: CreateProjectPayload) =>
    request<Project>("POST", "/api/v1/projects", {}, payload),
  listDictionaries: () => request<DictionaryOption[]>("GET", "/api/v1/dictionaries"),
  createDictionary: (payload: SaveDictionaryPayload) =>
    request<DictionaryOption>("POST", "/api/v1/dictionaries", {}, payload),
  updateDictionary: (id: string, payload: SaveDictionaryPayload) =>
    request<DictionaryOption>("PUT", `/api/v1/dictionaries/${id}`, {}, payload),
  listStandards: () => request<ReferenceStandard[]>("GET", "/api/v1/reference-standards"),
  createStandard: (payload: SaveReferenceStandardPayload) =>
    request<ReferenceStandard>("POST", "/api/v1/reference-standards", {}, payload),
  updateStandard: (id: string, payload: SaveReferenceStandardPayload) =>
    request<ReferenceStandard>("PUT", `/api/v1/reference-standards/${id}`, {}, payload),
  listRelatedParties: () => request<RelatedParty[]>("GET", "/api/v1/related-parties"),
  createRelatedParty: (payload: SaveRelatedPartyPayload) =>
    request<RelatedParty>("POST", "/api/v1/related-parties", {}, payload),
  updateRelatedParty: (id: string, payload: SaveRelatedPartyPayload) =>
    request<RelatedParty>("PUT", `/api/v1/related-parties/${id}`, {}, payload),
};
