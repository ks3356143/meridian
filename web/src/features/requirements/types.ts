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
  secondaryKinds: RequirementPrimaryKind[];
  tags: string[];
  origin: RequirementOrigin;
  status: RequirementStatus;
  sourceAnchor: string;
  testItemTaskStatus: "none" | "pending" | "completed";
  deletedFromStatus?: RequirementStatus;
  deletedReason?: string;
  deletedAt?: string;
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
  secondaryKinds: RequirementPrimaryKind[];
  tags: string[];
}

export interface RequirementStatusPayload {
  ids: string[];
  action: "confirm" | "exclude" | "restore";
  reason?: string;
}

export interface BulkReplacePayload {
  find: string;
  replacement?: string;
  applyToName?: boolean;
  applyToIdentifier?: boolean;
}

export type BulkCreateRequirementItem = {
  nodeType: "requirement";
  chapterNumber: string;
  name: string;
  primaryKind: RequirementPrimaryKind;
};

export interface BulkCreateRequirementPayload {
  sourceVersionId: string;
  items: BulkCreateRequirementItem[];
}

export interface BulkCreateRequirementResult {
  requirementCount: number;
}

export interface BulkUpdateRequirementPayload {
  ids: string[];
  primaryKind?: RequirementPrimaryKind;
  secondaryKinds?: RequirementPrimaryKind[];
  replace?: BulkReplacePayload;
}

export interface RequirementEvent {
  id: string;
  action: "create" | "update" | "confirm" | "exclude" | "restore" | "parse";
  fromStatus: RequirementStatus | "";
  toStatus: RequirementStatus | "";
  detail: string;
  operatedBy: string;
  operatedByName: string;
  operatedAt: string;
}
