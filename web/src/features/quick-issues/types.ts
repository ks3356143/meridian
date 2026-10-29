export interface QuickIssueNote {
  id: string;
  projectId: string;
  roundId: string;
  testCaseId: string;
  testCaseStepId: string | null;
  noteText: string;
  screenshotAssetId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  stepSeq: number | null;
  createdByName: string;
  canEdit: boolean;
}

export interface CreateQuickIssuePayload {
  testCaseStepId?: string;
  noteText: string;
  screenshotAssetId?: string;
}

export interface UpdateQuickIssuePayload {
  noteText?: string;
  screenshotAssetId?: string;
  clearScreenshot?: boolean;
}
