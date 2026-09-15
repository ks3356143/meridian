export type RequirementPrimaryKind =
  | "functional"
  | "performance"
  | "interface"
  | "safety"
  | "reliability"
  | "other";

export type RequirementStatus = "candidate" | "official" | "excluded" | "superseded";
export type RequirementOrigin = "manual" | "parsed";

export interface RequirementSource {
  id: string;
  objectName: string;
  version: string;
  fileType: string;
  originalName: string;
  hasLocalFile: boolean;
  parseState: "ready" | "convert" | "manual" | "register";
  updatedAt: string;
}

export interface RequirementSection {
  id: string;
  parentId: string;
  sourceVersionId: string;
  chapterNumber: string;
  title: string;
  origin: RequirementOrigin;
  sourceAnchor: string;
  createdAt: string;
  updatedAt: string;
}

export interface SoftwareRequirement {
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
  sourceAnchor: string;
  status: RequirementStatus;
  testItemTaskStatus: "none" | "pending" | "completed";
  createdAt: string;
  updatedAt: string;
}

export interface RequirementsWorkbench {
  sources: RequirementSource[];
  sections: RequirementSection[];
  requirements: SoftwareRequirement[];
}

export interface RequirementParseResult {
  sectionCount: number;
  candidateCount: number;
  officialMatchCount: number;
  excludedMatchCount: number;
}

export interface RequirementBulkCreatePayload {
  sourceVersionId: string;
  items: Array<{
    nodeType: "section" | "requirement";
    chapterNumber: string;
    title?: string;
    name?: string;
    description?: string;
    primaryKind?: RequirementPrimaryKind;
  }>;
}
