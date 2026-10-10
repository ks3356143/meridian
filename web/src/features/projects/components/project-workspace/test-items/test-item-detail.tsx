import { useEffect, useLayoutEffect, useMemo, useRef, useState, memo } from "react";
import { AlertTriangle, CheckCircle2, CloudUpload, Loader2, Pencil, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyHint } from "@/components/shared/empty-hint";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { gsap, useGSAP } from "@/lib/gsap";
import type { UpdateSubItemPayload, UpdateTestItemPayload } from "@/features/test-items/api";
import type { TestItemDetail, TestItemType, TestRoundRecord } from "@/features/test-items/types";
import type { ProjectPlatform } from "@/features/projects/types";
import { EditableCell } from "./editable-cell";
import { RequirementAccordion } from "./requirement-accordion";
import { RequirementLinkPicker } from "./requirement-link-picker";
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

function TestItemDetailPanelInner({
  detail,
  type,
  round,
  folderName,
  platform,
  projectId,
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
}: {
  detail: TestItemDetail;
  type: TestItemType | undefined;
  round: TestRoundRecord;
  folderName: string;
  platform: ProjectPlatform;
  projectId: string;
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
}) {
  const item = detail.item;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<string>(SECTION_BASIC);
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
  const syncSaveState = () => {
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
  };
  const reportPhase = (phase: "editing-start" | "editing-end" | "saving" | "saved" | "error") => {
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
  };

  // 切换测试项时在绘制前回到顶部，避免"先画新项再滚回去"造成的滚动条跳动。
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [item.id]);

  // 只动画滚动容器里的内容，不动滚动容器本身——否则滚动条跟着位移，看起来在跳。
  const contentRef = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const element = contentRef.current;
      if (!element) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        element,
        { autoAlpha: 0, y: 8 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.28,
          ease: "power2.out",
          clearProps: "transform,opacity,visibility",
        },
      );
    },
    { dependencies: [item.id], revertOnUpdate: true },
  );

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const handleScroll = () => {
      const offset = container.scrollTop + 96;
      let current: string = SECTION_BASIC;
      for (const section of SECTION_LINKS) {
        const element = document.getElementById(section.id);
        if (element && element.offsetTop <= offset) current = section.id;
      }
      setActiveSection(current);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener("scroll", handleScroll);
  }, [item.id]);

  const jumpTo = (id: string) => {
    const element = document.getElementById(id);
    if (!element) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  const patch = async (payload: UpdateTestItemPayload) => {
    reportPhase("saving");
    const startedAt = performance.now();
    try {
      await onPatch(payload);
      // 本地库保存往往几毫秒完成，给"保存中"一个最短展示时长，转圈才看得见。
      const elapsed = performance.now() - startedAt;
      if (elapsed < 420) await new Promise((resolve) => setTimeout(resolve, 420 - elapsed));
      reportPhase("saved");
    } catch (error) {
      reportPhase("error");
      throw error;
    }
  };

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

  return (
    <div className={styles.detail} ref={scrollRef}>
      <div ref={contentRef} className={styles.content}>
        <header className={styles.hero}>
          <div className={styles.heroMain}>
            <span className={styles.heroIdent}>{item.identifier}</span>
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
            <Button
              type="button"
              variant="destructive"
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
                      四项齐全，可进入执行
                    </span>
                  )}
                </>
              ) : (
                <span className={styles.muted}>静态测试项进度见静态流程</span>
              )}
            </div>
          </div>
        </header>

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
          {SECTION_LINKS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={styles.sectionLink}
              data-active={activeSection === section.id ? "true" : undefined}
              onClick={() => jumpTo(section.id)}
            >
              {section.label}
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
                    <span className={styles.typeLocked} title="静态测试项类型锁定，不可修改">
                      <span className={styles.typeText} data-tone={tone}>
                        {item.typeCode}
                        {type ? ` · ${type.name}` : ""}
                      </span>
                      <span className={styles.staticChip}>静态</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={styles.typeButton}
                      onClick={onChangeType}
                      aria-label="修改测试项类型"
                      title="修改测试项类型"
                    >
                      <span className={styles.typeText} data-tone={tone}>
                        {item.typeCode}
                        {type ? ` · ${type.name}` : ""}
                      </span>
                      <Pencil className={styles.typeEditIcon} aria-hidden />
                    </button>
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
                            <span className={styles.pendingHint}>未关联需求，完善度不计入</span>
                          ) : null}
                        </div>
                        {detail.requirements.length > 0 ? (
                          <div className={styles.linkRow}>
                            {detail.requirements.map((reference) => (
                              <span
                                key={reference.id}
                                className={styles.linkChip}
                                title={`${reference.sourceName} · §${reference.chapterNumber} ${reference.name}`}
                              >
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
                            <RequirementAccordion key={reference.id} reference={reference} />
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
                    onUpdate={onUpdateSubItem}
                    onDelete={onDeleteSubItem}
                    onDuplicate={onDuplicateSubItem}
                    onMove={onMoveSubItem}
                    onGenerateCase={onCreateCase}
                  />
                </td>
              </tr>
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
              <Progress value={passRate} className={styles.caseProgress} />
              <span className={styles.caseRateDetail}>
                通过 {passedCount} · 未通过 {failedCount} · 未执行 {pendingCount}
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
            <table className={styles.caseTable}>
              <thead>
                <tr>
                  <th scope="col">用例标识</th>
                  <th scope="col">用例名称</th>
                  <th scope="col">状态</th>
                </tr>
              </thead>
              <tbody>
                {detail.cases.map((record) => (
                  <tr key={record.id}>
                    <td className={styles.caseIdent}>{record.identifier}</td>
                    <td>{record.name}</td>
                    <td>
                      <span className={styles.caseStatus} data-status={record.status}>
                        {caseStatusLabel(record.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

/** 详情面板是重子树：工作区其余状态（树选择、弹窗、拖拽）变化时不该重渲染它。 */
export const TestItemDetailPanel = memo(TestItemDetailPanelInner);
