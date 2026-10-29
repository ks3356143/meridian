import type { RequirementBlockNode } from "@/features/requirements/types";

export interface TestItemType {
  id: string;
  code: string;
  name: string;
  category: string;
  isStatic: boolean;
  platformScope: string;
  outputOrder: number;
  defaultAdequacy: string;
  defaultPassCriteria: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TestItemFolder {
  id: string;
  projectId: string;
  roundId: string;
  typeCode: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestItemRecord {
  id: string;
  projectId: string;
  roundId: string;
  typeCode: string;
  identifier: string;
  suffix: string;
  name: string;
  priority: string;
  folderId: string | null;
  sortOrder: number;
  description: string;
  adequacy: string;
  passCriteria: string;
  implicitRequirement: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RequirementTestItemCandidate {
  requirementId: string;
  chapterNumber: string;
  name: string;
  primaryKind: string;
  mappedTypeCode: string;
  hasDescription: boolean;
  linkedTestItemCount: number;
  canCreate: boolean;
  blockReason?: string;
}

export interface RequirementTestItemPreview {
  total: number;
  creatable: number;
  linked: number;
  incomplete: number;
  requirements: RequirementTestItemCandidate[];
}

export type BatchCreateTestItemOutcome =
  | "created"
  | "skipped_existing"
  | "skipped_incomplete"
  | "skipped_not_official"
  | "failed";

export interface BatchCreateTestItemResultItem {
  requirementId: string;
  chapterNumber: string;
  name: string;
  outcome: BatchCreateTestItemOutcome;
  testItemId?: string;
  testItemIdentifier?: string;
  message?: string;
}

export interface BatchCreateTestItemsResult {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  items: BatchCreateTestItemResultItem[];
}

export interface TestSubItemRecord {
  id: string;
  testItemId: string;
  seq: number;
  name: string;
  description: string;
  /** 操作步骤（多行文本，行数与通过准则 1:1）。 */
  ops: string;
  /** 通过准则 / 预期结果（多行文本）。 */
  expected: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestCaseRecord {
  id: string;
  projectId: string;
  testItemId: string;
  identifier: string;
  seq: number;
  name: string;
  summary: string;
  initText: string;
  prerequisites: string;
  /** 终止条件（测试说明侧，切片 5b）。 */
  terminationText: string;
  /** 通过准则（测试说明侧，切片 5b）。 */
  passCriteria: string;
  designerId: string | null;
  testerId: string | null;
  monitorId: string | null;
  execDate: string | null;
  status: string;
  notes: string;
  notExecutedReason: string;
  sortOrder: number;
  /** 工作台摘要：存在按 lineage 对齐的上轮用例。 */
  previousRoundAvailable?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 步骤富文本块视图（op = 输入及操作 / act = 实测结果，切片 5b）。 */
export interface StepBlockView {
  /** 结构化文档；无块记录时为 null。 */
  doc: RequirementBlockNode | null;
  plainText: string;
  hasContent: boolean;
}

export interface PreviousRoundStep {
  currentStepId: string | null;
  previousStep: CaseStepRecord & { lineageKey: string };
  change: "unchanged" | "added" | "removed";
}

export interface PreviousRoundResult {
  currentCaseId: string;
  lineageKey: string;
  currentRound: TestRoundRecord;
  previousRound: TestRoundRecord;
  previousCase: TestCaseRecord;
  testerId: string | null;
  testerName: string;
  steps: PreviousRoundStep[];
}

export interface CaseStepRecord {
  id: string;
  testCaseId: string;
  seq: number;
  /** 预期结果（纯文本）。 */
  expectText: string;
  /** 通过状态：none 未执行 / pass 通过 / fail 未通过。 */
  passed: string;
  /** 输入及操作：富文本（文字 + 图片 + 表格）。 */
  op: StepBlockView;
  /** 实测结果：富文本（文字 + 图片 + 表格）。 */
  act: StepBlockView;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type TypeCoverageStatus = "covered" | "explained" | "missing" | "not_applicable";

export interface TypeCoverageNote {
  id: string;
  projectId: string;
  roundId: string;
  typeCode: string;
  reasonText: string;
  updatedBy: string;
  updatedByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface TypeCoverageRoundSlice {
  roundId: string;
  roundNumber: number;
  roundName: string;
  applicable: boolean;
  status: TypeCoverageStatus;
  itemCount: number;
  caseCount: number;
  passedCount: number;
  failedCount: number;
  pendingCount: number;
  passRate: number | null;
  note: TypeCoverageNote | null;
}

export interface TypeCoverageCard {
  code: string;
  name: string;
  category: string;
  isStatic: boolean;
  outputOrder: number;
  applicable: boolean;
  status: TypeCoverageStatus;
  itemCount: number;
  caseCount: number;
  passedCount: number;
  failedCount: number;
  pendingCount: number;
  passRate: number | null;
  note: TypeCoverageNote | null;
  rounds: TypeCoverageRoundSlice[];
}

export interface TypeCoverageSummary {
  applicable: number;
  covered: number;
  explained: number;
  missing: number;
  notApplicable: number;
  testItemCount: number;
  caseCount: number;
}

export interface TypeCoverageResult {
  allRounds: boolean;
  round: TestRoundRecord | null;
  rounds: TestRoundRecord[];
  summary: TypeCoverageSummary;
  types: TypeCoverageCard[];
}

export interface TraceabilityCase {
  caseId: string;
  identifier: string;
  name: string;
  status: "pending" | "passed" | "failed";
  execDate: string | null;
  testerName: string;
}

export interface TraceabilityRow {
  roundId: string;
  roundNumber: number;
  roundName: string;
  requirementId: string;
  sourceName: string;
  sourceVersion: string;
  chapterNumber: string;
  externalIdentifier: string;
  requirementName: string;
  testItemId: string;
  testItemIdentifier: string;
  testItemName: string;
  testItemTypeCode: string;
  testItemTypeName: string;
  testItemPassRate: number | null;
  case: TraceabilityCase | null;
}

export interface TraceabilitySummary {
  requirements: number;
  linkedRequirements: number;
  unlinkedRequirements: number;
  testItems: number;
  implicitItems: number;
  unlinkedItems: number;
  cases: number;
  passed: number;
  failed: number;
  pending: number;
  passRate: number | null;
}

export interface TraceabilityResult {
  allRounds: boolean;
  round: TestRoundRecord | null;
  rounds: TestRoundRecord[];
  summary: TraceabilitySummary;
  rows: TraceabilityRow[];
}
export interface TestRoundRecord {
  id: string;
  projectId: string;
  roundNumber: number;
  name: string;
  roundType: string;
  status: string;
  startedOn: string | null;
  endedOn: string | null;
  dutVersion: string;
  changeReason: string;
  reasonSummary: string;
  sourceRoundId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoundCopyCandidate {
  testItemId: string;
  identifier: string;
  name: string;
  typeCode: string;
  typeName: string;
  defaultSelected: boolean;
  passedCount: number;
  failedCount: number;
}

export interface RoundCopyPreview {
  sourceRound: TestRoundRecord;
  testItems: RoundCopyCandidate[];
}

export interface CreateRoundCopyPayload {
  sourceRoundId: string;
  testItemIds: string[];
  name?: string;
  dutVersion?: string;
  startedOn?: string;
  endedOn?: string;
  changeReason?: string;
  reasonSummary?: string;
}

export interface RoundCopyResult {
  round: TestRoundRecord;
  folderCount: number;
  testItemCount: number;
  subItemCount: number;
  caseCount: number;
  stepCount: number;
  requirementLinkCount: number;
  opBlockCount: number;
}

export interface TestItemRequirementRef {
  id: string;
  chapterNumber: string;
  name: string;
  externalIdentifier: string;
  status: string;
  sourceName: string;
  sourceVersion: string;
}

export interface TestItemCounts {
  subItemCount: number;
  requirementCount: number;
  /** 操作步骤或通过准则为空的子项数：>0 视为"测试方法未完善"。 */
  incompleteSubItemCount: number;
  /** 静态工作台进度（DC/CR 已审 / 总数；CW 文件数）。 */
  staticReviewed?: number;
  staticTotal?: number;
  staticFileCount?: number;
  /** 子项名称（树搜索按子项名匹配；无子项时为 null）。 */
  subItemNames?: string[] | null;
}

export interface TestItemsWorkspace {
  round: TestRoundRecord;
  allRounds: boolean;
  rounds: TestRoundRecord[];
  types: TestItemType[];
  folders: TestItemFolder[];
  items: TestItemRecord[];
  cases: TestCaseRecord[];
  counts: Record<string, TestItemCounts>;
}

export interface TestItemDetail {
  item: TestItemRecord;
  subItems: TestSubItemRecord[];
  requirements: TestItemRequirementRef[];
  cases: TestCaseRecord[];
}

/** 测试项内查找命中：case = 用例字段，step = 步骤字段。 */
export interface TestCaseSearchHit {
  kind: "case" | "step";
  caseId: string;
  caseIdentifier: string;
  caseName: string;
  field: string;
  snippet: string;
  stepId?: string;
  stepSeq?: number;
}

export type TestItemPriority = "高" | "中" | "低";
export type TestCaseStatus = "pending" | "passed" | "failed";

/** 静态测试：DC/SA/CR/CW 专属工作台。 */
export interface StaticDocument {
  id: string;
  name: string;
  version: string;
  category: string;
  seq: number;
}

export interface StaticCheckTemplate {
  category: string;
  title: string;
  requirement: string;
  basis: string;
  practice: string;
}

export interface StaticSheetTemplate {
  code: string;
  kind: string;
  name: string;
  language?: string;
  checks: StaticCheckTemplate[];
}

export interface StaticReviewCheck {
  id: string;
  seq: number;
  category: string;
  title: string;
  requirement: string;
  basis: string;
  practice: string;
  result: "unreviewed" | "passed" | "failed";
  notes: string;
}

export interface StaticReviewSheet {
  id: string;
  templateCode: string;
  name: string;
  targetDocumentName: string;
  targetDocumentVersion: string;
  checks: StaticReviewCheck[];
}

export interface StaticMetrics {
  softwareName: string;
  softwareVersion: string;
  softwareScale: number | null;
  codeLines: number | null;
  commentLines: number | null;
  blankLines: number | null;
  moduleCount: number | null;
  averageSize: number | null;
  averageFanout: number | null;
  averageComplexity: number | null;
  maxComplexity: number | null;
  highComplexityRatio: number | null;
  commentRatio: number | null;
}

export interface StaticRuleViolation {
  ruleCode: string;
  reason: string;
  location: string;
}

export interface StaticAnalysisCheck {
  id: string;
  form: "C3" | "C4";
  seq: number;
  requirement: string;
  hasIssue: boolean;
  problem: string;
  location: string;
  issueId: string;
}

export interface StaticReviewTarget {
  id: string;
  language: string;
  sheetCode: string;
  name: string;
  checks: StaticReviewCheck[];
}

export interface StaticCodeFile {
  id: string;
  name: string;
  lines: number | null;
}

export interface StaticState {
  documents: StaticDocument[];
  reviewSheets: StaticReviewSheet[];
  metrics: StaticMetrics;
  metricConclusion: string;
  ruleViolations: StaticRuleViolation[];
  analysisChecks: StaticAnalysisCheck[];
  c3Conclusion: string;
  c4Conclusion: string;
  reviewTargets: StaticReviewTarget[];
  codeFiles: StaticCodeFile[];
}

export interface StaticRule {
  code: string;
  description: string;
}

export interface StaticRuleGroup {
  code: string;
  name: string;
  rules: StaticRule[];
}

export interface StaticAnalysisRequirement {
  seq: number;
  requirement: string;
}

export interface StaticCatalog {
  documentOptions: string[];
  reviewSheets: StaticSheetTemplate[];
  ruleGroups: StaticRuleGroup[];
  analysisChecks: Record<"C3" | "C4", StaticAnalysisRequirement[]>;
}

export interface StaticWorkbench {
  testItemId: string;
  kind: "DC" | "SA" | "CR" | "CW";
  version: number;
  state: StaticState;
  catalog: StaticCatalog;
  updatedAt: string;
}
