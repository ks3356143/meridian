import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  StaticAnalysisCheck,
  StaticMetrics,
  StaticRuleViolation,
  StaticState,
  StaticWorkbench,
} from "@/features/test-items/types";
import { type StaticUpdater } from "./static-model";
import styles from "./static-workbench.module.css";

const METRIC_RULES = [
  { key: "averageSize", label: "平均规模", criterion: "≤ 200 行", max: 200 },
  { key: "averageFanout", label: "平均扇出数", criterion: "≤ 7", max: 7 },
  { key: "averageComplexity", label: "平均圈复杂度", criterion: "≤ 10", max: 10 },
  { key: "maxComplexity", label: "模块最大圈复杂度", criterion: "≤ 80", max: 80 },
  { key: "highComplexityRatio", label: "圈复杂度 ≥ 20 比例", criterion: "≤ 20%", max: 20 },
  { key: "commentRatio", label: "注释率", criterion: "≥ 20%", min: 20 },
] as const;
const ANALYSIS_LABELS: Record<string, string> = { C3: "C.3 控制流分析", C4: "C.4 数据流分析" };
type NumericMetricKey = Exclude<keyof StaticMetrics, "softwareName" | "softwareVersion">;

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className={styles.metricField}>
      <span>{label}</span>
      <Input
        type="number"
        min="0"
        step="any"
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value === "" ? null : Number(event.target.value))
        }
      />
    </label>
  );
}

export function SaWorkbench({
  state,
  catalog,
  update,
}: {
  state: StaticState;
  catalog: StaticWorkbench["catalog"];
  update: StaticUpdater;
}) {
  const [openGroup, setOpenGroup] = useState(catalog.ruleGroups[0]?.code ?? "");
  const violations = useMemo(
    () => new Map(state.ruleViolations.map((violation) => [violation.ruleCode, violation])),
    [state.ruleViolations],
  );
  const metricsDone = METRIC_RULES.filter((rule) => state.metrics[rule.key] !== null).length;
  const updateMetric = (key: NumericMetricKey, value: number | null) =>
    update((next) => {
      next.metrics = { ...next.metrics, [key]: value };
    });
  const toggleRule = (ruleCode: string, checked: boolean) =>
    update((next) => {
      const index = next.ruleViolations.findIndex((item) => item.ruleCode === ruleCode);
      if (checked && index < 0) next.ruleViolations.push({ ruleCode, reason: "", location: "" });
      if (!checked && index >= 0) next.ruleViolations.splice(index, 1);
    });
  const updateViolation = (ruleCode: string, recipe: (violation: StaticRuleViolation) => void) =>
    update((next) => {
      const violation = next.ruleViolations.find((item) => item.ruleCode === ruleCode);
      if (violation) recipe(violation);
    });
  const passGroup = (codes: string[]) =>
    update((next) => {
      next.ruleViolations = next.ruleViolations.filter((item) => !codes.includes(item.ruleCode));
    });
  const updateAnalysis = (checkID: string, recipe: (check: StaticAnalysisCheck) => void) =>
    update((next) => {
      const check = next.analysisChecks.find((item) => item.id === checkID);
      if (check) recipe(check);
    });
  const metricStatus = (key: (typeof METRIC_RULES)[number]["key"]) => {
    const value = state.metrics[key];
    const rule = METRIC_RULES.find((item) => item.key === key)!;
    if (value === null) return "pending";
    if ("max" in rule && value > rule.max) return "failed";
    if ("min" in rule && value < rule.min) return "failed";
    return "passed";
  };
  const group = catalog.ruleGroups.find((item) => item.code === openGroup) ?? catalog.ruleGroups[0];
  return (
    <Accordion type="single" collapsible defaultValue="C1" className={styles.saAccordion}>
      <AccordionItem value="C1">
        <AccordionTrigger>
          <span>C.1 代码质量度量</span>
          <Badge variant="outline" className={styles.accordionBadge}>
            {metricsDone}/6
          </Badge>
        </AccordionTrigger>
        <AccordionContent>
          <div className={styles.metricsGrid}>
            <div className={styles.metricField}>
              <span>软件名称</span>
              <Input
                aria-label="软件名称"
                value={state.metrics.softwareName}
                onChange={(event) =>
                  update((next) => {
                    next.metrics.softwareName = event.target.value;
                  })
                }
              />
            </div>
            <div className={styles.metricField}>
              <span>软件版本</span>
              <Input
                aria-label="软件版本"
                value={state.metrics.softwareVersion}
                onChange={(event) =>
                  update((next) => {
                    next.metrics.softwareVersion = event.target.value;
                  })
                }
              />
            </div>
            <NumberField
              label="软件规模"
              value={state.metrics.softwareScale}
              onChange={(value) => updateMetric("softwareScale", value)}
            />
            <NumberField
              label="代码行"
              value={state.metrics.codeLines}
              onChange={(value) => updateMetric("codeLines", value)}
            />
            <NumberField
              label="注释行"
              value={state.metrics.commentLines}
              onChange={(value) => updateMetric("commentLines", value)}
            />
            <NumberField
              label="空行"
              value={state.metrics.blankLines}
              onChange={(value) => updateMetric("blankLines", value)}
            />
            <NumberField
              label="模块总数"
              value={state.metrics.moduleCount}
              onChange={(value) => updateMetric("moduleCount", value)}
            />
          </div>
          <table className={styles.metricsTable}>
            <thead>
              <tr>
                <th>度量元</th>
                <th>判别标准</th>
                <th>实测结果</th>
                <th>是否满足</th>
              </tr>
            </thead>
            <tbody>
              {METRIC_RULES.map((rule) => {
                const status = metricStatus(rule.key);
                return (
                  <tr key={rule.key}>
                    <td>{rule.label}</td>
                    <td>{rule.criterion}</td>
                    <td>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={state.metrics[rule.key] ?? ""}
                        onChange={(event) =>
                          updateMetric(
                            rule.key,
                            event.target.value === "" ? null : Number(event.target.value),
                          )
                        }
                      />
                    </td>
                    <td>
                      <span className={styles.metricStatus} data-status={status}>
                        {status === "passed" ? "满足" : status === "failed" ? "不满足" : "待录入"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Textarea
            value={state.metricConclusion}
            placeholder="质量度量结论"
            aria-label="质量度量结论"
            minRows={2}
            onChange={(event) =>
              update((next) => {
                next.metricConclusion = event.target.value;
              })
            }
          />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="C2">
        <AccordionTrigger>
          <span>C.2 代码编码规则</span>
          <Badge variant="outline" className={styles.accordionBadge}>
            {state.ruleViolations.length} 违规
          </Badge>
        </AccordionTrigger>
        <AccordionContent>
          <div className={styles.ruleGroups}>
            {catalog.ruleGroups.map((item) => (
              <button
                key={item.code}
                type="button"
                className={styles.ruleGroupButton}
                data-active={openGroup === item.code ? "true" : undefined}
                onClick={() => setOpenGroup(item.code)}
              >
                {item.name}
                <span>{item.rules.length}</span>
              </button>
            ))}
          </div>
          {group ? (
            <div className={styles.ruleList}>
              <div className={styles.ruleGroupHeader}>
                <strong>{group.name}</strong>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => passGroup(group.rules.map((rule) => rule.code))}
                >
                  <Check aria-hidden />
                  整组通过
                </Button>
              </div>
              {group.rules.map((rule) => {
                const violation = violations.get(rule.code);
                return (
                  <div
                    className={styles.ruleRow}
                    key={rule.code}
                    data-violation={violation ? "true" : undefined}
                  >
                    <Checkbox
                      checked={Boolean(violation)}
                      aria-label={`${rule.code} 违规`}
                      onCheckedChange={(checked) => toggleRule(rule.code, checked === true)}
                    />
                    <span className={styles.ruleCode}>{rule.code}</span>
                    <span className={styles.ruleDescription}>{rule.description}</span>
                    {violation ? (
                      <div className={styles.violationFields}>
                        <Input
                          value={violation.reason}
                          placeholder="违规原因（必填）"
                          aria-label={`${rule.code} 违规原因`}
                          onChange={(event) =>
                            updateViolation(rule.code, (next) => {
                              next.reason = event.target.value;
                            })
                          }
                        />
                        <Input
                          value={violation.location}
                          placeholder="位置（可选）"
                          aria-label={`${rule.code} 违规位置`}
                          onChange={(event) =>
                            updateViolation(rule.code, (next) => {
                              next.location = event.target.value;
                            })
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </AccordionContent>
      </AccordionItem>
      {(["C3", "C4"] as const).map((form) => (
        <AccordionItem value={form} key={form}>
          <AccordionTrigger>
            <span>{ANALYSIS_LABELS[form]}</span>
            <Badge variant="outline" className={styles.accordionBadge}>
              {state.analysisChecks.filter((check) => check.form === form && check.hasIssue).length}{" "}
              问题
            </Badge>
          </AccordionTrigger>
          <AccordionContent>
            <table className={styles.analysisTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>检查要求</th>
                  <th>发现问题</th>
                  <th>问题描述</th>
                  <th>位置</th>
                  <th>问题单号</th>
                </tr>
              </thead>
              <tbody>
                {state.analysisChecks
                  .filter((check) => check.form === form)
                  .map((check) => (
                    <tr key={check.id} data-issue={check.hasIssue ? "true" : undefined}>
                      <td>{check.seq}</td>
                      <td>{check.requirement}</td>
                      <td>
                        <Checkbox
                          checked={check.hasIssue}
                          aria-label={`第 ${check.seq} 项发现问题`}
                          onCheckedChange={(checked) =>
                            updateAnalysis(check.id, (next) => {
                              next.hasIssue = checked === true;
                            })
                          }
                        />
                      </td>
                      <td>
                        <Input
                          value={check.problem}
                          disabled={!check.hasIssue}
                          placeholder="问题描述"
                          aria-label={`第 ${check.seq} 项问题描述`}
                          onChange={(event) =>
                            updateAnalysis(check.id, (next) => {
                              next.problem = event.target.value;
                            })
                          }
                        />
                      </td>
                      <td>
                        <Input
                          value={check.location}
                          disabled={!check.hasIssue}
                          placeholder="位置"
                          aria-label={`第 ${check.seq} 项问题位置`}
                          onChange={(event) =>
                            updateAnalysis(check.id, (next) => {
                              next.location = event.target.value;
                            })
                          }
                        />
                      </td>
                      <td>
                        <Input
                          value={check.issueId}
                          disabled={!check.hasIssue}
                          placeholder="问题单号"
                          aria-label={`第 ${check.seq} 项问题单号`}
                          onChange={(event) =>
                            updateAnalysis(check.id, (next) => {
                              next.issueId = event.target.value;
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <Textarea
              value={form === "C3" ? state.c3Conclusion : state.c4Conclusion}
              placeholder={`${ANALYSIS_LABELS[form]}结论`}
              aria-label={`${ANALYSIS_LABELS[form]}结论`}
              minRows={2}
              onChange={(event) =>
                update((next) => {
                  if (form === "C3") next.c3Conclusion = event.target.value;
                  else next.c4Conclusion = event.target.value;
                })
              }
            />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
