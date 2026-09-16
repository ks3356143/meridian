export type RequirementOrigin = "manual" | "parsed";
export type RequirementStatus = "candidate" | "official" | "excluded" | "superseded";
export type RequirementPrimaryKind =
  | "functional"
  | "interface"
  | "performance"
  | "safety"
  | "reliability"
  | "other";

export interface RequirementSource {
  id: string;
  objectKind: string;
  objectName: string;
  version: string;
}

export interface RequirementRecord {
  id: string;
  sourceVersionId: string;
  sectionId: string;
  chapterNumber: string;
  externalIdentifier: string;
  name: string;
  description: string;
  primaryKind: RequirementPrimaryKind;
  tags: string[];
  origin: RequirementOrigin;
  status: RequirementStatus;
  sourceAnchor: string;
  testItemTaskStatus: "none" | "pending" | "completed";
  updatedAt: string;
}

export interface RequirementsWorkbenchSnapshot {
  sources: RequirementSource[];
  requirements: RequirementRecord[];
}

export interface SaveRequirementPayload {
  sourceVersionId?: string;
  sectionId?: string;
  chapterNumber: string;
  externalIdentifier: string;
  name: string;
  description: string;
  primaryKind: RequirementPrimaryKind;
  tags: string[];
}
