import { useState } from "react";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
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
import type {
  StaticReviewCheck,
  StaticReviewTarget,
  StaticState,
  StaticWorkbench,
} from "@/features/test-items/types";
import type { ProjectPlatform } from "@/features/projects/types";
import { ReviewCheckTable } from "./static-review";
import { ConfirmAction } from "./static-shared";
import { reviewStats, uid, type StaticUpdater } from "./static-model";
import styles from "./static-workbench.module.css";

export function CrWorkbench({
  state,
  catalog,
  platform,
  update,
}: {
  state: StaticState;
  catalog: StaticWorkbench["catalog"];
  platform: ProjectPlatform;
  update: StaticUpdater;
}) {
  const languages = platform === "FPGA" ? ["Verilog", "VHDL"] : ["C", "C++"];
  const [language, setLanguage] = useState(languages[0]);
  const templates = catalog.reviewSheets.filter((template) =>
    template.language?.includes(language),
  );
  const [sheetCode, setSheetCode] = useState(templates[0]?.code ?? "");
  const selectedTemplate =
    templates.find((template) => template.code === sheetCode) ?? templates[0];

  const addTarget = () => {
    if (!selectedTemplate) return;
    const target: StaticReviewTarget = {
      id: uid(),
      language,
      sheetCode: selectedTemplate.code,
      name: selectedTemplate.name,
      checks: selectedTemplate.checks.map((check, index) => ({
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
      next.reviewTargets.push(target);
    });
  };
  const updateTarget = (targetID: string, recipe: (target: StaticReviewTarget) => void) =>
    update((next) => {
      const target = next.reviewTargets.find((item) => item.id === targetID);
      if (target) recipe(target);
    });
  const updateCheck = (
    targetID: string,
    checkID: string,
    recipe: (check: StaticReviewCheck) => void,
  ) =>
    updateTarget(targetID, (target) => {
      const check = target.checks.find((item) => item.id === checkID);
      if (check) recipe(check);
    });
  const reviewed = state.reviewTargets.reduce(
    (sum, target) => sum + target.checks.filter((check) => check.result !== "unreviewed").length,
    0,
  );
  const total = state.reviewTargets.reduce((sum, target) => sum + target.checks.length, 0);
  const passed = state.reviewTargets.reduce(
    (sum, target) => sum + target.checks.filter((check) => check.result === "passed").length,
    0,
  );
  return (
    <div className={styles.crWrap}>
      <div className={styles.summaryStrip}>
        <div className={styles.summaryItem}>
          <span>审查目标</span>
          <strong>{state.reviewTargets.length}</strong>
        </div>
        <div className={styles.summaryItem}>
          <span>已审查</span>
          <strong>
            {reviewed}/{total}
          </strong>
        </div>
        <div className={styles.summaryRate}>
          <span>通过率 {total === 0 ? 0 : Math.round((passed / total) * 100)}%</span>
          <Progress
            value={total === 0 ? 0 : (reviewed / total) * 100}
            className={styles.progress}
          />
        </div>
      </div>
      <div className={styles.targetCreator}>
        <div className={styles.creatorField}>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger size="sm" className={styles.creatorSelect} aria-label="审查语言">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className={styles.creatorField}>
          <Select value={selectedTemplate?.code ?? ""} onValueChange={setSheetCode}>
            <SelectTrigger size="sm" className={styles.creatorSelect} aria-label="审查单">
              <SelectValue placeholder="选择审查单" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.code} value={template.code}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" size="sm" onClick={addTarget}>
          <Plus aria-hidden />
          添加审查目标
        </Button>
      </div>
      {state.reviewTargets.length === 0 ? (
        <div className={styles.emptyState}>
          <ShieldCheck className={styles.emptyIcon} aria-hidden />
          <strong>还没有审查目标</strong>
          <span>选择语言与审查单后添加，检查项按模板一次性生成。</span>
        </div>
      ) : (
        state.reviewTargets.map((target) => {
          const stats = reviewStats(target.checks);
          return (
            <section className={styles.targetCard} key={target.id}>
              <div className={styles.targetHeader}>
                <div>
                  <Badge variant="outline">{target.language}</Badge>
                  <strong>{target.name}</strong>
                  <span>
                    {stats.reviewed}/{stats.total} · 通过率 {stats.rate}%
                  </span>
                </div>
                <ConfirmAction
                  title="删除审查目标"
                  description={`确认删除“${target.name}”及其审查结果？`}
                  onConfirm={() =>
                    update((next) => {
                      next.reviewTargets = next.reviewTargets.filter(
                        (item) => item.id !== target.id,
                      );
                    })
                  }
                >
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="删除审查目标">
                    <Trash2 aria-hidden />
                  </Button>
                </ConfirmAction>
              </div>
              <div className={styles.tableWrap}>
                <ReviewCheckTable
                  checks={target.checks}
                  onUpdate={(checkID, recipe) => updateCheck(target.id, checkID, recipe)}
                />
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
