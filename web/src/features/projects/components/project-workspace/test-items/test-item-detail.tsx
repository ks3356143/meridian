import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Info,
  Check,
  CheckCircle2,
  CloudUpload,
  CopyPlus,
  Crosshair,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyHint } from "@/components/shared/empty-hint";
import { SpotlightSurface } from "@/components/shared/spotlight-surface";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePanelSwitchMotion } from "./use-panel-switch-motion";
import type {
  BatchAssignCasesPayload,
  UpdateSubItemPayload,
  UpdateTestItemPayload,
} from "@/features/test-items/api";
import type {
  TestCaseSearchHit,
  TestItemDetail,
  TestItemType,
  TestRoundRecord,
} from "@/features/test-items/types";
import type { ProjectPlatform } from "@/features/projects/types";
import type { ProjectMember } from "../../../types";
import { CaseBatchBar } from "./case-batch-bar";
import { CaseSearch } from "./case-search";
import { EditableCell } from "./editable-cell";
import { RequirementAccordion } from "./requirement-accordion";
import { RequirementLinkPicker } from "./requirement-link-picker";
import { StaticWorkbenchSection } from "./static-workbench";
import { SubItemCards } from "./sub-item-cards";
import { caseStatusLabel, categoryTone } from "./test-items-design";
import styles from "./test-item-detail.module.css";

const SECTION_BASIC = "ti-section-basic";
const SECTION_METHOD = "ti-section-method";
const SECTION_CASES = "ti-section-cases";

const SECTION_LINKS = [
  { id: SECTION_BASIC, label: "基本信息" },
  { id: SECTION_METHOD, label: "测试方法" },
  { id: SECTION_CASES, label: "用例概况" },
] as const;

const PRIORITIES = ["高", "中", "低"];
type CaseFilter = "all" | "passed" | "failed" | "pending";

const CASE_FILTERS: { value: CaseFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "pending", label: "待执行" },
  { value: "passed", label: "已通过" },
  { value: "failed", label: "未通过" },
];

function TestItemDetailPanelInner({
  detail,
  type,
  round,
  folderName,
  platform,
  projectId,
  members,
  onPatch,
  onLink,
  onUnlink,
  onChangeType,
  onCreateSubItem,
  onUpdateSubItem,
  onDeleteSubItem,
  onDuplicateSubItem,
  onMoveSubItem,
  onCreateCase,
  onRequestDelete,
  activeCaseId,
  onSelectCase,
  onDuplicateCase,
  onBatchAssign,
  onOpenSearchHit,
}: {
  detail: TestItemDetail;
  type: TestItemType | undefined;
  round: TestRoundRecord;
  folderName: string;
  platform: ProjectPlatform;
  projectId: string;
  members: ProjectMember[];
  onPatch: (payload: UpdateTestItemPayload) => Promise<unknown>;
  onLink: (requirementId: string) => Promise<unknown>;
  onUnlink: (requirementId: string) => Promise<unknown>;
  onChangeType: () => void;
  onCreateSubItem: (name: string) => Promise<unknown>;
  onUpdateSubItem: (id: string, payload: UpdateSubItemPayload) => Promise<unknown>;
  onDeleteSubItem: (id: string) => Promise<unknown>;
  onDuplicateSubItem: (id: string) => Promise<unknown>;
  onMoveSubItem: (id: string, targetIndex: number) => Promise<unknown>;
  onCreateCase: (name: string) => Promise<unknown>;
  onRequestDelete: () => void;
  /** 树里当前选中的用例 id：详情用例行据此高亮，点击行可回定位到树。 */
  activeCaseId?: string;
  onSelectCase?: (caseId: string) => void;
  onDuplicateCase?: (caseId: string) => void;
  onBatchAssign?: (
    caseIds: string[],
    payload: Omit<BatchAssignCasesPayload, "caseIds">,
  ) => Promise<unknown>;
  onOpenSearchHit?: (hit: TestCaseSearchHit) => void;
}) {
  const item = detail.item;
  const scrollRef = useRef<HTMLDivElement>(null);
  const jumpSpyLockRef = useRef(false);
  const [activeSection, setActiveSection] = useState<string>(SECTION_BASIC);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [batchPending, setBatchPending] = useState(false);
  const [caseFilter, setCaseFilter] = useState<CaseFilter>("all");
  const isStatic = type?.isStatic ?? false;

  // 保存状态芯片（对齐需求详情的即时编辑口径）：待自动保存 / 保存中 / 已自动保存 / 保存失败。
  type SaveState = "saved" | "editing" | "saving" | "error";
  const [saveStateFor, setSaveStateFor] = useState<{ id: string; state: SaveState }>({
    id: "",
    state: "saved",
  });
  const saveState: SaveState = saveStateFor.id === item.id ? saveStateFor.state : "saved";
  const [saveChipKey, setSaveChipKey] = useState(0);
  const editingCountRef = useRef(0);
  const savingCountRef = useRef(0);
  const failedRef = useRef(false);
  // 保存状态按测试项 id 记录：切换测试项时旧状态自然失效，不需要额外 effect 重置。
  const syncSaveState = useCallback(() => {
    setSaveStateFor({
      id: item.id,
      state:
        savingCountRef.current > 0
          ? "saving"
          : editingCountRef.current > 0
            ? "editing"
            : failedRef.current
              ? "error"
              : "saved",
    });
  }, [item.id]);
  const reportPhase = useCallback(
    (phase: "editing-start" | "editing-end" | "saving" | "saved" | "error") => {
      if (phase === "editing-start") editingCountRef.current += 1;
      else if (phase === "editing-end")
        editingCountRef.current = Math.max(0, editingCountRef.current - 1);
      else if (phase === "saving") savingCountRef.current += 1;
      else if (phase === "saved") {
        savingCountRef.current = Math.max(0, savingCountRef.current - 1);
        failedRef.current = false;
        setSaveChipKey((current) => current + 1);
      } else if (phase === "error") {
        savingCountRef.current = Math.max(0, savingCountRef.current - 1);
        failedRef.current = true;
      }
      syncSaveState();
    },
    [syncSaveState],
  );

  // 切换测试项时在绘制前回到顶部，避免"先画新项再滚回去"造成的滚动条跳动。
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [item.id]);

  // 只动画滚动容器里的内容，不动滚动容器本身——否则滚动条跟着位移，看起来在跳。
  const contentRef = useRef<HTMLDivElement>(null);
  usePanelSwitchMotion(contentRef, item.id);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const handleScroll = () => {
      // 点击分区后亮住不动，直到用户自己滚动/按键才交还位置推断。
      if (jumpSpyLockRef.current) return;
      const offset = container.scrollTop + 96;
      let current: string = SECTION_BASIC;
      for (const section of SECTION_LINKS) {
        const element = document.getElementById(section.id);
        if (element && element.offsetTop <= offset) current = section.id;
      }
      setActiveSection(current);
    };
    const releaseJumpLock = () => {
      jumpSpyLockRef.current = false;
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    // 只认用户自己的滚轮/触摸/按键：程序化 smooth 滚动期间保持"点谁亮谁"。
    container.addEventListener("wheel", releaseJumpLock, { passive: true });
    container.addEventListener("touchstart", releaseJumpLock, { passive: true });
    container.addEventListener("keydown", releaseJumpLock);
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
      container.removeEventListener("wheel", releaseJumpLock);
      container.removeEventListener("touchstart", releaseJumpLock);
      container.removeEventListener("keydown", releaseJumpLock);
      jumpSpyLockRef.current = false;
    };
  }, [item.id]);

  const jumpTo = (id: string) => {
    const element = document.getElementById(id);
    if (!element) return;
    setActiveSection(id);
    jumpSpyLockRef.current = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  // 保存动作统一出口：上报 saving/saved/error，并给"保存中"一个最短展示时长（本地库几毫秒完成，转圈才看得见）。
  const withSavePhase = async <T,>(action: () => Promise<T>): Promise<T> => {
    reportPhase("saving");
    const startedAt = performance.now();
    try {
      const result = await action();
      const elapsed = performance.now() - startedAt;
      if (elapsed < 420) await new Promise((resolve) => setTimeout(resolve, 420 - elapsed));
      reportPhase("saved");
      return result;
    } catch (error) {
      reportPhase("error");
      throw error;
    }
  };

  const patch = (payload: UpdateTestItemPayload) => withSavePhase(() => onPatch(payload));
  // 子项字段编辑走同一保存相位：否则芯片从「待自动保存」直接跳「已自动保存」，没有转圈（2026-10-12 用户反馈）。
  const patchSubItem = (id: string, payload: UpdateSubItemPayload) =>
    withSavePhase(() => onUpdateSubItem(id, payload));

  const tracked = detail.requirements.length > 0 || item.implicitRequirement;
  // 测试方法完善口径：至少 1 个子项，且每个子项的操作步骤与通过准则都已填写（老项目逐栏口径）。
  const methodOk = useMemo(
    () =>
      detail.subItems.length > 0 &&
      detail.subItems.every((sub) => sub.ops.trim() !== "" && sub.expected.trim() !== ""),
    [detail.subItems],
  );
  const completeness = useMemo(() => {
    if (isStatic) return null;
    const checks = [
      { label: "追踪关系", ok: tracked },
      { label: "测试方法", ok: methodOk },
      { label: "充分性要求", ok: item.adequacy.trim() !== "" },
    ];
    if (platform === "FPGA")
      checks.push({ label: "测试项描述", ok: item.description.trim() !== "" });
    return {
      done: checks.filter((check) => check.ok).length,
      total: checks.length,
      missing: checks.filter((check) => !check.ok).map((check) => check.label),
    };
  }, [isStatic, item.adequacy, item.description, methodOk, platform, tracked]);

  const passedCount = detail.cases.filter((record) => record.status === "passed").length;
  const failedCount = detail.cases.filter((record) => record.status === "failed").length;
  const pendingCount = detail.cases.length - passedCount - failedCount;
  const passRate =
    detail.cases.length === 0 ? 0 : Math.round((passedCount / detail.cases.length) * 100);
  const tone = type ? categoryTone(type.category) : "green";
  const complete = completeness !== null && completeness.done === completeness.total;
  const selectedCaseSet = new Set(selectedCaseIds);
  const visibleCases =
    caseFilter === "all"
      ? detail.cases
      : detail.cases.filter((record) => record.status === caseFilter);
  const allCasesSelected =
    visibleCases.length > 0 && visibleCases.every((record) => selectedCaseSet.has(record.id));
  const someCasesSelected = selectedCaseIds.length > 0 && !allCasesSelected;
  const toggleAllCases = (checked: boolean | "indeterminate") => {
    setSelectedCaseIds(checked === true ? visibleCases.map((record) => record.id) : []);
  };
  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, member.displayName])),
    [members],
  );
  const toggleCase = (caseId: string, checked: boolean | "indeterminate") => {
    setSelectedCaseIds((current) =>
      checked === true ? [...new Set([...current, caseId])] : current.filter((id) => id !== caseId),
    );
  };
  const applyBatchAssign = async (payload: Omit<BatchAssignCasesPayload, "caseIds">) => {
    if (!onBatchAssign || selectedCaseIds.length === 0) return;
    setBatchPending(true);
    try {
      await onBatchAssign(selectedCaseIds, payload);
      setSelectedCaseIds([]);
    } finally {
      setBatchPending(false);
    }
  };

  const sectionSteps = SECTION_LINKS.map((section, index) => {
    const count =
      section.id === SECTION_METHOD
        ? detail.subItems.length
        : section.id === SECTION_CASES
          ? detail.cases.length
          : null;
    const done =
      section.id === SECTION_BASIC
        ? item.name.trim() !== ""
        : section.id === SECTION_METHOD
          ? methodOk
          : detail.cases.length > 0;
    const unit =
      section.id === SECTION_METHOD ? "个子项" : section.id === SECTION_CASES ? "条用例" : "";
    return { ...section, step: index + 1, count, done, unit };
  });
  return (
    <div className={styles.detail} ref={scrollRef}>
      <div ref={contentRef} className={styles.content}>
        <SpotlightSurface as="header" className={styles.hero}>
          <div className={styles.heroMain}>
            <div className={styles.heroMetaLine}>
              <span className={styles.heroKind}>TEST ITEM</span>
              <span className={styles.heroIdent}>{item.identifier}</span>
            </div>
            <div className={styles.heroTitleRow}>
              <span className={styles.titleBar} data-tone={tone} aria-hidden />
              <h2 className={styles.heroTitle}>{item.name}</h2>
            </div>
            <div className={styles.heroTags}>
              <Badge variant="primary" className={styles.typeBadge} data-tone={tone}>
                {type ? `${type.code} ${type.name}` : item.typeCode}
              </Badge>
              <Badge
                variant="outline"
                className={styles.priorityBadge}
                data-priority={item.priority}
              >
                {item.priority}
              </Badge>
              {folderName ? <span className={styles.heroTag}>文件夹：{folderName}</span> : null}
              <span className={styles.heroTag}>{round.name}</span>
            </div>
          </div>
          <div className={styles.heroSide}>
            <CaseSearch testItemId={item.id} onOpenHit={(hit) => onOpenSearchHit?.(hit)} />
            <Button
              type="button"
              variant="outline"
              size="xs"
              className={styles.deleteButton}
              onClick={onRequestDelete}
            >
              <Trash2 aria-hidden />
              删除
            </Button>
            <div
              className={styles.heroCompleteness}
              data-state={completeness === null ? "static" : complete ? "done" : "incomplete"}
            >
              {completeness ? (
                <>
                  <div className={styles.completenessTop}>
                    <span>{complete ? "已完善" : "未完善"}</span>
                    <strong>
                      {completeness.done}/{completeness.total}
                    </strong>
                  </div>
                  <Progress
                    value={Math.round((completeness.done / Math.max(completeness.total, 1)) * 100)}
                    className={styles.completenessBar}
                    data-tone={complete ? "full" : "warn"}
                  />
                  {item.implicitRequirement ? (
                    <span className={styles.implicitNote}>
                      <span className={styles.btnDot} data-tone="amber" aria-hidden />
                      按隐含需求处理（无关联需求）
                    </span>
                  ) : completeness.missing.length > 0 ? (
                    <div className={styles.missingChips}>
                      {completeness.missing.map((label) => (
                        <span key={label} className={styles.missingChip}>
                          <AlertTriangle aria-hidden />缺 {label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className={styles.completenessDone}>
                      <CheckCircle2 aria-hidden />
                      全部齐全，可进入执行
                    </span>
                  )}
                </>
              ) : (
                <span className={styles.staticNote}>
                  <Info aria-hidden />
                  静态测试项进度见静态流程
                </span>
              )}
            </div>
          </div>
        </SpotlightSurface>

        <nav className={styles.sectionNav} aria-label="测试项分区导航">
          <span
            key={saveChipKey}
            className={styles.statusChip}
            data-save-state={saveState}
            aria-live="polite"
          >
            {saveState === "saving" ? (
              <>
                <Loader2 aria-hidden />
                保存中
              </>
            ) : saveState === "error" ? (
              "保存失败"
            ) : saveState === "editing" ? (
              <>
                <CloudUpload aria-hidden />
                待自动保存
              </>
            ) : (
              <>
                <CheckCircle2 aria-hidden />
                已自动保存
              </>
            )}
          </span>
          {sectionSteps.map((section) => (
            <button
              key={section.id}
              type="button"
              className={styles.sectionLink}
              data-active={activeSection === section.id ? "true" : undefined}
              data-state={
                activeSection === section.id ? "active" : section.done ? "done" : "pending"
              }
              aria-current={activeSection === section.id ? "location" : undefined}
              aria-label={`第 ${section.step} 步 ${section.label}，${section.done ? "已完成" : "未完成"}${section.count !== null && section.count > 0 ? `，${section.count} ${section.unit}` : ""}`}
              onClick={() => jumpTo(section.id)}
            >
              <span
                className={styles.sectionStep}
                data-done={section.done ? "true" : undefined}
                aria-hidden
              >
                {section.done ? <Check aria-hidden /> : section.step}
              </span>
              {section.label}
              {section.count !== null && section.count > 0 ? (
                <span
                  className={styles.sectionCount}
                  title={`${section.count} ${section.unit}`}
                  aria-hidden
                >
                  {section.count}
                  <span className={styles.sectionCountUnit}>{section.unit}</span>
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className={styles.tableWrap}>
          <table className={styles.itemTable}>
            <tbody>
              <tr id={SECTION_BASIC}>
                <th scope="row">测试项名称</th>
                <td>
                  <EditableCell
                    value={item.name}
                    label="测试项名称"
                    missing={item.name.trim() === ""}
                    onSave={(next) => patch({ name: next })}
                    onPhase={reportPhase}
                  />
                </td>
                <th scope="row">测试项标识</th>
                <td>
                  <div className={styles.identCell}>
                    <span className={styles.identPrefix}>{`XQ_${item.typeCode}_`}</span>
                    <EditableCell
                      value={item.suffix}
                      label="测试项标识后缀"
                      className={styles.identEditor}
                      onSave={(next) => patch({ suffix: next })}
                      onPhase={reportPhase}
                    />
                  </div>
                </td>
              </tr>
              <tr>
                <th scope="row">优先级</th>
                <td>
                  <Select
                    value={item.priority}
                    onValueChange={(value) => void patch({ priority: value })}
                  >
                    <SelectTrigger
                      size="sm"
                      className={styles.prioritySelect}
                      data-priority={item.priority}
                      aria-label="优先级"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priority}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <th scope="row">类型</th>
                <td>
                  {/* 静态四类（DC/SA/CR/CW）每轮各一个固定槽位，类型锁定：不渲染成可点按钮。 */}
                  {isStatic ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={styles.typeLocked}>
                          <span className={styles.typeText} data-tone={tone}>
                            {item.typeCode}
                            {type ? ` · ${type.name}` : ""}
                          </span>
                          <span className={styles.staticChip}>静态</span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">静态测试项类型锁定，不可修改</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={styles.typeButton}
                          onClick={onChangeType}
                          aria-label="修改测试项类型"
                        >
                          <span className={styles.typeText} data-tone={tone}>
                            {item.typeCode}
                            {type ? ` · ${type.name}` : ""}
                          </span>
                          <Pencil className={styles.typeEditIcon} aria-hidden />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">修改测试项类型</TooltipContent>
                    </Tooltip>
                  )}
                </td>
              </tr>

              {isStatic ? null : (
                <>
                  <tr data-pending={!tracked ? "true" : undefined}>
                    <th scope="row">追踪关系</th>
                    <td colSpan={3}>
                      <div className={styles.linkArea}>
                        {/* 操作按钮在上、需求 chip 在下：先动作、后结果。 */}
                        <div className={styles.linkActions}>
                          <RequirementLinkPicker
                            projectId={projectId}
                            linkedIds={detail.requirements.map((reference) => reference.id)}
                            disabled={item.implicitRequirement}
                            onPick={onLink}
                          />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {/* 隐含需求 = 没有可关联的需求、用户自己补的项：已关联需求时不允许标记。 */}
                              <Button
                                type="button"
                                variant={item.implicitRequirement ? "secondary" : "outline"}
                                size="xs"
                                className={styles.implicitButton}
                                data-active={item.implicitRequirement ? "true" : undefined}
                                aria-pressed={item.implicitRequirement}
                                disabled={
                                  detail.requirements.length > 0 && !item.implicitRequirement
                                }
                                onClick={() =>
                                  void patch({ implicitRequirement: !item.implicitRequirement })
                                }
                              >
                                <span className={styles.btnDot} data-tone="amber" aria-hidden />
                                隐含需求
                              </Button>
                            </TooltipTrigger>
                            {detail.requirements.length > 0 && !item.implicitRequirement ? (
                              <TooltipContent side="top">
                                已关联需求，不能标记为隐含需求；先解除关联再标记
                              </TooltipContent>
                            ) : null}
                          </Tooltip>
                          {item.implicitRequirement ? (
                            <span className={styles.implicitTag}>
                              <span className={styles.btnDot} data-tone="amber" aria-hidden />
                              按隐含需求处理
                            </span>
                          ) : null}
                          {!tracked ? (
                            <span className={styles.pendingHint}>未关联需求，按未完善处理</span>
                          ) : null}
                        </div>
                        {detail.requirements.length > 0 ? (
                          <div className={styles.linkRow}>
                            {detail.requirements.map((reference) => (
                              <span key={reference.id} className={styles.linkChip}>
                                {reference.sourceName ? (
                                  <span className={styles.linkSource}>{reference.sourceName}</span>
                                ) : null}
                                <span className={styles.linkChapter}>
                                  §{reference.chapterNumber}
                                </span>
                                <TruncatedText
                                  value={reference.name}
                                  className={styles.linkName}
                                  tooltipValue={reference.name}
                                />
                                <button
                                  type="button"
                                  className={styles.unlinkButton}
                                  aria-label={`解除关联 §${reference.chapterNumber} ${reference.name}`}
                                  onClick={() => void onUnlink(reference.id)}
                                >
                                  <X aria-hidden />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">需求描述</th>
                    <td colSpan={3}>
                      {detail.requirements.length === 0 ? (
                        <EmptyHint tone="muted">
                          {item.implicitRequirement
                            ? "本项按隐含需求处理，无需关联需求"
                            : "未关联需求；可在上方「追踪关系」关联需求，或标记为隐含需求"}
                        </EmptyHint>
                      ) : (
                        <div className={styles.requirementList}>
                          {detail.requirements.map((reference) => (
                            <RequirementAccordion
                              key={reference.id}
                              reference={reference}
                              projectCode={projectId}
                            />
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                </>
              )}

              <tr>
                <th scope="row">测试项描述</th>
                <td colSpan={3}>
                  <EditableCell
                    value={item.description}
                    label="测试项描述"
                    multiline
                    placeholder={
                      platform === "FPGA" ? "点击填写测试项描述" : "描述见各子项卡片（可留空）"
                    }
                    onSave={(next) => patch({ description: next })}
                    onPhase={reportPhase}
                  />
                </td>
              </tr>
              <tr
                id={SECTION_METHOD}
                data-pending={!isStatic && detail.subItems.length === 0 ? "true" : undefined}
              >
                <th scope="row">测试方法</th>
                <td colSpan={3}>
                  <SubItemCards
                    itemIdentifier={item.identifier}
                    subItems={detail.subItems}
                    onCreate={onCreateSubItem}
                    onUpdate={patchSubItem}
                    onDelete={onDeleteSubItem}
                    onDuplicate={onDuplicateSubItem}
                    onMove={onMoveSubItem}
                    onGenerateCase={onCreateCase}
                    onPhase={reportPhase}
                  />
                </td>
              </tr>
              {isStatic ? (
                <tr>
                  <th scope="row">静态测试</th>
                  <td colSpan={3}>
                    <StaticWorkbenchSection
                      testItemId={item.id}
                      kind={item.typeCode}
                      platform={platform}
                    />
                  </td>
                </tr>
              ) : null}
              <tr data-pending={!isStatic && item.adequacy.trim() === "" ? "true" : undefined}>
                <th scope="row">充分性要求</th>
                <td colSpan={3}>
                  <EditableCell
                    value={item.adequacy}
                    label="充分性要求"
                    multiline
                    missing={item.adequacy.trim() === ""}
                    onSave={(next) => patch({ adequacy: next })}
                    onPhase={reportPhase}
                  />
                </td>
              </tr>
              <tr>
                <th scope="row">通过准则</th>
                <td colSpan={3}>
                  <EditableCell
                    value={item.passCriteria}
                    label="通过准则"
                    multiline
                    missing={item.passCriteria.trim() === ""}
                    onSave={(next) => patch({ passCriteria: next })}
                    onPhase={reportPhase}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <section className={styles.caseCard} id={SECTION_CASES}>
          <header className={styles.caseHeader}>
            <h3 className={styles.caseTitle}>
              <span className={styles.titleBar} data-tone={tone} aria-hidden />
              用例概况（{detail.cases.length}）
            </h3>
            <div className={styles.caseRate}>
              <span
                className={styles.caseRateValue}
                data-tone={passRate >= 100 ? "green" : undefined}
              >
                通过率 {passRate}%
              </span>
              <Progress
                value={passRate}
                className={styles.caseProgress}
                data-tone={passRate === 0 ? "empty" : passRate >= 100 ? "full" : "part"}
              />
              <span className={styles.caseRateDetail}>
                <span className={styles.rateItem} data-tone="passed">
                  通过 {passedCount}
                </span>
                <span className={styles.rateItem} data-tone="failed">
                  未通过 {failedCount}
                </span>
                <span className={styles.rateItem} data-tone="pending">
                  未执行 {pendingCount}
                </span>
              </span>
            </div>
          </header>
          {detail.cases.length === 0 ? (
            <EmptyHint
              tone="info"
              action={
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => jumpTo(SECTION_METHOD)}
                >
                  去填写测试方法
                </Button>
              }
            >
              尚无用例；到上方「测试方法」子项卡片点「生成用例」即可 1:1 生成。
            </EmptyHint>
          ) : (
            <>
              <div className={styles.caseFilters} role="group" aria-label="按用例状态筛选">
                {CASE_FILTERS.map((filter) => {
                  const count =
                    filter.value === "all"
                      ? detail.cases.length
                      : filter.value === "passed"
                        ? passedCount
                        : filter.value === "failed"
                          ? failedCount
                          : pendingCount;
                  return (
                    <button
                      key={filter.value}
                      type="button"
                      className={styles.caseFilterChip}
                      data-active={caseFilter === filter.value ? "true" : undefined}
                      aria-pressed={caseFilter === filter.value}
                      onClick={() => setCaseFilter(filter.value)}
                    >
                      {filter.label}
                      <span className={styles.caseFilterCount}>{count}</span>
                    </button>
                  );
                })}
              </div>{" "}
              <CaseBatchBar
                selectedCount={selectedCaseIds.length}
                members={members}
                pending={batchPending}
                onApply={applyBatchAssign}
                onClearSelection={() => setSelectedCaseIds([])}
              />
              <table className={styles.caseTable}>
                <thead>
                  <tr>
                    <th scope="col" className={styles.caseSelectHead}>
                      <Checkbox
                        checked={
                          allCasesSelected ? true : someCasesSelected ? "indeterminate" : false
                        }
                        aria-label="全选用例"
                        onCheckedChange={toggleAllCases}
                      />
                    </th>
                    <th scope="col">用例标识</th>
                    <th scope="col">用例名称</th>
                    <th scope="col">负责人</th>
                    <th scope="col">状态</th>
                    <th scope="col">
                      <span className={styles.visuallyHidden}>操作</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCases.map((record) => (
                    <tr
                      key={record.id}
                      data-status={record.status}
                      data-active={record.id === activeCaseId ? "true" : undefined}
                    >
                      <td className={styles.caseSelectCell}>
                        <Checkbox
                          checked={selectedCaseSet.has(record.id)}
                          aria-label={`选择 ${record.identifier}`}
                          onCheckedChange={(checked) => toggleCase(record.id, checked)}
                        />
                      </td>
                      <td className={styles.caseIdent}>{record.identifier}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.caseRowName}
                          onClick={() => onSelectCase?.(record.id)}
                        >
                          {record.name}
                        </button>
                      </td>
                      <td className={styles.caseOwner}>
                        {memberNames.get(record.testerId ?? record.designerId ?? "") ?? "未指派"}
                      </td>
                      <td>
                        <span className={styles.caseStatus} data-status={record.status}>
                          {caseStatusLabel(record.status)}
                        </span>
                      </td>
                      <td className={styles.caseRowActions} aria-label="用例操作">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={styles.caseRowAction}
                              aria-label={`在目录中定位 ${record.identifier}`}
                              onClick={() => onSelectCase?.(record.id)}
                            >
                              <Crosshair aria-hidden />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">在左侧目录中定位</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={styles.caseRowAction}
                              aria-label={`复制 ${record.identifier}`}
                              onClick={() => onDuplicateCase?.(record.id)}
                            >
                              <CopyPlus aria-hidden />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">复制用例（含步骤）</TooltipContent>
                        </Tooltip>
                      </td>
                    </tr>
                  ))}
                  {visibleCases.length === 0 ? (
                    <tr>
                      <td className={styles.caseEmptyRow} colSpan={6}>
                        该状态下没有用例，切换筛选或到「测试方法」生成用例。
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/** 详情面板是重子树：工作区其余状态（树选择、弹窗、拖拽）变化时不该重渲染它。 */
export const TestItemDetailPanel = memo(TestItemDetailPanelInner);
