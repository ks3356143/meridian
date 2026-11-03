import type { Dispatch, SetStateAction } from "react";
import { AlertTriangle, ChevronDown, FileCheck2, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import type {
  StaticReviewCheck,
  StaticReviewSheet,
  StaticSheetTemplate,
  StaticState,
} from "@/features/test-items/types";
import { ConfirmAction } from "./static-shared";
import { checkStats, isCompletenessSheet, nextResult } from "./static-dc-model";
import { DcCheckTable } from "./static-dc-table";
import styles from "./static-workbench.module.css";
import dcStyles from "./static-dc.module.css";

export interface DcSheetsContext {
  projectCode: string;
  state: StaticState;
  sheetsWithoutTarget: StaticReviewSheet[];
  onlyFailsMode: boolean;
  setOnlyFailsMode: (value: boolean) => void;
  availableTemplates: StaticSheetTemplate[];
  addSheet: (template: StaticSheetTemplate) => void;
  expandedSheets: Set<string>;
  setExpandedSheets: Dispatch<SetStateAction<Set<string>>>;
  updateCheck: (
    sheetId: string,
    checkId: string,
    recipe: (check: StaticReviewCheck) => void,
  ) => void;
  uploadEvidence: (
    sheet: StaticReviewSheet,
    check: StaticReviewCheck,
    files: FileList | null,
  ) => Promise<void>;
  onCreateIssue: (sheet: StaticReviewSheet, check: StaticReviewCheck) => void;
  update: (recipe: (draft: StaticState) => void) => void;
  markAllPass: (sheet: StaticReviewSheet) => void;
}

export function DcSheetsTab({ ctx }: { ctx: DcSheetsContext }) {
  const {
    projectCode,
    state,
    sheetsWithoutTarget,
    onlyFailsMode,
    setOnlyFailsMode,
    availableTemplates,
    addSheet,
    expandedSheets,
    setExpandedSheets,
    updateCheck,
    uploadEvidence,
    onCreateIssue,
    update,
    markAllPass,
  } = ctx;
  const requestIssue = onCreateIssue;
  return (
    <TabsContent value="sheets" className={dcStyles.dcTabPanel}>
      {sheetsWithoutTarget.length > 0 ? (
        <div className={dcStyles.dcBanner} data-tone="warn">
          <AlertTriangle aria-hidden />
          <span>
            以下审查单尚未指定受审文档：
            {sheetsWithoutTarget.map((sheet) => sheet.name).join("、")}
          </span>
        </div>
      ) : null}
      <div className={dcStyles.dcSheetToolbar}>
        <label className={dcStyles.dcFilter}>
          <input
            type="checkbox"
            checked={onlyFailsMode}
            onChange={(event) => setOnlyFailsMode(event.target.checked)}
          />
          只看不通过
        </label>
        <Select
          value=""
          onValueChange={(code) => {
            const template = availableTemplates.find((item) => item.code === code);
            if (template) addSheet(template);
          }}
        >
          <SelectTrigger size="sm" aria-label="添加审查单" className={dcStyles.dcAddSheet}>
            <SelectValue
              placeholder={availableTemplates.length ? "添加审查单" : "所有审查单已添加"}
            />
          </SelectTrigger>
          <SelectContent>
            {availableTemplates.map((template) => (
              <SelectItem key={template.code} value={template.code}>
                {template.name} · {template.checks.length} 项
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={dcStyles.dcSheetCards}>
        {state.reviewSheets.map((sheet) => {
          const sheetStats = checkStats(sheet.checks);
          const expanded = expandedSheets.has(sheet.id);
          return (
            <div
              key={sheet.id}
              className={dcStyles.dcSheetCard}
              data-expanded={expanded ? "true" : undefined}
            >
              <button
                type="button"
                className={dcStyles.dcSheetCardHead}
                aria-expanded={expanded}
                onClick={() =>
                  setExpandedSheets((current) => {
                    const next = new Set(current);
                    if (next.has(sheet.id)) next.delete(sheet.id);
                    else next.add(sheet.id);
                    return next;
                  })
                }
              >
                <span className={dcStyles.dcSheetCardTitle}>
                  <FileText aria-hidden />
                  {sheet.name}
                </span>
                <Progress
                  value={sheetStats.rate}
                  className={styles.progress}
                  data-tone={sheetStats.fail ? "danger" : "success"}
                />
                <span className={dcStyles.dcSheetCardMeta}>
                  {sheetStats.fail ? (
                    <em data-tone="danger">
                      <strong>{sheetStats.fail}</strong> 不通过
                    </em>
                  ) : null}
                  <span className={dcStyles.dcSheetStat}>
                    <strong>
                      {sheetStats.pass}/{sheetStats.total}
                    </strong>
                    <small>通过</small>
                  </span>
                  <ChevronDown className={dcStyles.dcSheetChevron} aria-hidden />
                </span>
              </button>
              <div
                className={dcStyles.dcCollapse}
                data-expanded={expanded ? "true" : undefined}
                aria-hidden={!expanded}
                inert={!expanded}
              >
                <div className={dcStyles.dcCollapseInner}>
                  <div className={dcStyles.dcSheetPanel}>
                    {!isCompletenessSheet(sheet.templateCode) ? (
                      <div className={dcStyles.dcTargetDoc}>
                        <span>
                          受审文档：
                          <strong>
                            {sheet.documentType || sheet.targetDocumentName || "未指定"}
                          </strong>
                        </span>
                        <span>
                          使用版本：
                          <strong>{sheet.targetDocumentVersion || "未设置"}</strong>
                        </span>
                      </div>
                    ) : null}
                    <div className={styles.sheetTools}>
                      {sheetStats.fail === 0 ? (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => markAllPass(sheet)}
                        >
                          全部通过
                        </Button>
                      ) : (
                        <ConfirmAction
                          title="全部通过"
                          description={`当前有 ${sheetStats.fail} 项不通过，全部通过会清空错误描述与截图证据，继续？`}
                          confirmLabel="确认全部通过"
                          onConfirm={() => markAllPass(sheet)}
                        >
                          <Button type="button" size="xs" variant="outline">
                            全部通过
                          </Button>
                        </ConfirmAction>
                      )}
                    </div>
                    <DcCheckTable
                      projectCode={projectCode}
                      sheet={sheet}
                      onlyFails={onlyFailsMode}
                      onCycle={(check) =>
                        updateCheck(sheet.id, check.id, (target) => {
                          target.result = nextResult(target.result);
                        })
                      }
                      onNotesChange={(check, value) =>
                        updateCheck(sheet.id, check.id, (target) => {
                          target.notes = value;
                        })
                      }
                      onRemoveImage={(check, assetId) =>
                        updateCheck(sheet.id, check.id, (target) => {
                          target.images = (target.images ?? []).filter((id) => id !== assetId);
                        })
                      }
                      onUpload={(check, files) => void uploadEvidence(sheet, check, files)}
                      onCreateIssue={(check) => requestIssue(sheet, check)}
                    />
                    <ConfirmAction
                      title="删除审查单"
                      description={`确认删除“${sheet.name}”及其全部审查结果？`}
                      onConfirm={() =>
                        update((next) => {
                          next.reviewSheets = next.reviewSheets.filter(
                            (item) => item.id !== sheet.id,
                          );
                        })
                      }
                    >
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        className={dcStyles.dcSheetDelete}
                      >
                        <Trash2 aria-hidden />
                        删除审查单
                      </Button>
                    </ConfirmAction>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {state.reviewSheets.length === 0 ? (
          <div className={styles.emptyState}>
            <FileCheck2 className={styles.emptyIcon} aria-hidden />
            <strong>还没有审查单</strong>
            <Button
              type="button"
              size="xs"
              disabled={!availableTemplates.length}
              onClick={() => availableTemplates[0] && addSheet(availableTemplates[0])}
            >
              添加内置审查单
            </Button>
          </div>
        ) : null}
      </div>
    </TabsContent>
  );
}
