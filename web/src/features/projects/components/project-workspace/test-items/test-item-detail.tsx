import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
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
import { StaticWorkbenchSection } from "./static-workbench";
import { categoryTone } from "./test-items-design";
import { TestItemBasicInfo } from "./test-item-detail-basic-info";
import { TestItemCasesSection } from "./test-item-detail-cases";
import {
  DETAIL_INFO,
  DETAIL_STATIC,
  SECTION_BASIC,
  SECTION_CASES,
  SECTION_LINKS,
  SECTION_METHOD,
} from "./test-item-detail-config";
import { TestItemDetailHero } from "./test-item-detail-hero";
import { TestItemSectionNav, type TestItemSaveState } from "./test-item-detail-section-nav";
import { useTestItemSectionNavigation } from "./use-test-item-section-navigation";
import { usePanelSwitchMotion } from "./use-panel-switch-motion";
import styles from "./test-item-detail.module.css";

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
  const [activeDetailTab, setActiveDetailTab] = useState<string>(DETAIL_INFO);
  const { activeSection, jumpTo } = useTestItemSectionNavigation({
    itemId: item.id,
    activeTab: activeDetailTab,
    scrollRef,
  });
  const isStatic = type?.isStatic ?? false;

  // 保存状态芯片（对齐需求详情的即时编辑口径）：待自动保存 / 保存中 / 已自动保存 / 保存失败。
  const [saveStateFor, setSaveStateFor] = useState<{ id: string; state: TestItemSaveState }>({
    id: "",
    state: "saved",
  });
  const saveState: TestItemSaveState = saveStateFor.id === item.id ? saveStateFor.state : "saved";
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

  // 切到“静态测试”或返回测试项信息时，同时校正内层详情和外围路由滚动位置。
  useLayoutEffect(() => {
    const detail = scrollRef.current;
    detail?.scrollTo({ top: 0 });
    detail?.closest<HTMLElement>("main.workspace-route")?.scrollTo({ top: 0 });
  }, [item.id, activeDetailTab]);

  // 只动画滚动容器里的内容，不动滚动容器本身——否则滚动条跟着位移，看起来在跳。
  const contentRef = useRef<HTMLDivElement>(null);
  usePanelSwitchMotion(contentRef, item.id);

  // 保存动作统一出口：上报 saving/saved/error，并给"保存中"一个最短展示时长（本地库几毫秒完成，转圈才看得见）。
  const withSavePhase = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
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
    },
    [reportPhase],
  );

  const patch = useCallback(
    (payload: UpdateTestItemPayload) => withSavePhase(() => onPatch(payload)),
    [withSavePhase, onPatch],
  );
  // 子项字段编辑走同一保存相位：否则芯片从「待自动保存」直接跳「已自动保存」，没有转圈（2026-10-12 用户反馈）。
  const patchSubItem = useCallback(
    (id: string, payload: UpdateSubItemPayload) =>
      withSavePhase(() => onUpdateSubItem(id, payload)),
    [withSavePhase, onUpdateSubItem],
  );

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

  const tone = type ? categoryTone(type.category) : "green";
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
          : section.id === SECTION_CASES
            ? detail.cases.length > 0
            : false;
    const unit =
      section.id === SECTION_METHOD ? "个子项" : section.id === SECTION_CASES ? "条用例" : "";
    return { ...section, step: index + 1, count, done, unit };
  });
  return (
    <div className={styles.detail} ref={scrollRef}>
      <div ref={contentRef} className={styles.content}>
        <Tabs
          value={activeDetailTab}
          onValueChange={setActiveDetailTab}
          className={styles.detailTabs}
        >
          <TestItemDetailHero
            item={item}
            type={type}
            round={round}
            folderName={folderName}
            tone={tone}
            completeness={completeness}
            isStatic={isStatic}
            onRequestDelete={onRequestDelete}
            onOpenSearchHit={onOpenSearchHit}
          />

          <TabsContent
            value={DETAIL_INFO}
            className={styles.tabPanel}
            forceMount
            inert={activeDetailTab !== DETAIL_INFO ? true : undefined}
          >
            <TestItemSectionNav
              saveChipKey={saveChipKey}
              saveState={saveState}
              activeSection={activeSection}
              sectionSteps={sectionSteps}
              onJump={jumpTo}
            />

            <TestItemBasicInfo
              detail={detail}
              type={type}
              platform={platform}
              projectId={projectId}
              tone={tone}
              isStatic={isStatic}
              tracked={tracked}
              patch={patch}
              patchSubItem={patchSubItem}
              onLink={onLink}
              onUnlink={onUnlink}
              onChangeType={onChangeType}
              onCreateSubItem={onCreateSubItem}
              onDeleteSubItem={onDeleteSubItem}
              onDuplicateSubItem={onDuplicateSubItem}
              onMoveSubItem={onMoveSubItem}
              onCreateCase={onCreateCase}
              reportPhase={reportPhase}
            />

            <TestItemCasesSection
              detail={detail}
              members={members}
              tone={tone}
              activeCaseId={activeCaseId}
              onSelectCase={onSelectCase}
              onDuplicateCase={onDuplicateCase}
              onBatchAssign={onBatchAssign}
              jumpTo={jumpTo}
            />
          </TabsContent>

          {isStatic ? (
            <TabsContent
              value={DETAIL_STATIC}
              className={styles.tabPanel}
              forceMount
              inert={activeDetailTab !== DETAIL_STATIC ? true : undefined}
            >
              <div className={styles.staticPanel}>
                <StaticWorkbenchSection
                  testItemId={item.id}
                  kind={item.typeCode}
                  platform={platform}
                  projectCode={projectId}
                />
              </div>
            </TabsContent>
          ) : null}
        </Tabs>
      </div>
    </div>
  );
}

/** 详情面板是重子树：工作区其余状态（树选择、弹窗、拖拽）变化时不该重渲染它。 */
export const TestItemDetailPanel = memo(TestItemDetailPanelInner);
