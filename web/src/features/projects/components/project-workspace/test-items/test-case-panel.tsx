import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SpotlightSurface } from "@/components/shared/spotlight-surface";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TruncatedText } from "@/components/shared/truncated-text";
import type { UpdateCasePayload } from "@/features/test-items/api";
import type {
  TestCaseRecord,
  TestItemRecord,
  TestItemRequirementRef,
} from "@/features/test-items/types";
import { usePanelSwitchMotion } from "./use-panel-switch-motion";
import type { ProjectMember } from "../../../types";
import { CaseStepsSection } from "./case-steps-section";
import { EditableCell, type EditableCellHandle } from "./editable-cell";
import { PersonPicker } from "./person-picker";
import { PreviousRoundResultSection } from "./previous-round-result-section";
import { SummaryBackfillPicker } from "./summary-backfill-picker";
import { TestCaseShortcutsDialog } from "./test-case-shortcuts-dialog";
import { caseStatusLabel } from "./test-items-design";
import { useCellUndo } from "./use-cell-undo";
import styles from "./test-case-panel.module.css";

/** 可撤销的用例文本字段（HTML 值都是字符串）。 */
type CaseTextField =
  | "name"
  | "summary"
  | "initText"
  | "prerequisites"
  | "terminationText"
  | "passCriteria";

function formatExecDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function TestCasePanelInner({
  item,
  caseRecord,
  requirements,
  members,
  projectCode,
  siblingCases,
  onSelectSibling,
  onBack,
  onPatchCase,
  onCaseChanged,
  focusStep,
}: {
  /** 所属测试项（Hero 里显示，返回按钮也回到它）。 */
  item: TestItemRecord;
  caseRecord: TestCaseRecord;
  /** 追踪关系继承所属测试项；null = 不显示本行（详情未就绪或静态测试项）。 */
  requirements: TestItemRequirementRef[] | null;
  /** 项目成员：人员栏位只读显示姓名。 */
  members: ProjectMember[];
  /** 项目业务标识（RXXXXX）：富文本图片的附件上传与读取按项目隔离。 */
  projectCode: string;
  /** 同测试项内的兄弟用例：Ctrl+←/→ 按列表顺序切换。 */
  siblingCases: TestCaseRecord[];
  onSelectSibling: (caseId: string) => void;
  onBack: () => void;
  onPatchCase: (payload: UpdateCasePayload) => Promise<unknown>;
  onCaseChanged: () => void;
  focusStep?: { stepId: string; nonce: number } | null;
}) {
  // 综述「从描述回填」按钮：走同一条保存链路（保存脉冲、Ctrl+Z 撤销同源）。
  const summaryCellRef = useRef<EditableCellHandle>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { recordChange } = useCellUndo();
  const currentCaseIndex = siblingCases.findIndex((record) => record.id === caseRecord.id);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);
  const previousCase = currentCaseIndex > 0 ? siblingCases[currentCaseIndex - 1] : undefined;
  const nextCase =
    currentCaseIndex >= 0 && currentCaseIndex < siblingCases.length - 1
      ? siblingCases[currentCaseIndex + 1]
      : undefined;
  const canSwitchCase = siblingCases.length > 1 && currentCaseIndex >= 0;

  // 切用例时内容入场，口径与测试项详情一致：只动画内容，不动滚动容器本体。
  const bodyRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // 切用例时在绘制前回到顶部，避免"先画新用例再滚回去"的跳动（测试项详情同口径）。
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [caseRecord.id]);
  usePanelSwitchMotion(bodyRef, caseRecord.id);

  /** 字段保存 + 记入撤销栈：撤销 = 用旧值再走一次同一条保存链路。 */
  const saveField = (label: string, field: CaseTextField, next: string) => {
    // 名称是必填（树上缺失徽章同源）：清空不落库，就地提示并保持红色脉冲。
    if (field === "name" && next.trim() === "") {
      toast.error("用例名称不能为空");
      return Promise.reject(new Error("用例名称为空"));
    }
    const previous = caseRecord[field];
    return onPatchCase({ [field]: next }).then(() => {
      if (previous !== next) recordChange(label, () => onPatchCase({ [field]: previous }));
    });
  };

  // 切用例：Ctrl+←/→ 上/下一条。用例详情打开期间全局生效（面板挂载即挂监听）；
  // 普通输入框内让位给光标移动；富文本编辑器内按「编辑态先保存再切」口径直接切换（blur 提交后下一拍跳转）。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const target = siblingCases[currentCaseIndex + (event.key === "ArrowLeft" ? -1 : 1)];
      if (!target) return;
      event.preventDefault();
      active?.blur();
      window.setTimeout(() => onSelectSibling(target.id), 0);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [caseRecord.id, currentCaseIndex, siblingCases, onSelectSibling]);

  /** 人员指派：走用例 PATCH 同一保存链路，并记入 Ctrl+Z 撤销栈（与文本字段同口径）。 */
  const savePerson = (
    label: string,
    field: "testerId" | "monitorId" | "designerId",
    next: string,
  ) => {
    const previous = caseRecord[field] ?? "";
    return onPatchCase({ [field]: next }).then(() => {
      if (previous !== next) {
        recordChange(label, () => onPatchCase({ [field]: previous }));
      }
    });
  };

  return (
    <div className={styles.panel}>
      <SpotlightSurface as="header" className={styles.hero}>
        <div className={styles.heroMain}>
          <span className={styles.heroIdent}>{caseRecord.identifier}</span>
          <div className={styles.heroTitleRow}>
            <span className={styles.titleBar} aria-hidden />
            <h2 className={styles.heroTitle}>{caseRecord.name}</h2>
            <span className={styles.statusChip} data-status={caseRecord.status} aria-live="polite">
              {caseStatusLabel(caseRecord.status)}
            </span>
          </div>
        </div>
        <div className={styles.heroMeta}>
          <span className={styles.parentChip}>
            所属测试项 {item.identifier} · {item.name}
          </span>
          {canSwitchCase ? (
            <div className={styles.caseNav} role="group" aria-label="同测试项用例切换">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={styles.caseNavTrigger}>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="outline"
                      aria-label="上一条用例"
                      disabled={!previousCase}
                      onClick={() => previousCase && onSelectSibling(previousCase.id)}
                    >
                      <ChevronLeft aria-hidden />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {previousCase ? `上一条：${previousCase.name}` : "已经是第一条"}
                </TooltipContent>
              </Tooltip>
              <span className={styles.caseNavPosition}>
                {currentCaseIndex + 1}/{siblingCases.length}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={styles.caseNavTrigger}>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="outline"
                      aria-label="下一条用例"
                      disabled={!nextCase}
                      onClick={() => nextCase && onSelectSibling(nextCase.id)}
                    >
                      <ChevronRight aria-hidden />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {nextCase ? `下一条：${nextCase.name}` : "已经是最后一条"}
                </TooltipContent>
              </Tooltip>
            </div>
          ) : null}
          <Button type="button" size="xs" variant="outline" onClick={onBack}>
            返回测试项
          </Button>
        </div>
      </SpotlightSurface>

      <div className={styles.body} ref={scrollRef}>
        <div ref={bodyRef}>
          <table className={styles.sheet}>
            <tbody>
              <tr>
                <th scope="row">用例名称</th>
                <td>
                  <EditableCell
                    value={caseRecord.name}
                    label="用例名称"
                    missing={caseRecord.name.trim() === ""}
                    onSave={(next) => saveField("用例名称", "name", next)}
                  />
                </td>
                <th scope="row">用例标识</th>
                <td>
                  {/* 标识随测试项与顺序自动重排（SRS 24/01），只读。 */}
                  <span className={styles.identValue}>{caseRecord.identifier}</span>
                </td>
              </tr>
              {requirements ? (
                <tr>
                  <th scope="row">追踪关系</th>
                  <td colSpan={3}>
                    {requirements.length === 0 ? (
                      <span className={styles.reqEmpty}>
                        未关联需求（继承所属测试项，关联入口在测试项详情的「追踪关系」）
                      </span>
                    ) : (
                      <ul className={styles.trackTree}>
                        <li>
                          <span className={styles.trackDoc}>
                            <FileText className={styles.trackIcon} aria-hidden />
                            {requirements[0].sourceName || "未标注来源文档"}
                            {requirements[0].sourceVersion
                              ? ` ${requirements[0].sourceVersion}`
                              : ""}
                          </span>
                          <ul>
                            {requirements.map((reference, index) => (
                              <li key={reference.id}>
                                <span className={styles.trackReq}>
                                  <span className={styles.trackChapter}>
                                    §{reference.chapterNumber}
                                  </span>
                                  <TruncatedText
                                    value={reference.name}
                                    className={styles.trackName}
                                    tooltipValue={`${reference.name} · ${reference.externalIdentifier}`}
                                  />
                                  {reference.externalIdentifier ? (
                                    <span className={styles.trackIdent}>
                                      {reference.externalIdentifier}
                                    </span>
                                  ) : null}
                                </span>
                                {/* 追溯链只画一条：本用例挂在所属测试项下，测试项挂在第一条需求下，其余需求是旁支。 */}
                                {index === 0 ? (
                                  <ul>
                                    <li>
                                      <span className={styles.trackItem}>
                                        {item.identifier}
                                        <span className={styles.trackMuted}>{item.name}</span>
                                      </span>
                                      <ul>
                                        <li>
                                          <span className={styles.trackCase} data-current="true">
                                            {caseRecord.identifier}
                                            <span className={styles.trackMuted}>
                                              {caseRecord.name}
                                            </span>
                                          </span>
                                        </li>
                                      </ul>
                                    </li>
                                  </ul>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </li>
                      </ul>
                    )}
                  </td>
                </tr>
              ) : null}
              <tr>
                <th scope="row">
                  <span className={styles.headAction}>
                    用例综述
                    <SummaryBackfillPicker
                      itemId={item.id}
                      onPick={(text) => summaryCellRef.current?.applyText(text) ?? false}
                    />
                  </span>
                </th>
                <td colSpan={3}>
                  <EditableCell
                    ref={summaryCellRef}
                    value={caseRecord.summary}
                    label="用例综述"
                    placeholder="点击填写用例综述（默认由子项内容拼接）"
                    multiline
                    onSave={(next) => saveField("用例综述", "summary", next)}
                  />
                </td>
              </tr>
              <tr>
                <th scope="row">用例初始化</th>
                <td colSpan={3}>
                  <EditableCell
                    value={caseRecord.initText}
                    label="用例初始化"
                    placeholder="点击填写初始化步骤"
                    multiline
                    onSave={(next) => saveField("用例初始化", "initText", next)}
                  />
                </td>
              </tr>
              <tr>
                <th scope="row">前提和约束</th>
                <td colSpan={3}>
                  <EditableCell
                    value={caseRecord.prerequisites}
                    label="前提和约束"
                    placeholder="点击填写前提和约束"
                    multiline
                    onSave={(next) => saveField("前提和约束", "prerequisites", next)}
                  />
                </td>
              </tr>
              <tr>
                <th colSpan={4} scope="rowgroup" className={styles.stepsSectionTitle}>
                  测试步骤
                </th>
              </tr>
              <tr>
                <td colSpan={4} className={styles.stepsSectionCell}>
                  <CaseStepsSection
                    caseId={caseRecord.id}
                    projectCode={projectCode}
                    onCaseChanged={onCaseChanged}
                    recordChange={recordChange}
                    onOpenShortcuts={openShortcuts}
                    focusStep={focusStep}
                  />
                </td>
              </tr>
              <tr>
                <th scope="row">执行状态</th>
                <td>
                  <span
                    className={styles.statusChip}
                    data-status={caseRecord.status}
                    aria-live="polite"
                  >
                    {caseStatusLabel(caseRecord.status)}
                  </span>
                </td>
                <th scope="row">测试时间</th>
                <td>
                  <span className={styles.execDate}>{formatExecDate(caseRecord.execDate)}</span>
                </td>
              </tr>
              <tr>
                <th scope="row">测试人员</th>
                <td>
                  <PersonPicker
                    id={caseRecord.testerId}
                    label="测试人员"
                    members={members}
                    onAssign={(memberId) => savePerson("测试人员", "testerId", memberId)}
                  />
                </td>
                <th scope="row">监测人员</th>
                <td>
                  <PersonPicker
                    id={caseRecord.monitorId}
                    label="监测人员"
                    members={members}
                    onAssign={(memberId) => savePerson("监测人员", "monitorId", memberId)}
                  />
                </td>
              </tr>
              <tr>
                <th scope="row">问题单标识</th>
                <td>
                  <span className={styles.placeholderChip}>问题单模块就绪后接入</span>
                </td>
                <th scope="row">设计人员</th>
                <td>
                  <PersonPicker
                    id={caseRecord.designerId}
                    label="设计人员"
                    members={members}
                    onAssign={(memberId) => savePerson("设计人员", "designerId", memberId)}
                  />
                </td>
              </tr>
              <tr>
                <th scope="row">终止条件</th>
                <td colSpan={3}>
                  <EditableCell
                    value={caseRecord.terminationText}
                    label="终止条件"
                    placeholder="点击填写终止条件"
                    multiline
                    onSave={(next) => saveField("终止条件", "terminationText", next)}
                  />
                </td>
              </tr>
              <tr>
                <th scope="row">通过准则</th>
                <td colSpan={3}>
                  <EditableCell
                    value={caseRecord.passCriteria}
                    label="通过准则"
                    placeholder="点击填写通过准则"
                    multiline
                    onSave={(next) => saveField("通过准则", "passCriteria", next)}
                  />
                </td>
              </tr>
            </tbody>
          </table>
          {caseRecord.previousRoundAvailable ? (
            <div className={styles.previousRoundStandalone}>
              <PreviousRoundResultSection caseId={caseRecord.id} projectCode={projectCode} />
            </div>
          ) : null}
        </div>
      </div>
      <TestCaseShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}

/** 用例详情是重子树：父面板状态变化不该重渲染它。 */
export const TestCasePanel = memo(TestCasePanelInner);
