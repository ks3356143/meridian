import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { requirementsApi } from "@/features/requirements/api";
import type {
  RequirementContent,
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

type RequirementCandidateEditDialogProps = {
  requirement: RequirementRecord | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (
    id: string,
    payload: Omit<SaveRequirementPayload, "sourceVersionId">,
  ) => Promise<RequirementRecord | undefined>;
};

export function RequirementCandidateEditDialog({
  requirement,
  submitting,
  onOpenChange,
  onUpdate,
}: RequirementCandidateEditDialogProps) {
  const contentQuery = useQuery({
    queryKey: ["software-requirements", requirement?.id ?? "", "content"],
    queryFn: () => {
      if (!requirement) throw new Error("缺少需求 id");
      return requirementsApi.content(requirement.id);
    },
    enabled: requirement !== null,
    staleTime: 5 * 60 * 1000,
  });
  const content =
    requirement && contentQuery.data?.id === requirement.id ? contentQuery.data : undefined;

  return (
    <Dialog open={requirement !== null} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialog}>
        <DialogHeader>
          <DialogTitle>修改待确认需求</DialogTitle>
          <DialogDescription>
            候选以原文章节为最小需求单元；章节号保持不变，可修改登记信息后确认。
          </DialogDescription>
        </DialogHeader>

        {contentQuery.isError ? (
          <div className={styles.loadError} role="alert">
            <p>需求正文加载失败，请重试。</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void contentQuery.refetch()}
            >
              重新加载
            </Button>
          </div>
        ) : requirement && content ? (
          <CandidateEditForm
            key={requirement.id}
            content={content}
            onOpenChange={onOpenChange}
            onUpdate={onUpdate}
            requirement={requirement}
            submitting={submitting}
          />
        ) : (
          <div className={styles.loadingSlot} aria-busy="true" aria-label="正在加载需求正文">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CandidateEditForm({
  requirement,
  content,
  submitting,
  onOpenChange,
  onUpdate,
}: {
  requirement: RequirementRecord;
  content: RequirementContent;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (
    id: string,
    payload: Omit<SaveRequirementPayload, "sourceVersionId">,
  ) => Promise<RequirementRecord | undefined>;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<RequirementDraft>(() =>
    toDraft(requirement, content.description),
  );
  const [baseline, setBaseline] = useState<RequirementDraft>(() =>
    toDraft(requirement, content.description),
  );
  const errors = getRequirementDraftErrors(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !dirty) return;
    if (!isRequirementDraftValid(draft)) {
      toast.error("请先修正候选需求表单错误");
      return;
    }

    try {
      const updated = await onUpdate(requirement.id, {
        sectionId: requirement.sectionId,
        chapterNumber: requirement.chapterNumber,
        externalIdentifier: draft.externalIdentifier.trim(),
        name: draft.name.trim(),
        description: draft.description.trim(),
        primaryKind: draft.primaryKind,
        secondaryKinds: draft.secondaryKinds,
        tags: requirement.tags,
      });
      const nextDescription = updated?.description ?? draft.description;
      setBaseline(toDraft(updated ?? requirement, nextDescription));
      queryClient.setQueryData(["software-requirements", requirement.id, "content"], {
        id: requirement.id,
        description: nextDescription,
        hasDescription: nextDescription.trim() !== "",
        updatedAt: updated?.updatedAt ?? content.updatedAt,
      });
      toast.success("待确认需求已更新");
      onOpenChange(false);
    } catch {
      // API 客户端已展示后端错误，保留弹窗供用户继续修改。
    }
  }

  return (
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
  );

  function update<K extends keyof RequirementDraft>(key: K, value: RequirementDraft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
}

function toDraft(requirement: RequirementRecord | null, description: string): RequirementDraft {
  return {
    chapterNumber: requirement?.chapterNumber ?? "",
    externalIdentifier: requirement?.externalIdentifier ?? "",
    name: requirement?.name ?? "",
    description,
    primaryKind: requirement?.primaryKind ?? "functional",
    secondaryKinds: requirement?.secondaryKinds ?? [],
  };
}
