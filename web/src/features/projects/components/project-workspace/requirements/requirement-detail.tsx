import { CheckCircle2, CloudUpload, FileText, Link2, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import type {
  RequirementPrimaryKind,
  RequirementRecord,
  RequirementSource,
  SaveRequirementPayload,
} from "@/features/requirements/types";
import {
  getRequirementDraftErrors,
  isRequirementDraftValid,
  requirementKindOptions,
  requirementSourceLabel,
} from "./requirement-form";

export function RequirementDetail({
  requirement,
  source,
  onUpdate,
}: {
  requirement: RequirementRecord;
  source?: RequirementSource;
  onUpdate: (
    id: string,
    payload: Omit<SaveRequirementPayload, "sourceVersionId">,
  ) => Promise<RequirementRecord | undefined>;
}) {
  const [draft, setDraft] = useState(() => toDraft(requirement));
  const [baseline, setBaseline] = useState(() => toDraft(requirement));
  const [saveState, setSaveState] = useState<"saved" | "editing" | "saving" | "error">("saved");
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  const kindLabel = requirementKindOptions.find(
    (option) => option.value === draft.primaryKind,
  )?.label;
  const errors = getRequirementDraftErrors(draft);
  const status = dirty ? saveState : "saved";
  const saveDraft = useCallback(async () => {
    if (!dirty || !isRequirementDraftValid(draft)) return;
    setSaveState("saving");
    try {
      const [updated] = await Promise.all([
        onUpdate(requirement.id, {
          sectionId: requirement.sectionId,
          chapterNumber: draft.chapterNumber.trim(),
          externalIdentifier: draft.externalIdentifier.trim(),
          name: draft.name.trim(),
          description: draft.description.trim(),
          primaryKind: draft.primaryKind,
          tags: requirement.tags,
        }),
        new Promise((resolve) => window.setTimeout(resolve, 500)),
      ]);
      if (updated) {
        const next = toDraft(updated);
        setBaseline(next);
        setDraft(next);
      }
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [dirty, draft, onUpdate, requirement]);

  return (
    <section className="requirements-detail-shell" aria-label="需求详情容器">
      <header className="requirement-detail-header">
        <div className="min-w-0">
          <p className="requirement-detail-eyebrow">
            {source ? `${requirementSourceLabel(source)}${source.version}` : "来源文档"}
          </p>
          <h3>
            §{draft.chapterNumber || requirement.chapterNumber} {draft.name || requirement.name}
          </h3>
        </div>
        <div className="requirement-detail-status">
          <Badge variant="primary">已确认</Badge>
          <Badge variant="outline">{kindLabel ?? "其他"}</Badge>
          <span data-save-state={status} aria-live="polite">
            {status === "saving" ? (
              <>
                <Loader2 aria-hidden />
                保存中
              </>
            ) : status === "error" ? (
              "保存失败"
            ) : status === "editing" ? (
              <>
                <CloudUpload aria-hidden />
                待自动保存
              </>
            ) : (
              <>
                <CheckCircle2 aria-hidden />
                已自动保存
              </>
            )}
          </span>
        </div>
      </header>

      <div className="requirement-detail-body" onBlur={saveDraft}>
        <div className="requirement-detail-grid">
          <Field data-invalid={errors.chapterNumber ? true : undefined}>
            <FieldLabel htmlFor="detail-chapter">
              章节号
              <span className="requirement-required-mark" aria-hidden>
                *
              </span>
            </FieldLabel>
            <Input
              id="detail-chapter"
              value={draft.chapterNumber}
              autoComplete="off"
              aria-invalid={errors.chapterNumber ? true : undefined}
              aria-required="true"
              aria-describedby={errors.chapterNumber ? "detail-chapter-error" : undefined}
              onChange={(event) => update("chapterNumber", event.target.value)}
            />
            {errors.chapterNumber ? (
              <FieldError id="detail-chapter-error">{errors.chapterNumber}</FieldError>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="detail-code">标识</FieldLabel>
            <Input
              id="detail-code"
              value={draft.externalIdentifier}
              autoComplete="off"
              onChange={(event) => update("externalIdentifier", event.target.value)}
            />
          </Field>
          <Field data-invalid={errors.name ? true : undefined}>
            <FieldLabel htmlFor="detail-name">
              名称
              <span className="requirement-required-mark" aria-hidden>
                *
              </span>
            </FieldLabel>
            <Input
              id="detail-name"
              value={draft.name}
              autoComplete="off"
              aria-invalid={errors.name ? true : undefined}
              aria-required="true"
              aria-describedby={errors.name ? "detail-name-error" : undefined}
              onChange={(event) => update("name", event.target.value)}
            />
            {errors.name ? <FieldError id="detail-name-error">{errors.name}</FieldError> : null}
          </Field>
          <Field data-invalid={errors.primaryKind ? true : undefined}>
            <FieldLabel htmlFor="detail-kind">
              需求类型
              <span className="requirement-required-mark" aria-hidden>
                *
              </span>
            </FieldLabel>
            <Select
              value={draft.primaryKind}
              onValueChange={(value) => update("primaryKind", value as RequirementPrimaryKind)}
            >
              <SelectTrigger
                id="detail-kind"
                className="h-8"
                aria-invalid={errors.primaryKind ? true : undefined}
                aria-required="true"
                aria-describedby={errors.primaryKind ? "detail-kind-error" : undefined}
              >
                <SelectValue placeholder="请选择" />
              </SelectTrigger>
              <SelectContent>
                {requirementKindOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.primaryKind ? (
              <FieldError id="detail-kind-error">{errors.primaryKind}</FieldError>
            ) : null}
          </Field>
        </div>

        <Field data-invalid={errors.description ? true : undefined}>
          <FieldLabel htmlFor="detail-description">
            描述
            <span className="requirement-required-mark" aria-hidden>
              *
            </span>
          </FieldLabel>
          <Textarea
            id="detail-description"
            value={draft.description}
            rows={9}
            aria-invalid={errors.description ? true : undefined}
            aria-required="true"
            aria-describedby={errors.description ? "detail-description-error" : undefined}
            onChange={(event) => update("description", event.target.value)}
          />
          {errors.description ? (
            <FieldError id="detail-description-error">{errors.description}</FieldError>
          ) : null}
          <p className="requirement-detail-hint">支持多行段落；表格与图片先保留原文占位。</p>
        </Field>

        <section className="requirement-related">
          <header>
            <div>
              <h4>
                <Link2 aria-hidden />
                关联测试项
              </h4>
              <p>测试项模块落地后在此维护多对多追踪关系。</p>
            </div>
            <Badge variant="outline">
              <FileText aria-hidden />
              待接入
            </Badge>
          </header>
        </section>
      </div>
    </section>
  );

  function update<K extends keyof ReturnType<typeof toDraft>>(
    key: K,
    value: ReturnType<typeof toDraft>[K],
  ) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setSaveState("editing");
  }
}

function toDraft(requirement: RequirementRecord) {
  return {
    chapterNumber: requirement.chapterNumber,
    externalIdentifier: requirement.externalIdentifier,
    name: requirement.name,
    description: requirement.description,
    primaryKind: requirement.primaryKind,
  };
}
