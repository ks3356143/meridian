import { Loader2, Replace } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { MultiSelectCombobox } from "@/components/shared/multi-select-combobox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  BulkUpdateRequirementPayload,
  RequirementPrimaryKind,
  RequirementRecord,
} from "@/features/requirements/types";
import { buildBulkPreview, type BulkPreviewRow } from "./requirement-bulk-preview";
import { requirementKindOptions } from "./requirement-form";
import styles from "./requirement-bulk-update-dialog.module.css";

const primaryKindLabels = new Map(
  requirementKindOptions.map((option) => [option.value, option.label]),
);

export function RequirementBulkUpdateDialog({
  open,
  requirements,
  allRequirements,
  submitting,
  error,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  requirements: RequirementRecord[];
  allRequirements: RequirementRecord[];
  submitting: boolean;
  error: Error | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: BulkUpdateRequirementPayload) => Promise<void>;
}) {
  const [primaryKind, setPrimaryKind] = useState<"keep" | RequirementPrimaryKind>("keep");
  const [modifySecondary, setModifySecondary] = useState(false);
  const [secondaryKinds, setSecondaryKinds] = useState<RequirementPrimaryKind[]>([]);
  const [find, setFind] = useState("");
  const [replacement, setReplacement] = useState("");
  const [applyToName, setApplyToName] = useState(true);
  const [applyToIdentifier, setApplyToIdentifier] = useState(false);
  const [findTouched, setFindTouched] = useState(false);
  const [targetTouched, setTargetTouched] = useState(false);
  const [secondaryTouched, setSecondaryTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function reset() {
    setPrimaryKind("keep");
    setModifySecondary(false);
    setSecondaryKinds([]);
    setFind("");
    setReplacement("");
    setApplyToName(true);
    setApplyToIdentifier(false);
    setFindTouched(false);
    setTargetTouched(false);
    setSecondaryTouched(false);
    setSubmitted(false);
  }

  function close() {
    if (submitting) return;
    reset();
    onOpenChange(false);
  }

  const replaceEnabled = find.trim() !== "" && (applyToName || applyToIdentifier);
  const nextPrimaryKind = primaryKind === "keep" ? null : primaryKind;
  const preview = useMemo(
    () =>
      buildBulkPreview({
        requirements,
        allRequirements,
        primaryKind: nextPrimaryKind,
        secondaryKinds: modifySecondary ? secondaryKinds : null,
        find: replaceEnabled ? find : "",
        replacement,
        applyToName,
        applyToIdentifier,
      }),
    [
      requirements,
      allRequirements,
      nextPrimaryKind,
      modifySecondary,
      secondaryKinds,
      replaceEnabled,
      find,
      replacement,
      applyToName,
      applyToIdentifier,
    ],
  );
  const changedRows = preview.filter((row) => row.changed);
  const conflictCount = preview.filter((row) => row.conflict).length;
  const replaceActive = find !== "" || replacement !== "";
  const findError = replaceActive && find.trim() === "" ? "启用查找替换时查找词必填" : undefined;
  const targetError =
    replaceActive && !applyToName && !applyToIdentifier ? "至少选择一个替换范围" : undefined;
  const secondaryInvalid =
    modifySecondary && preview.some((row) => row.secondaryKinds.includes(row.primaryKind));
  const secondaryError = secondaryInvalid ? "副类型不能与部分需求的新主类型相同" : undefined;
  const formValid = !findError && !targetError && !secondaryError;
  const visibleFindError = findTouched || submitted ? findError : undefined;
  const visibleTargetError = targetTouched || submitted ? targetError : undefined;
  const visibleSecondaryError = secondaryTouched || submitted ? secondaryError : undefined;
  const canSubmit = !submitting && formValid && changedRows.length > 0 && conflictCount === 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!canSubmit) return;

    try {
      await onSubmit({
        ids: requirements.map((requirement) => requirement.id),
        primaryKind: nextPrimaryKind ?? undefined,
        secondaryKinds: modifySecondary ? secondaryKinds : undefined,
        replace: replaceEnabled ? { find, replacement, applyToName, applyToIdentifier } : undefined,
      });
      reset();
    } catch {
      // 保持弹窗和当前输入，由错误区域展示失败原因。
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) onOpenChange(true);
        else close();
      }}
    >
      <DialogContent className={styles.dialog} showCloseButton={!submitting}>
        <DialogHeader>
          <DialogTitle>批量修改确认需求</DialogTitle>
          <DialogDescription>
            已选 {requirements.length} 条需求；预览确认后再应用，修改会写入需求审计。
          </DialogDescription>
        </DialogHeader>

        <form className={styles.form} noValidate onSubmit={submit}>
          <section className={styles.section} aria-label="修改属性">
            <h4>修改属性</h4>
            <div className={styles.attributeGrid}>
              <Field>
                <FieldLabel htmlFor="bulk-primary-kind">主类型</FieldLabel>
                <Select
                  value={primaryKind}
                  onValueChange={(value) =>
                    setPrimaryKind(value as "keep" | RequirementPrimaryKind)
                  }
                >
                  <SelectTrigger id="bulk-primary-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">不修改</SelectItem>
                    {requirementKindOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                data-invalid={visibleSecondaryError ? true : undefined}
                aria-describedby={visibleSecondaryError ? "bulk-secondary-error" : undefined}
              >
                <div className={styles.secondaryHead}>
                  <Checkbox
                    id="bulk-secondary-enabled"
                    checked={modifySecondary}
                    onCheckedChange={(value) => {
                      setModifySecondary(value === true);
                      setSecondaryTouched(true);
                    }}
                  />
                  <FieldLabel htmlFor="bulk-secondary-enabled">修改副类型</FieldLabel>
                </div>
                <MultiSelectCombobox
                  id="bulk-secondary-kind"
                  ariaLabel="选择副类型"
                  invalid={Boolean(visibleSecondaryError)}
                  options={requirementKindOptions.map((option) => ({
                    ...option,
                    disabled: !modifySecondary || option.value === nextPrimaryKind,
                  }))}
                  value={secondaryKinds}
                  onChange={(value) => {
                    setSecondaryKinds(value as RequirementPrimaryKind[]);
                    setSecondaryTouched(true);
                  }}
                  placeholder={modifySecondary ? "可选，多选" : "未启用"}
                  searchPlaceholder="搜索副类型"
                  emptyText="没有匹配的副类型"
                />
                <FieldError id="bulk-secondary-error">{visibleSecondaryError}</FieldError>
              </Field>
            </div>
          </section>

          <section className={styles.section} aria-label="查找替换">
            <h4>查找替换</h4>
            <div className={styles.replaceGrid}>
              <Field
                data-invalid={visibleFindError ? true : undefined}
                aria-describedby={visibleFindError ? "bulk-find-error" : undefined}
              >
                <FieldLabel htmlFor="bulk-find">
                  查找词
                  <span className={styles.requiredMark} aria-hidden>
                    *
                  </span>
                </FieldLabel>
                <Input
                  id="bulk-find"
                  value={find}
                  autoComplete="off"
                  placeholder={replaceActive ? "必填" : "启用替换时必填"}
                  aria-invalid={visibleFindError ? true : undefined}
                  aria-required={replaceActive ? true : undefined}
                  aria-describedby={visibleFindError ? "bulk-find-error" : undefined}
                  onBlur={() => setFindTouched(true)}
                  onChange={(event) => setFind(event.target.value)}
                />
                <FieldError id="bulk-find-error">{visibleFindError}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="bulk-replacement">替换词</FieldLabel>
                <Input
                  id="bulk-replacement"
                  value={replacement}
                  autoComplete="off"
                  placeholder="留空表示删除片段"
                  onChange={(event) => setReplacement(event.target.value)}
                />
              </Field>
            </div>
            <Field data-invalid={visibleTargetError ? true : undefined}>
              <div
                className={styles.replaceTargets}
                role="group"
                aria-label="替换范围"
                aria-describedby={visibleTargetError ? "bulk-target-error" : undefined}
              >
                <Checkbox
                  id="bulk-apply-name"
                  checked={applyToName}
                  onCheckedChange={(value) => {
                    setApplyToName(value === true);
                    setTargetTouched(true);
                  }}
                />
                <label className={styles.target} htmlFor="bulk-apply-name">
                  替换名称
                </label>
                <Checkbox
                  id="bulk-apply-identifier"
                  checked={applyToIdentifier}
                  onCheckedChange={(value) => {
                    setApplyToIdentifier(value === true);
                    setTargetTouched(true);
                  }}
                />
                <label className={styles.target} htmlFor="bulk-apply-identifier">
                  替换标识
                </label>
                <span className={styles.matchHint}>精确子串，区分大小写</span>
              </div>
              <FieldError id="bulk-target-error">{visibleTargetError}</FieldError>
            </Field>
          </section>

          <section className={styles.preview} aria-label="变更预览">
            <header>
              <h4>变更预览</h4>
              <span>
                {changedRows.length} 条变化
                {conflictCount > 0 ? `，${conflictCount} 条冲突` : ""}
              </span>
            </header>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>章节</TableHead>
                  <TableHead>标识</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>类型</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changedRows.map((row) => (
                  <TableRow key={row.requirement.id} data-conflict={row.conflict ?? undefined}>
                    <TableCell className={styles.chapter}>
                      {row.requirement.chapterNumber}
                    </TableCell>
                    <TableCell>
                      <ChangedText
                        value={row.requirement.externalIdentifier || "自动"}
                        next={row.identifier || "自动"}
                        find={find}
                        replacement={replacement}
                      />
                    </TableCell>
                    <TableCell className={styles.nameCell}>
                      <ChangedText
                        value={row.requirement.name}
                        next={row.name}
                        find={find}
                        replacement={replacement}
                      />
                    </TableCell>
                    <TableCell>
                      <ChangedKind row={row} />
                    </TableCell>
                  </TableRow>
                ))}
                {changedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className={styles.empty}>
                      当前设置不会改变任何需求
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            {conflictCount > 0 ? (
              <p role="alert" className={styles.conflictHint}>
                存在同版本名称或标识冲突，请调整替换词后再提交。
              </p>
            ) : null}
          </section>

          {error ? (
            <div role="alert" className={styles.error}>
              批量修改失败：{error.message}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={submitting} onClick={close}>
              取消
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? (
                <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
              ) : (
                <Replace data-icon="inline-start" aria-hidden />
              )}
              {submitting ? "应用中..." : `应用到 ${changedRows.length} 条需求`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChangedText({
  value,
  next,
  find,
  replacement,
}: {
  value: string;
  next: string;
  find: string;
  replacement: string;
}) {
  if (value === next) return <span className={styles.same}>{value}</span>;
  return (
    <span className={styles.changed}>
      {renderFragments(value, find, "old")}
      <span aria-hidden className={styles.arrow}>
        →
      </span>
      {renderFragments(next, replacement, "next")}
    </span>
  );
}

function ChangedKind({ row }: { row: BulkPreviewRow }) {
  const before = [
    primaryKindLabels.get(row.requirement.primaryKind) ?? row.requirement.primaryKind,
    ...row.requirement.secondaryKinds.map((kind) => primaryKindLabels.get(kind) ?? kind),
  ];
  const after = [
    primaryKindLabels.get(row.primaryKind) ?? row.primaryKind,
    ...row.secondaryKinds.map((kind) => primaryKindLabels.get(kind) ?? kind),
  ];
  const secondaryDiff = row.secondaryKinds.join(",") !== row.requirement.secondaryKinds.join(",");
  if (row.primaryKind === row.requirement.primaryKind && !secondaryDiff) {
    return <span className={styles.same}>{before.join("、") || "无"}</span>;
  }
  return (
    <span className={styles.changed}>
      <s>{before.join("、") || "无"}</s>
      <span aria-hidden className={styles.arrow}>
        →
      </span>
      <span className={styles.added}>{after.join("、") || "无"}</span>
    </span>
  );
}

function renderFragments(value: string, keyword: string, tone: "old" | "next"): ReactNode {
  if (!keyword || !value.includes(keyword)) return <>{value}</>;
  return value.split(keyword).map((part, index, parts) => (
    <span key={`${part}-${index}`}>
      {part}
      {index < parts.length - 1 ? (
        tone === "old" ? (
          <s className={styles.removed}>{keyword}</s>
        ) : (
          <span className={styles.added}>{keyword}</span>
        )
      ) : null}
    </span>
  ));
}
