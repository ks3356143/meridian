import { useState } from "react";
import {
  Root as Collapsible,
  CollapsibleContent,
} from "@animate-ui/react/primitives/radix-ui/collapsible";
import { Fade } from "@animate-ui/react/primitives/effects/fade";
import { ChevronDown, ClipboardList, FileText } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requirementsApi } from "@/features/requirements/api";
import type {
  StaticReviewCheck,
  StaticReviewSheet,
  StaticState,
  StaticWorkbench,
} from "@/features/test-items/types";
import { checkStats } from "./static-dc-model";
import { DcSheetsTab } from "./static-dc-sheets";
import { DcDocsTab } from "./static-dc-docs";
import { IssueCreateDialog } from "./static-dc-issue-dialog";
import styles from "./static-workbench.module.css";
import dcStyles from "./static-dc.module.css";

type DcWorkbenchProps = {
  testItemId: string;
  projectCode: string;
  state: StaticState;
  catalog: StaticWorkbench["catalog"];
  update: (recipe: (draft: StaticState) => void) => void;
};

function sheetDocumentType(sheet: StaticReviewSheet) {
  if (sheet.documentType) return sheet.documentType;
  if (sheet.templateCode === "DC-KIT") return "齐套性";
  if (sheet.templateCode === "DC-SRS") return "需求规格说明";
  if (sheet.templateCode === "DC-DESIGN") return "详细设计";
  const name = sheetNameKey(sheet.name);
  if (name.includes("齐套")) return "齐套性";
  if (name.includes("需求规格")) return "需求规格说明";
  if (name.includes("用户手册")) return "用户手册";
  if (name.includes("任务书")) return "任务书";
  if (name.includes("概要设计")) return "概要设计";
  if (name.includes("设计")) return "详细设计";
  return "";
}

function sheetNameKey(name: string) {
  return name
    .trim()
    .replace(/审查单$/, "")
    .trim();
}

export function DcWorkbench({ testItemId, projectCode, state, catalog, update }: DcWorkbenchProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("docs");
  const [expandedSheets, setExpandedSheets] = useState<Set<string>>(new Set());
  const [openConfig, setOpenConfig] = useState(false);
  const [onlyFailsMode, setOnlyFailsMode] = useState(false);
  const [issueTarget, setIssueTarget] = useState<{
    sheet: StaticReviewSheet;
    check: StaticReviewCheck;
  } | null>(null);

  const allChecks = state.reviewSheets.flatMap((sheet) => sheet.checks);
  const stats = checkStats(allChecks);
  const missingDocs = catalog.documentOptions.filter(
    (name) => !state.documents.some((doc) => doc.name === name),
  );
  const sheetsWithFail = state.reviewSheets.filter((sheet) =>
    sheet.checks.some((check) => check.result === "failed"),
  );
  const sheetsWithoutTarget = state.reviewSheets.filter(
    (sheet) => !sheet.targetDocumentName?.trim(),
  );
  const configItems = [
    {
      ok:
        state.reviewSheets.length > 0 &&
        state.reviewSheets.every((sheet) => Boolean(sheetDocumentType(sheet))),
      label: "审查单已绑定文档类型",
      hint: "由设置页模板决定",
    },
    {
      ok: state.documents.length > 0,
      label: "受审文档 ≥ 1 项",
      hint: `当前 ${state.documents.length} 项`,
    },
    {
      ok: state.reviewSheets.length > 0,
      label: "审查单 ≥ 1 张",
      hint: `当前 ${state.reviewSheets.length} 张`,
    },
    {
      ok: sheetsWithoutTarget.length === 0,
      label: "审查单已指定受审文档",
      hint: sheetsWithoutTarget.length ? `差 ${sheetsWithoutTarget.length} 张` : "全部已指定",
    },
    {
      ok: sheetsWithFail.length > 0 || stats.reviewed === stats.total,
      label: "所有审查单已开始审查",
      hint: "默认全部通过，改出问题即可",
    },
    {
      ok: stats.reviewed === stats.total,
      label: "所有审查项已出结果",
      hint: `${stats.reviewed}/${stats.total}`,
    },
    { ok: stats.rate >= 80, label: "通过率 ≥ 80%", hint: `当前 ${stats.rate}%` },
  ];
  const configDone = configItems.filter((item) => item.ok).length;

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

  const addSheet = (template: StaticWorkbench["catalog"]["reviewSheets"][number]) => {
    const documentType = template.documentType?.trim() ?? "";
    update((next) => {
      next.reviewSheets.push({
        id: crypto.randomUUID(),
        templateCode: template.code,
        name: template.name,
        documentType,
        targetDocumentName: documentType,
        targetDocumentVersion:
          next.documentVersions?.[documentType] ?? template.documentVersion ?? "",
        checks: template.checks.map((check, index) => ({
          id: crypto.randomUUID(),
          seq: index + 1,
          category: check.category,
          title: check.title,
          requirement: check.requirement,
          basis: check.basis,
          practice: check.practice ?? "",
          goodPractice: check.goodPractice ?? "",
          badPractice: check.badPractice ?? "",
          result: "passed",
          notes: "",
          images: [],
          issueId: "",
          carriedFromPrevious: false,
          previousNote: "",
          previousImages: [],
        })),
      });
    });
  };

  const addDocuments = (names: string[]) => {
    if (!names.length) return;
    update((next) => {
      for (const name of names) {
        next.documents.push({
          id: crypto.randomUUID(),
          name,
          version: "",
          category: "GJB 438C",
          seq: next.documents.length + 1,
        });
      }
    });
  };

  const markAllPass = (sheet: StaticReviewSheet) =>
    updateSheet(sheet.id, (target) => {
      for (const check of target.checks) {
        check.result = "passed";
        check.notes = "";
        check.images = [];
      }
    });

  const uploadEvidence = async (
    sheet: StaticReviewSheet,
    check: StaticReviewCheck,
    files: FileList | null,
  ) => {
    if (!files?.length) return;
    const room = 9 - (check.images?.length ?? 0);
    if (room <= 0) {
      toast.error("每项最多 9 张截图");
      return;
    }
    const incoming = [...files].slice(0, room);
    const uploaded: string[] = [];
    for (const file of incoming) {
      try {
        const asset = await requirementsApi.uploadAsset(projectCode, file);
        uploaded.push(asset.id);
      } catch {
        toast.error(`上传 ${file.name} 失败`);
      }
    }
    if (uploaded.length) {
      updateCheck(sheet.id, check.id, (target) => {
        target.images = [...(target.images ?? []), ...uploaded];
      });
    }
  };

  const usedDocumentTypes = new Set(
    state.reviewSheets.map((sheet) => sheetDocumentType(sheet)).filter(Boolean),
  );
  const availableTemplates = catalog.reviewSheets.filter((template) => {
    const documentType = template.documentType?.trim() ?? "";
    return (
      Boolean(documentType) && documentType !== "齐套性" && !usedDocumentTypes.has(documentType)
    );
  });

  const sheetsCtx = {
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
    onCreateIssue: (sheet: StaticReviewSheet, check: StaticReviewCheck) =>
      setIssueTarget({ sheet, check }),
    update,
    markAllPass,
  };

  return (
    <div className={dcStyles.dcWrap}>
      <div className={`${styles.summaryStrip} ${dcStyles.dcSummary}`}>
        <div className={styles.summaryItem} data-tone="primary">
          <span>审查单</span>
          <strong>{state.reviewSheets.length}</strong>
        </div>
        <div className={styles.summaryItem} data-tone="info">
          <span>受审文档</span>
          <strong>{state.documents.length}</strong>
        </div>
        <div className={styles.summaryItem} data-tone={stats.fail ? "danger" : "success"}>
          <span>不通过</span>
          <strong>{stats.fail}</strong>
        </div>
        <button
          type="button"
          className={styles.summaryRate}
          data-tone={stats.fail ? "warning" : "success"}
          data-expanded={openConfig ? "true" : undefined}
          aria-expanded={openConfig}
          onClick={() => setOpenConfig((value) => !value)}
        >
          <span>
            配置 {configDone}/7 · 通过率 {stats.rate}%
          </span>
          <Progress
            value={stats.rate}
            className={styles.progress}
            data-tone={stats.fail ? "warning" : "success"}
          />
          <ChevronDown className={dcStyles.dcConfigChevron} aria-hidden />
        </button>
      </div>
      <Collapsible open={openConfig}>
        <CollapsibleContent>
          <div className={dcStyles.dcCollapseInner}>
            <div className={dcStyles.dcConfigHead}>
              <span>配置检查</span>
              <em>
                {configDone}/{configItems.length} 已满足
              </em>
            </div>
            <div className={dcStyles.dcConfigGrid}>
              {configItems.map((item, index) => (
                <Fade key={item.label} asChild delay={index * 0.026} initialOpacity={0.7}>
                  <div
                    className={dcStyles.dcConfigRow}
                    data-ok={item.ok ? "true" : undefined}
                    title={`${item.label}：${item.hint}`}
                  >
                    <span className={dcStyles.dcConfigIcon}>{item.ok ? "✓" : "●"}</span>
                    <span className={dcStyles.dcConfigLabel}>{item.label}</span>
                    <em>{item.hint}</em>
                  </div>
                </Fade>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="hud" className={dcStyles.dcTabs}>
          <TabsTrigger value="docs">
            <FileText aria-hidden />
            <span>受审文档</span>
            <em>{state.documents.length}</em>
          </TabsTrigger>
          <TabsTrigger value="sheets">
            <ClipboardList aria-hidden />
            <span>审查单</span>
            <em>{state.reviewSheets.length}</em>
          </TabsTrigger>
        </TabsList>

        <DcDocsTab
          state={state}
          missingDocs={missingDocs}
          addDocuments={addDocuments}
          update={update}
        />

        <DcSheetsTab ctx={sheetsCtx} />
      </Tabs>

      {issueTarget ? (
        <IssueCreateDialog
          projectCode={projectCode}
          testItemId={testItemId}
          sheet={issueTarget.sheet}
          check={issueTarget.check}
          onClose={() => setIssueTarget(null)}
          onCreated={() => {
            void queryClient.invalidateQueries({ queryKey: ["issues", projectCode] });
            setIssueTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}
