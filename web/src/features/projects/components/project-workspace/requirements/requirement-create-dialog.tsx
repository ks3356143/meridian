import { Info, Loader2, Plus, Save } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { MultiSelectCombobox } from "@/components/shared/multi-select-combobox";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  RequirementPrimaryKind,
  RequirementRecord,
  RequirementSource,
  SaveRequirementPayload,
} from "@/features/requirements/types";
import {
  getRequirementDraftErrors,
  getRequirementSecondaryKindOptions,
  requirementKindOptions,
  requirementSourceLabel,
  type RequirementDraft,
  findActiveChapterConflict,
  suggestNextChapterNumber,
} from "./requirement-form";
import styles from "./requirement-create-dialog.module.css";

type CreateRequirementValues = RequirementDraft & {
  sourceId: string;
  tags: string[];
};

export type RequirementCreateInitialValues = CreateRequirementValues;

type TouchedRequirementFields = Record<
  "sourceId" | "chapterNumber" | "name" | "primaryKind" | "secondaryKinds",
  boolean
>;

export function RequirementCreateDialog({
  open,
  sources,
  requirements,
  initialValues = null,
  chapterSeedRequirement = null,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  sources: RequirementSource[];
  requirements: RequirementRecord[];
  initialValues?: RequirementCreateInitialValues | null;
  chapterSeedRequirement?: RequirementRecord | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: SaveRequirementPayload) => Promise<RequirementRecord>;
}) {
  const sourceId = chapterSeedRequirement?.sourceVersionId ?? sources[0]?.id ?? "";
  const chapterSuggestion = chapterSeedRequirement
    ? suggestNextChapterNumber(
        chapterSeedRequirement.chapterNumber,
        requirements,
        chapterSeedRequirement.sourceVersionId,
      )
    : "";
  const [values, setValues] = useState<CreateRequirementValues>(
    () => initialValues ?? emptyValues(sources, sourceId, chapterSuggestion),
  );
  const [touched, setTouched] = useState<TouchedRequirementFields>(() => emptyTouched());
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const chapterConflict = findActiveChapterConflict(
    values.chapterNumber,
    values.sourceId,
    requirements,
  );
  const draftErrors = getRequirementDraftErrors(values);
  const errors = {
    sourceId: values.sourceId ? undefined : "来源文档必填",
    ...draftErrors,
    chapterNumber:
      draftErrors.chapterNumber ??
      (chapterConflict
        ? `章节号已被 §${chapterConflict.chapterNumber} ${chapterConflict.name} 使用`
        : undefined),
  };
  const valid = Object.values(errors).every((error) => !error);

  const wasOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (!open || wasOpen) return;

    setValues(initialValues ?? emptyValues(sources, sourceId, chapterSuggestion));
    setTouched(emptyTouched());
    setSubmitted(false);
    // 只在关闭 -> 打开时重置；保存并沿用期间不覆盖表单。
  }, [chapterSuggestion, initialValues, open, sourceId, sources]);

  function close() {
    reset();
    onOpenChange(false);
  }

  function reset() {
    setValues(initialValues ?? emptyValues(sources, sourceId, chapterSuggestion));
    setTouched(emptyTouched());
    setSubmitted(false);
  }

  function touch(field: keyof TouchedRequirementFields) {
    setTouched((previous) => ({ ...previous, [field]: true }));
  }

  function visibleError(field: keyof TouchedRequirementFields) {
    return touched[field] || submitted ? errors[field] : undefined;
  }

  const visibleChapterError =
    visibleError("chapterNumber") ??
    (chapterConflict
      ? `章节号已被 §${chapterConflict.chapterNumber} ${chapterConflict.name} 使用`
      : undefined);

  function update<K extends keyof CreateRequirementValues>(
    field: K,
    value: CreateRequirementValues[K],
  ) {
    setValues((previous) => ({ ...previous, [field]: value }));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!event.ctrlKey && !event.metaKey) return;
    if (event.key !== "Enter" || submitting) return;

    event.preventDefault();
    formRef.current?.requestSubmit(continueButtonRef.current);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!valid) return;

    const source = sources.find((item) => item.id === values.sourceId);
    if (!source) return;

    const created = await onSubmit({
      sourceVersionId: source.id,
      chapterNumber: values.chapterNumber.trim(),
      externalIdentifier: values.externalIdentifier.trim(),
      name: values.name.trim(),
      description: values.description.trim(),
      primaryKind: values.primaryKind,
      secondaryKinds: values.secondaryKinds,
      tags: values.tags,
    });
    const nativeEvent = event.nativeEvent as SubmitEvent;
    const continueAfterSave =
      nativeEvent.submitter instanceof HTMLButtonElement &&
      nativeEvent.submitter.value === "continue";

    if (continueAfterSave) {
      const nextChapterNumber = suggestNextChapterNumber(
        created.chapterNumber,
        requirements,
        created.sourceVersionId,
      );
      setValues({
        sourceId: source.id,
        chapterNumber: nextChapterNumber,
        externalIdentifier: "",
        name: "",
        description: "",
        primaryKind: values.primaryKind,
        secondaryKinds: values.secondaryKinds,
        tags: [],
      });
      setTouched(emptyTouched());
      setSubmitted(false);
      nameInputRef.current?.focus();
      return created;
    }

    reset();
    onOpenChange(false);
    return created;
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>{initialValues ? "复制新增确认需求" : "新增确认需求"}</DialogTitle>
          <DialogDescription>
            {initialValues
              ? "已继承原需求的登记信息，请确认章节号和名称后保存。"
              : chapterSuggestion
                ? `已按当前需求预填章节号 ${chapterSuggestion}；需要连续录入时使用“保存并沿用”。`
                : "保存后直接进入确认需求基线；需要连续录入时使用“保存并沿用”。"}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" noValidate onSubmit={submit} ref={formRef}>
          <div className={styles.grid}>
            <Field data-invalid={visibleError("sourceId") ? true : undefined}>
              <FieldLabel htmlFor="requirement-source">
                来源文档
                <span className={styles.requiredMark} aria-hidden>
                  *
                </span>
              </FieldLabel>
              <Select value={values.sourceId} onValueChange={(value) => update("sourceId", value)}>
                <SelectTrigger
                  id="requirement-source"
                  className="h-8"
                  aria-invalid={visibleError("sourceId") ? true : undefined}
                  aria-required="true"
                  aria-describedby={
                    visibleError("sourceId") ? "requirement-source-error" : undefined
                  }
                  onBlur={() => touch("sourceId")}
                >
                  <SelectValue placeholder="选择来源文档" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((source) => (
                    <SelectItem key={source.id} value={source.id}>
                      {requirementSourceLabel(source)}
                      {source.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError id="requirement-source-error">{visibleError("sourceId")}</FieldError>
            </Field>

            <Field data-invalid={visibleChapterError ? true : undefined}>
              <FieldLabel htmlFor="requirement-chapter">
                章节号
                <span className={styles.requiredMark} aria-hidden>
                  *
                </span>
              </FieldLabel>
              <Input
                id="requirement-chapter"
                value={values.chapterNumber}
                autoComplete="off"
                placeholder={chapterSuggestion || "例如 4.4"}
                aria-invalid={visibleChapterError ? true : undefined}
                aria-required="true"
                aria-describedby={visibleChapterError ? "requirement-chapter-error" : undefined}
                onBlur={() => touch("chapterNumber")}
                onChange={(event) => update("chapterNumber", event.target.value)}
              />
              <FieldError id="requirement-chapter-error">{visibleChapterError}</FieldError>
            </Field>

            <Field>
              <div className={styles.labelRow}>
                <FieldLabel htmlFor="requirement-code">标识</FieldLabel>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className={styles.codeHint} aria-label="标识填写说明">
                      <Info aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className={styles.codeTooltip}>
                    默认使用名称拼音首字母四位；同版本内不重复。
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="requirement-code"
                value={values.externalIdentifier}
                autoComplete="off"
                placeholder="留空自动生成"
                onChange={(event) => update("externalIdentifier", event.target.value)}
              />
            </Field>

            <Field className={styles.name} data-invalid={visibleError("name") ? true : undefined}>
              <FieldLabel htmlFor="requirement-name">
                名称
                <span className={styles.requiredMark} aria-hidden>
                  *
                </span>
              </FieldLabel>
              <Input
                id="requirement-name"
                ref={nameInputRef}
                value={values.name}
                autoComplete="off"
                placeholder="例如 指令准确率性能测试"
                aria-invalid={visibleError("name") ? true : undefined}
                aria-required="true"
                aria-describedby={visibleError("name") ? "requirement-name-error" : undefined}
                onBlur={() => touch("name")}
                onChange={(event) => update("name", event.target.value)}
              />
              <FieldError id="requirement-name-error">{visibleError("name")}</FieldError>
            </Field>

            <Field data-invalid={visibleError("primaryKind") ? true : undefined}>
              <FieldLabel htmlFor="requirement-kind">
                需求类型
                <span className={styles.requiredMark} aria-hidden>
                  *
                </span>
              </FieldLabel>
              <Select
                value={values.primaryKind}
                onValueChange={(value) => {
                  const primaryKind = value as RequirementPrimaryKind;
                  setValues((previous) => ({
                    ...previous,
                    primaryKind,
                    secondaryKinds: previous.secondaryKinds.filter((kind) => kind !== primaryKind),
                  }));
                }}
              >
                <SelectTrigger
                  id="requirement-kind"
                  className="h-8"
                  aria-invalid={visibleError("primaryKind") ? true : undefined}
                  aria-required="true"
                  aria-describedby={
                    visibleError("primaryKind") ? "requirement-kind-error" : undefined
                  }
                  onBlur={() => touch("primaryKind")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {requirementKindOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError id="requirement-kind-error">{visibleError("primaryKind")}</FieldError>
            </Field>

            <Field className={styles.secondary}>
              <FieldLabel htmlFor="requirement-secondary-kind">副类型</FieldLabel>
              <MultiSelectCombobox
                id="requirement-secondary-kind"
                ariaLabel="选择副类型"
                options={getRequirementSecondaryKindOptions(values.primaryKind)}
                value={values.secondaryKinds}
                onChange={(secondaryKinds) =>
                  update(
                    "secondaryKinds",
                    secondaryKinds as CreateRequirementValues["secondaryKinds"],
                  )
                }
                placeholder="可选，多选"
                searchPlaceholder="搜索副类型"
                emptyText="没有匹配的副类型"
              />
              <FieldError id="requirement-secondary-kind-error">
                {visibleError("secondaryKinds")}
              </FieldError>
            </Field>

            <Field className={styles.span}>
              <FieldLabel htmlFor="requirement-description">描述（可留空）</FieldLabel>
              <Textarea
                id="requirement-description"
                value={values.description}
                minRows={5}
                maxRows={12}
                placeholder="留空保存为待补描述；补全前不能关联测试项。"
                aria-describedby="requirement-description-hint"
                onChange={(event) => update("description", event.target.value)}
              />
              <p id="requirement-description-hint" className={styles.descriptionHint}>
                空描述需求会显示“待补描述”，补全后才能进入测试项链路。
              </p>
            </Field>
          </div>

          <DialogFooter className="flex-wrap">
            <Button type="button" variant="outline" onClick={close}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
              ) : (
                <Save data-icon="inline-start" aria-hidden />
              )}
              保存
            </Button>
            <Button
              ref={continueButtonRef}
              type="submit"
              value="continue"
              aria-keyshortcuts="Control+Enter Meta+Enter"
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
              ) : (
                <Plus data-icon="inline-start" aria-hidden />
              )}
              保存并沿用
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function emptyValues(
  sources: RequirementSource[],
  sourceId: string,
  chapterNumber: string,
): CreateRequirementValues {
  return {
    sourceId: sources.some((source) => source.id === sourceId) ? sourceId : (sources[0]?.id ?? ""),
    chapterNumber,
    externalIdentifier: "",
    name: "",
    description: "",
    primaryKind: "functional",
    secondaryKinds: [],
    tags: [],
  };
}

function emptyTouched(): TouchedRequirementFields {
  return {
    sourceId: false,
    chapterNumber: false,
    name: false,
    primaryKind: false,
    secondaryKinds: false,
  };
}
