import { useState, type FormEvent } from "react";
import { toast } from "sonner";
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
import type {
  RequirementPrimaryKind,
  RequirementRecord,
  SaveRequirementPayload,
} from "@/features/requirements/types";
import {
  getRequirementDraftErrors,
  getRequirementSecondaryKindOptions,
  isRequirementDraftValid,
  requirementKindOptions,
  type RequirementDraft,
} from "./requirement-form";
import styles from "./requirement-candidate-edit-dialog.module.css";

export function RequirementCandidateEditDialog({
  requirement,
  submitting,
  onOpenChange,
  onUpdate,
}: {
  requirement: RequirementRecord | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (
    id: string,
    payload: Omit<SaveRequirementPayload, "sourceVersionId">,
  ) => Promise<RequirementRecord | undefined>;
}) {
  const [draft, setDraft] = useState<RequirementDraft>(() => toDraft(requirement));

  const errors = getRequirementDraftErrors(draft);
  const dirty =
    requirement !== null && JSON.stringify(draft) !== JSON.stringify(toDraft(requirement));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!requirement || submitting) return;
    if (!isRequirementDraftValid(draft)) {
      toast.error("请先修正候选需求表单错误");
      return;
    }

    try {
      await onUpdate(requirement.id, {
        sectionId: requirement.sectionId,
        chapterNumber: requirement.chapterNumber,
        externalIdentifier: draft.externalIdentifier.trim(),
        name: draft.name.trim(),
        description: draft.description.trim(),
        primaryKind: draft.primaryKind,
        secondaryKinds: draft.secondaryKinds,
        tags: requirement.tags,
      });
      toast.success("待确认需求已更新");
      onOpenChange(false);
    } catch {
      // API 客户端已展示后端错误，保留弹窗供用户继续修改。
    }
  }

  return (
    <Dialog open={requirement !== null} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialog}>
        <DialogHeader>
          <DialogTitle>修改待确认需求</DialogTitle>
          <DialogDescription>
            候选以原文章节为最小需求单元；章节号保持不变，可修改登记信息后确认。
          </DialogDescription>
        </DialogHeader>

        <form noValidate className={styles.form} onSubmit={submit}>
          <div className={styles.grid}>
            <Field>
              <FieldLabel htmlFor="candidate-chapter">章节号</FieldLabel>
              <Input
                id="candidate-chapter"
                value={draft.chapterNumber}
                readOnly
                className={styles.readonlyInput}
              />
            </Field>
            <Field data-invalid={errors.externalIdentifier ? true : undefined}>
              <FieldLabel htmlFor="candidate-identifier">外部标识</FieldLabel>
              <Input
                id="candidate-identifier"
                value={draft.externalIdentifier}
                autoComplete="off"
                maxLength={64}
                aria-invalid={errors.externalIdentifier ? true : undefined}
                onChange={(event) => update("externalIdentifier", event.target.value)}
              />
              <FieldError>{errors.externalIdentifier}</FieldError>
            </Field>
          </div>

          <Field data-invalid={errors.name ? true : undefined}>
            <FieldLabel htmlFor="candidate-name">
              名称
              <span className={styles.requiredMark} aria-hidden>
                *
              </span>
            </FieldLabel>
            <Input
              id="candidate-name"
              value={draft.name}
              autoComplete="off"
              maxLength={240}
              required
              aria-invalid={errors.name ? true : undefined}
              aria-required="true"
              aria-describedby={errors.name ? "candidate-name-error" : undefined}
              onChange={(event) => update("name", event.target.value)}
            />
            <FieldError id="candidate-name-error">{errors.name}</FieldError>
          </Field>

          <div className={styles.grid}>
            <Field data-invalid={errors.primaryKind ? true : undefined}>
              <FieldLabel htmlFor="candidate-primary-kind">
                主类型
                <span className={styles.requiredMark} aria-hidden>
                  *
                </span>
              </FieldLabel>
              <Select
                value={draft.primaryKind}
                onValueChange={(value) => {
                  const primaryKind = value as RequirementPrimaryKind;
                  setDraft((previous) => ({
                    ...previous,
                    primaryKind,
                    secondaryKinds: previous.secondaryKinds.filter((kind) => kind !== primaryKind),
                  }));
                }}
              >
                <SelectTrigger
                  id="candidate-primary-kind"
                  className="h-9"
                  aria-invalid={errors.primaryKind ? true : undefined}
                  aria-required="true"
                  aria-describedby={errors.primaryKind ? "candidate-primary-kind-error" : undefined}
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
              <FieldError id="candidate-primary-kind-error">{errors.primaryKind}</FieldError>
            </Field>

            <Field data-invalid={errors.secondaryKinds ? true : undefined}>
              <FieldLabel htmlFor="candidate-secondary-kind">副类型</FieldLabel>
              <MultiSelectCombobox
                id="candidate-secondary-kind"
                ariaLabel="选择副类型"
                options={getRequirementSecondaryKindOptions(draft.primaryKind)}
                value={draft.secondaryKinds}
                invalid={Boolean(errors.secondaryKinds)}
                onChange={(secondaryKinds) =>
                  update("secondaryKinds", secondaryKinds as RequirementPrimaryKind[])
                }
                placeholder="可选，多选"
              />
              <FieldError>{errors.secondaryKinds}</FieldError>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="candidate-description">描述</FieldLabel>
            <Textarea
              id="candidate-description"
              value={draft.description}
              minRows={5}
              maxRows={10}
              placeholder="保留原文描述；表格与图片暂以占位文本展示。"
              onChange={(event) => update("description", event.target.value)}
            />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={submitting || !dirty}>
              {submitting ? "保存中..." : "保存修改"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  function update<K extends keyof RequirementDraft>(key: K, value: RequirementDraft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
}

function toDraft(requirement: RequirementRecord | null): RequirementDraft {
  return {
    chapterNumber: requirement?.chapterNumber ?? "",
    externalIdentifier: requirement?.externalIdentifier ?? "",
    name: requirement?.name ?? "",
    description: requirement?.description ?? "",
    primaryKind: requirement?.primaryKind ?? "functional",
    secondaryKinds: requirement?.secondaryKinds ?? [],
  };
}
