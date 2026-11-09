import { Pencil, X } from "lucide-react";
import { Fade } from "@animate-ui/react/primitives/effects/fade";
import { Button } from "@/components/ui/button";
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
import type { UpdateSubItemPayload, UpdateTestItemPayload } from "@/features/test-items/api";
import type { TestItemDetail, TestItemType } from "@/features/test-items/types";
import type { ProjectPlatform } from "@/features/projects/types";
import { EditableCell } from "./editable-cell";
import { RequirementAccordion } from "./requirement-accordion";
import { RequirementLinkPicker } from "./requirement-link-picker";
import { SubItemCards } from "./sub-item-cards";
import { PRIORITIES, SECTION_BASIC, SECTION_METHOD } from "./test-item-detail-config";
import styles from "./test-item-detail.module.css";

type SavePhase = "editing-start" | "editing-end" | "saving" | "saved" | "error";

export function TestItemBasicInfo({
  detail,
  type,
  platform,
  projectId,
  tone,
  isStatic,
  tracked,
  patch,
  patchSubItem,
  onLink,
  onUnlink,
  onChangeType,
  onCreateSubItem,
  onDeleteSubItem,
  onDuplicateSubItem,
  onMoveSubItem,
  onCreateCase,
  reportPhase,
}: {
  detail: TestItemDetail;
  type: TestItemType | undefined;
  platform: ProjectPlatform;
  projectId: string;
  tone: string;
  isStatic: boolean;
  tracked: boolean;
  patch: (payload: UpdateTestItemPayload) => Promise<unknown>;
  patchSubItem: (id: string, payload: UpdateSubItemPayload) => Promise<unknown>;
  onLink: (requirementId: string) => Promise<unknown>;
  onUnlink: (requirementId: string) => Promise<unknown>;
  onChangeType: () => void;
  onCreateSubItem: (name: string) => Promise<unknown>;
  onDeleteSubItem: (id: string) => Promise<unknown>;
  onDuplicateSubItem: (id: string) => Promise<unknown>;
  onMoveSubItem: (id: string, targetIndex: number) => Promise<unknown>;
  onCreateCase: (name: string) => Promise<unknown>;
  reportPhase: (phase: SavePhase) => void;
}) {
  const item = detail.item;
  return (
    <div id={SECTION_BASIC} className={styles.tableWrap}>
      <table className={styles.itemTable}>
        <tbody>
          <tr>
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
                    <div className={styles.linkActions}>
                      <RequirementLinkPicker
                        projectId={projectId}
                        linkedIds={detail.requirements.map((reference) => reference.id)}
                        disabled={item.implicitRequirement}
                        onPick={onLink}
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant={item.implicitRequirement ? "secondary" : "outline"}
                            size="xs"
                            className={styles.implicitButton}
                            data-active={item.implicitRequirement ? "true" : undefined}
                            aria-pressed={item.implicitRequirement}
                            disabled={detail.requirements.length > 0 && !item.implicitRequirement}
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
                          <Fade
                            key={reference.id}
                            asChild
                            initialOpacity={0}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                          >
                            <span className={styles.linkChip}>
                              {reference.sourceName ? (
                                <span className={styles.linkSource}>{reference.sourceName}</span>
                              ) : null}
                              <span className={styles.linkChapter}>§{reference.chapterNumber}</span>
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
                          </Fade>
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
            className={styles.sectionAnchor}
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
  );
}
