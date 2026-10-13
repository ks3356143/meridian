import { memo, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CopyPlus, FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { EmptyHint } from "@/components/shared/empty-hint";
import { QueryError, QueryLoading } from "@/components/shared/query-state";
import { TruncatedText } from "@/components/shared/truncated-text";
import type { UpdateCasePayload } from "@/features/test-items/api";
import type {
  TestCaseRecord,
  TestItemRecord,
  TestItemRequirementRef,
} from "@/features/test-items/types";
import { gsap, useGSAP } from "@/lib/gsap";
import type { ProjectMember } from "../../../types";
import { EditableCell } from "./editable-cell";
import { caseStatusLabel } from "./test-items-design";
import { useCaseSteps } from "./use-case-steps";
import { useCellUndo } from "./use-cell-undo";
import styles from "./test-case-panel.module.css";

/** 可撤销的用例文本字段（HTML 值都是字符串）。 */
type CaseTextField = "name" | "summary" | "initText" | "prerequisites";

function formatExecDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** 人员栏位（模板「测试人员 / 监测人员」）：先只读显示姓名，指派下拉随切片 5c。 */
function PersonCell({ id, members }: { id: string | null; members: ProjectMember[] }) {
  const person = id ? members.find((member) => member.id === id) : undefined;
  return person ? (
    <span className={styles.personChip}>{person.displayName || person.username}</span>
  ) : (
    <span className={styles.placeholderChip}>未指派</span>
  );
}

function TestCasePanelInner({
  item,
  caseRecord,
  requirements,
  members,
  onBack,
  onPatchCase,
  onCaseChanged,
}: {
  /** 所属测试项（Hero 里显示，返回按钮也回到它）。 */
  item: TestItemRecord;
  caseRecord: TestCaseRecord;
  /** 追踪关系继承所属测试项；null = 不显示本行（详情未就绪或静态测试项）。 */
  requirements: TestItemRequirementRef[] | null;
  /** 项目成员：人员栏位只读显示姓名。 */
  members: ProjectMember[];
  onBack: () => void;
  onPatchCase: (payload: UpdateCasePayload) => Promise<unknown>;
  onCaseChanged: () => void;
}) {
  const {
    stepsQuery,
    steps,
    createStepMutation,
    updateStepMutation,
    toggleStepMutation,
    duplicateStepMutation,
    deleteStepMutation,
    moveStepMutation,
  } = useCaseSteps(caseRecord.id, onCaseChanged);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; seq: number } | null>(null);
  const { recordChange } = useCellUndo();

  // 切用例时内容入场，口径与测试项详情一致：只动画内容，不动滚动容器本体。
  const bodyRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // 切用例时在绘制前回到顶部，避免"先画新用例再滚回去"的跳动（测试项详情同口径）。
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [caseRecord.id]);
  useGSAP(
    () => {
      const element = bodyRef.current;
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
    { dependencies: [caseRecord.id], revertOnUpdate: true },
  );

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

  const stepsBody = stepsQuery.isPending ? (
    <QueryLoading label="正在加载测试步骤" rows={3} />
  ) : stepsQuery.isError ? (
    <QueryError
      title="步骤加载失败"
      description="无法读取该用例的测试步骤。"
      onRetry={() => void stepsQuery.refetch()}
    />
  ) : steps.length === 0 ? (
    <EmptyHint
      tone="info"
      action={
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => createStepMutation.mutate()}
        >
          新增第一个步骤
        </Button>
      }
    >
      这个用例还没有步骤；步骤是执行与记录的取数单位，至少保留 1 行。
    </EmptyHint>
  ) : (
    <table className={styles.stepsTable}>
      <thead>
        <tr>
          <th scope="col">序号</th>
          <th scope="col">期望结果与评估标准</th>
          <th scope="col">通过与否</th>
          <th scope="col">操作</th>
        </tr>
      </thead>
      <tbody>
        {steps.map((step, index) => (
          <tr key={step.id} data-status={step.passed}>
            <td className={styles.stepSeq}>{step.seq}</td>
            <td>
              <EditableCell
                value={step.expectText}
                label={`第 ${step.seq} 步期望结果与评估标准`}
                placeholder="点击填写期望结果与评估标准"
                multiline
                bordered
                onSave={(next) => {
                  const previous = step.expectText;
                  return updateStepMutation
                    .mutateAsync({ id: step.id, expectText: next })
                    .then(() => {
                      if (previous !== next) {
                        recordChange(`第 ${step.seq} 步期望结果与评估标准`, () =>
                          updateStepMutation.mutateAsync({ id: step.id, expectText: previous }),
                        );
                      }
                    });
                }}
              />
            </td>
            <td>
              <button
                type="button"
                className={styles.passButton}
                data-status={step.passed}
                title="点击切换：未执行 → 通过 → 未通过"
                onClick={() => {
                  const previous = step.passed;
                  void toggleStepMutation
                    .mutateAsync(step.id)
                    .then(() =>
                      recordChange(`第 ${step.seq} 步通过状态`, () =>
                        updateStepMutation.mutateAsync({ id: step.id, passed: previous }),
                      ),
                    );
                }}
              >
                {caseStatusLabel(
                  step.passed === "pass" ? "passed" : step.passed === "fail" ? "failed" : "pending",
                )}
              </button>
            </td>
            <td className={styles.stepActionsCell}>
              <div className={styles.stepActions}>
                <button
                  type="button"
                  className={styles.stepAction}
                  title="上移"
                  aria-label={`上移第 ${step.seq} 步`}
                  disabled={index === 0}
                  onClick={() => moveStepMutation.mutate({ id: step.id, targetIndex: index - 1 })}
                >
                  <ArrowUp aria-hidden />
                </button>
                <button
                  type="button"
                  className={styles.stepAction}
                  title="下移"
                  aria-label={`下移第 ${step.seq} 步`}
                  disabled={index === steps.length - 1}
                  onClick={() => moveStepMutation.mutate({ id: step.id, targetIndex: index + 1 })}
                >
                  <ArrowDown aria-hidden />
                </button>
                <button
                  type="button"
                  className={styles.stepAction}
                  title="复制步骤"
                  aria-label={`复制第 ${step.seq} 步`}
                  onClick={() => duplicateStepMutation.mutate(step.id)}
                >
                  <CopyPlus aria-hidden />
                </button>
                <button
                  type="button"
                  className={styles.stepAction}
                  data-variant="destructive"
                  title="删除步骤"
                  aria-label={`删除第 ${step.seq} 步`}
                  onClick={() => setPendingDelete({ id: step.id, seq: step.seq })}
                >
                  <Trash2 aria-hidden />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className={styles.panel}>
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <span className={styles.heroIdent}>{caseRecord.identifier}</span>
          <div className={styles.heroTitleRow}>
            <span className={styles.titleBar} aria-hidden />
            <h2 className={styles.heroTitle}>{caseRecord.name}</h2>
            <span className={styles.statusChip} data-status={caseRecord.status}>
              {caseStatusLabel(caseRecord.status)}
            </span>
          </div>
        </div>
        <div className={styles.heroMeta}>
          <span className={styles.parentChip}>
            所属测试项 {item.identifier} · {item.name}
          </span>
          <Button type="button" size="xs" variant="outline" onClick={onBack}>
            返回测试项
          </Button>
        </div>
      </header>

      <div className={styles.body} ref={scrollRef}>
        <div ref={bodyRef}>
          <p className={styles.undoHint}>
            Ctrl+Z 撤销最近一次改动（上限 20 步；编辑中用浏览器原生撤销）
          </p>
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
                <th scope="row">用例综述</th>
                <td colSpan={3}>
                  <EditableCell
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
                <th scope="row">测试步骤</th>
                <td colSpan={3}>
                  <div className={styles.stepsToolbar}>
                    <span className={styles.stepsHint}>
                      「输入及操作 / 实测结果」两列（富文本）随切片 5b 接入，人员指派与快捷键随 5c
                    </span>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => createStepMutation.mutate()}
                    >
                      <Plus aria-hidden />
                      新增步骤
                    </Button>
                  </div>
                  {stepsBody}
                </td>
              </tr>
              <tr>
                <th scope="row">执行状态</th>
                <td>
                  <span className={styles.statusChip} data-status={caseRecord.status}>
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
                  <PersonCell id={caseRecord.testerId} members={members} />
                </td>
                <th scope="row">监测人员</th>
                <td>
                  <PersonCell id={caseRecord.monitorId} members={members} />
                </td>
              </tr>
              <tr>
                <th scope="row">问题单标识</th>
                <td>
                  <span className={styles.placeholderChip}>问题单模块就绪后接入</span>
                </td>
                <th scope="row">设计人员</th>
                <td>
                  <PersonCell id={caseRecord.designerId} members={members} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {pendingDelete ? (
        <AlertDialog open onOpenChange={(open) => (open ? undefined : setPendingDelete(null))}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除第 {pendingDelete.seq} 步？</AlertDialogTitle>
              <AlertDialogDescription>
                删除后剩余步骤会重新编号；用例至少保留 1 个步骤。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                className={styles.dangerAction}
                onClick={() => deleteStepMutation.mutate(pendingDelete.id)}
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}

/** 用例详情是重子树：父面板状态变化不该重渲染它。 */
export const TestCasePanel = memo(TestCasePanelInner);
