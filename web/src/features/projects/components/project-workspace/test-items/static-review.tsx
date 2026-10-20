import { useState } from "react";
import { FileCheck2, Plus, Trash2, X } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  StaticReviewCheck,
  StaticReviewSheet,
  StaticState,
  StaticWorkbench,
} from "@/features/test-items/types";
import { ConfirmAction } from "./static-shared";
import { reviewStats, uid, type StaticUpdater } from "./static-model";
import styles from "./static-workbench.module.css";

export function ReviewCheckTable({
  checks,
  onUpdate,
}: {
  checks: StaticReviewCheck[];
  onUpdate: (checkID: string, recipe: (check: StaticReviewCheck) => void) => void;
}) {
  const cycle = (check: StaticReviewCheck) =>
    onUpdate(check.id, (next) => {
      next.result =
        next.result === "unreviewed"
          ? "passed"
          : next.result === "passed"
            ? "failed"
            : "unreviewed";
    });
  return (
    <table className={styles.reviewTable}>
      <thead>
        <tr>
          <th>#</th>
          <th>类别</th>
          <th>检查项</th>
          <th>依据标准</th>
          <th>结果</th>
          <th>备注</th>
        </tr>
      </thead>
      <tbody>
        {checks.map((check) => (
          <tr key={check.id} data-result={check.result} data-check-id={check.id}>
            <td className={styles.seqCell}>{check.seq}</td>
            <td>
              <span className={styles.categoryChip}>{check.category || "未分类"}</span>
            </td>
            <td>
              <div className={styles.checkText}>
                <strong>{check.title}</strong>
                {check.requirement && check.requirement !== check.title ? (
                  <span>{check.requirement}</span>
                ) : null}
                {check.practice ? <em>做法：{check.practice}</em> : null}
              </div>
            </td>
            <td className={styles.basisCell}>{check.basis || "—"}</td>
            <td>
              <button
                type="button"
                className={styles.resultButton}
                data-result={check.result}
                aria-label={`${check.title}：${check.result === "unreviewed" ? "未审" : check.result === "passed" ? "通过" : "不通过"}，点击切换`}
                onClick={() => cycle(check)}
              >
                {check.result === "passed" ? "通过" : check.result === "failed" ? "不通过" : "未审"}
              </button>
            </td>
            <td>
              <Input
                value={check.notes}
                className={styles.inlineInput}
                placeholder="备注"
                aria-label={`${check.title}备注`}
                onChange={(event) =>
                  onUpdate(check.id, (next) => {
                    next.notes = event.target.value;
                  })
                }
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DcWorkbench({
  state,
  catalog,
  update,
}: {
  state: StaticState;
  catalog: StaticWorkbench["catalog"];
  update: StaticUpdater;
}) {
  const [activeSheetID, setActiveSheetID] = useState(state.reviewSheets[0]?.id ?? "");
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false);
  const [newSheetCode, setNewSheetCode] = useState("");
  const activeSheet =
    state.reviewSheets.find((sheet) => sheet.id === activeSheetID) ?? state.reviewSheets[0];
  const availableTemplates = catalog.reviewSheets.filter(
    (template) => !state.reviewSheets.some((sheet) => sheet.templateCode === template.code),
  );
  const totalChecks = state.reviewSheets.reduce((sum, sheet) => sum + sheet.checks.length, 0);
  const reviewed = state.reviewSheets.reduce(
    (sum, sheet) => sum + sheet.checks.filter((check) => check.result !== "unreviewed").length,
    0,
  );
  const passed = state.reviewSheets.reduce(
    (sum, sheet) => sum + sheet.checks.filter((check) => check.result === "passed").length,
    0,
  );
  const rate = totalChecks === 0 ? 0 : Math.round((passed / totalChecks) * 100);
  const missingDocs = catalog.documentOptions.filter(
    (name) => !state.documents.some((doc) => doc.name === name),
  );
  const updateSheet = (sheetID: string, recipe: (sheet: StaticReviewSheet) => void) =>
    update((next) => {
      const sheet = next.reviewSheets.find((item) => item.id === sheetID);
      if (sheet) recipe(sheet);
    });
  const updateCheck = (
    sheetID: string,
    checkID: string,
    recipe: (check: StaticReviewCheck) => void,
  ) =>
    updateSheet(sheetID, (sheet) => {
      const check = sheet.checks.find((item) => item.id === checkID);
      if (check) recipe(check);
    });
  const addSheet = () => {
    const template = availableTemplates.find((item) => item.code === newSheetCode);
    if (!template) return;
    const sheet: StaticReviewSheet = {
      id: uid(),
      templateCode: template.code,
      name: template.name,
      targetDocumentName: "",
      targetDocumentVersion: "",
      checks: template.checks.map((check, index) => ({
        id: uid(),
        seq: index + 1,
        category: check.category,
        title: check.title,
        requirement: check.requirement,
        basis: check.basis,
        practice: check.practice,
        result: "unreviewed",
        notes: "",
      })),
    };
    update((next) => {
      next.reviewSheets.push(sheet);
    });
    setActiveSheetID(sheet.id);
    setNewSheetCode("");
  };
  const addMissingDocs = () =>
    update((next) => {
      for (const name of missingDocs)
        next.documents.push({
          id: uid(),
          name,
          version: "",
          category: "GJB 438C",
          seq: next.documents.length + 1,
        });
    });
  const addDocument = () =>
    update((next) => {
      next.documents.push({
        id: uid(),
        name: "自定义文档",
        version: "",
        category: "自定义",
        seq: next.documents.length + 1,
      });
    });
  if (!activeSheet)
    return (
      <div className={styles.emptyState}>
        <FileCheck2 className={styles.emptyIcon} aria-hidden />
        <strong>还没有审查单</strong>
        <Button
          type="button"
          size="xs"
          onClick={addSheet}
          disabled={availableTemplates.length === 0}
        >
          添加内置审查单
        </Button>
      </div>
    );
  const visibleChecks = onlyUnreviewed
    ? activeSheet.checks.filter((check) => check.result === "unreviewed")
    : activeSheet.checks;
  const sheetStats = reviewStats(activeSheet.checks);
  return (
    <div className={styles.dcWrap}>
      <div className={styles.summaryStrip}>
        <div className={styles.summaryItem}>
          <span>审查单</span>
          <strong>{state.reviewSheets.length}</strong>
        </div>
        <div className={styles.summaryItem}>
          <span>受审文档</span>
          <strong>{state.documents.length}</strong>
        </div>
        <div className={styles.summaryItem}>
          <span>已审查</span>
          <strong>
            {reviewed}/{totalChecks}
          </strong>
        </div>
        <div className={styles.summaryRate}>
          <span>通过率 {rate}%</span>
          <Progress value={rate} className={styles.progress} />
        </div>
      </div>
      <Accordion type="single" collapsible className={styles.documentAccordion}>
        <AccordionItem value="documents">
          <AccordionTrigger>受审文档清单（{state.documents.length}）</AccordionTrigger>
          <AccordionContent>
            <div className={styles.documentRows}>
              {state.documents.map((doc) => (
                <div className={styles.documentRow} key={doc.id}>
                  <Input
                    value={doc.name}
                    aria-label="受审文档名称"
                    onChange={(event) =>
                      update((next) => {
                        const target = next.documents.find((item) => item.id === doc.id);
                        if (target) target.name = event.target.value;
                      })
                    }
                  />
                  <Input
                    value={doc.version}
                    placeholder="版本"
                    aria-label="受审文档版本"
                    onChange={(event) =>
                      update((next) => {
                        const target = next.documents.find((item) => item.id === doc.id);
                        if (target) target.version = event.target.value;
                      })
                    }
                  />
                  <ConfirmAction
                    title="删除受审文档"
                    description={`确认从清单中移除“${doc.name || "未命名文档"}”？`}
                    onConfirm={() =>
                      update((next) => {
                        next.documents = next.documents.filter((item) => item.id !== doc.id);
                      })
                    }
                  >
                    <Button type="button" size="icon-xs" variant="ghost" aria-label="删除受审文档">
                      <X aria-hidden />
                    </Button>
                  </ConfirmAction>
                </div>
              ))}
            </div>
            <div className={styles.inlineActions}>
              <Button type="button" size="xs" variant="outline" onClick={addDocument}>
                <Plus aria-hidden />
                自定义文档
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={missingDocs.length === 0}
                onClick={addMissingDocs}
              >
                补齐标准文档（{missingDocs.length}）
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <div className={styles.dcLayout}>
        <aside className={styles.sheetList}>
          {state.reviewSheets.map((sheet) => {
            const stats = reviewStats(sheet.checks);
            return (
              <div
                className={styles.sheetItem}
                key={sheet.id}
                data-active={sheet.id === activeSheet.id ? "true" : undefined}
              >
                <button
                  type="button"
                  className={styles.sheetButton}
                  onClick={() => setActiveSheetID(sheet.id)}
                >
                  <span className={styles.sheetName}>{sheet.name}</span>
                  <span className={styles.sheetMeta}>
                    {stats.reviewed}/{stats.total} · {stats.rate}%
                  </span>
                  <Progress
                    value={(stats.reviewed / Math.max(stats.total, 1)) * 100}
                    className={styles.sheetProgress}
                  />
                </button>
                <ConfirmAction
                  title="删除审查单"
                  description={`确认删除“${sheet.name}”及其全部审查结果？`}
                  onConfirm={() =>
                    update((next) => {
                      next.reviewSheets = next.reviewSheets.filter((item) => item.id !== sheet.id);
                      if (activeSheet.id === sheet.id) setActiveSheetID("");
                    })
                  }
                >
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    className={styles.sheetDelete}
                    aria-label={`删除${sheet.name}`}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </ConfirmAction>
              </div>
            );
          })}
          <div className={styles.addSheetRow}>
            <Select value={newSheetCode} onValueChange={setNewSheetCode}>
              <SelectTrigger size="sm" aria-label="选择要添加的审查单">
                <SelectValue placeholder="添加审查单" />
              </SelectTrigger>
              <SelectContent>
                {availableTemplates.map((template) => (
                  <SelectItem key={template.code} value={template.code}>
                    {template.name} · {template.checks.length} 项
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="icon-sm"
              aria-label="添加审查单"
              disabled={!newSheetCode}
              onClick={addSheet}
            >
              <Plus aria-hidden />
            </Button>
          </div>
        </aside>
        <section className={styles.sheetDetail}>
          <div className={styles.sheetHeader}>
            <div>
              <h4>{activeSheet.name}</h4>
              <span>
                第 {state.reviewSheets.findIndex((sheet) => sheet.id === activeSheet.id) + 1} 张 ·
                已审查 {sheetStats.reviewed}/{sheetStats.total} · 通过率 {sheetStats.rate}%
              </span>
            </div>
            <div className={styles.sheetTools}>
              <Checkbox
                checked={onlyUnreviewed}
                aria-label="只看未审"
                onCheckedChange={(checked) => setOnlyUnreviewed(checked === true)}
              />
              <span>只看未审</span>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() =>
                  updateSheet(activeSheet.id, (sheet) => {
                    for (const check of sheet.checks) check.result = "passed";
                  })
                }
              >
                全部通过
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={sheetStats.reviewed >= sheetStats.total}
                onClick={() => {
                  const next = activeSheet.checks.find((check) => check.result === "unreviewed");
                  if (!next) return;
                  document
                    .querySelector(`[data-check-id="${CSS.escape(next.id)}"]`)
                    ?.scrollIntoView({
                      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                        ? "auto"
                        : "smooth",
                      block: "center",
                    });
                }}
              >
                跳到下一个未审
              </Button>
            </div>
          </div>
          {activeSheet.templateCode !== "DC-KIT" ? (
            <div className={styles.targetDocumentRow}>
              <Input
                value={activeSheet.targetDocumentName}
                placeholder="受审文档名称"
                aria-label="审查单受审文档名称"
                onChange={(event) =>
                  updateSheet(activeSheet.id, (sheet) => {
                    sheet.targetDocumentName = event.target.value;
                  })
                }
              />
              <Input
                value={activeSheet.targetDocumentVersion}
                placeholder="版本"
                aria-label="审查单受审文档版本"
                onChange={(event) =>
                  updateSheet(activeSheet.id, (sheet) => {
                    sheet.targetDocumentVersion = event.target.value;
                  })
                }
              />
            </div>
          ) : null}
          <div className={styles.tableWrap}>
            <ReviewCheckTable
              checks={visibleChecks}
              onUpdate={(checkID, recipe) => updateCheck(activeSheet.id, checkID, recipe)}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
