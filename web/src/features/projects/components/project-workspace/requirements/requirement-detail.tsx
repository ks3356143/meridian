import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  CopyPlus,
  History,
  FileText,
  Link2,
  Loader2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryError, QueryLoading } from "@/components/shared/query-state";
import { MultiSelectCombobox } from "@/components/shared/multi-select-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Field, FieldError, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { requirementsApi } from "@/features/requirements/api";
import type {
  RequirementContent,
  RequirementBodyResponse,
  RequirementBlockNode,
  RequirementPrimaryKind,
  RequirementRecord,
  RequirementSource,
  SaveRequirementPayload,
} from "@/features/requirements/types";
import {
  getRequirementDraftErrors,
  getRequirementSecondaryKindOptions,
  isRequirementDraftValid,
  requirementKindOptions,
  requirementSourceLabel,
  type RequirementDraft,
} from "./requirement-form";
import { materializeAssetImages } from "./body/requirement-body-assets";
import type { RequirementBodyEditorHandle } from "./body/requirement-body-editor";
import styles from "./requirement-detail.module.css";

const LazyRequirementBody = lazy(() =>
  import("./body/requirement-body").then((module) => ({ default: module.RequirementBody })),
);
const LazyRequirementBodyEditor = lazy(() =>
  import("./body/requirement-body-editor").then((module) => ({
    default: module.RequirementBodyEditor,
  })),
);

type RequirementDetailProps = {
  requirement: RequirementRecord;
  projectCode: string;
  source?: RequirementSource;
  onUpdate: (
    id: string,
    payload: Omit<SaveRequirementPayload, "sourceVersionId">,
  ) => Promise<RequirementRecord | undefined>;
  onDelete: (requirement: RequirementRecord, hasUnsavedChanges: boolean) => void;
  onCopy: (requirement: RequirementRecord, draft: RequirementDraft) => void;
  onBodyDirtyChange?: (dirty: boolean) => void;
};

type RequirementDetailPayload =
  | { mode: "blocks"; body: RequirementBodyResponse }
  | { mode: "text"; body: RequirementBodyResponse; content: RequirementContent };

function requirementDetailBodyKey(requirementId: string) {
  return ["software-requirements", requirementId, "detail-body"] as const;
}

function requirementContentKey(requirementId: string) {
  return ["software-requirements", requirementId, "content"] as const;
}

function RequirementDetailImpl(props: RequirementDetailProps) {
  const { requirement } = props;
  const detailQuery = useQuery({
    queryKey: requirementDetailBodyKey(requirement.id),
    queryFn: async (): Promise<RequirementDetailPayload> => {
      const body = await requirementsApi.blocks(requirement.id);
      if (body.hasContent) return { mode: "blocks", body };
      const content = await requirementsApi.content(requirement.id);
      return { mode: "text", body, content };
    },
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });
  if (detailQuery.isPending && !detailQuery.data) {
    return (
      <div className={styles.loadingSlot} aria-busy="true" aria-label="需求详情加载中">
        <QueryLoading label="正在加载需求正文" rows={5} />
      </div>
    );
  }
  if (detailQuery.isError && !detailQuery.data) {
    return <QueryError title="需求正文加载失败" onRetry={() => void detailQuery.refetch()} />;
  }
  const detail = detailQuery.data;
  if (!detail) return null;
  const detailPending = detail.body.requirementId !== requirement.id;
  return (
    <RequirementDetailForm
      {...props}
      detail={detail}
      detailPending={detailPending}
      detailRefreshing={detailQuery.isFetching}
      detailError={detailQuery.isError ? "需求正文加载失败" : ""}
      onRetryDetail={() => void detailQuery.refetch()}
    />
  );
}

function RequirementDetailForm({
  requirement,
  source,
  projectCode,
  detail,
  detailPending,
  detailRefreshing,
  detailError,
  onRetryDetail,
  onUpdate,
  onDelete,
  onCopy,
  onBodyDirtyChange,
}: RequirementDetailProps & {
  detail: RequirementDetailPayload;
  detailPending: boolean;
  detailRefreshing: boolean;
  detailError: string;
  onRetryDetail: () => void;
}) {
  const queryClient = useQueryClient();
  const contentDescription =
    detail.mode === "text" ? detail.content.description : detail.body.plainText;
  const bodyBaselineDoc = useMemo(
    () => (detail.mode === "blocks" ? detail.body.doc : textToBodyDoc(contentDescription)),
    [contentDescription, detail.body.doc, detail.mode],
  );
  const hasBody = (bodyBaselineDoc.content?.length ?? 0) > 0;
  const [draft, setDraft] = useState(() => toDraft(requirement, contentDescription));
  const [baseline, setBaseline] = useState(() => toDraft(requirement, contentDescription));
  const [saveState, setSaveState] = useState<"saved" | "editing" | "saving" | "error">("saved");
  const [bodyEditBaselineDoc, setBodyEditBaselineDoc] = useState(() =>
    cloneBodyDoc(bodyBaselineDoc),
  );
  const [bodyDirty, setBodyDirty] = useState(false);
  const [bodyEditing, setBodyEditing] = useState(false);
  const [bodySaving, setBodySaving] = useState(false);
  const [bodyRefreshing, setBodyRefreshing] = useState(false);
  const [bodyError, setBodyError] = useState("");
  const [bodyDiscardOpen, setBodyDiscardOpen] = useState(false);
  const [bodyEditorMounted, setBodyEditorMounted] = useState(false);
  const [bodyEditorSession, setBodyEditorSession] = useState(0);
  const bodyDialogRef = useRef<HTMLDialogElement>(null);
  const bodyEditorHandleRef = useRef<RequirementBodyEditorHandle | null>(null);
  const bodyEditBaselineDocRef = useRef(bodyEditBaselineDoc);
  const bodyDirtyRef = useRef(false);
  const bodyEditingRef = useRef(false);
  const bodyBusyRef = useRef(false);
  const bodyCanSave =
    bodyEditing &&
    (bodyDirty || (detail.mode === "text" && (bodyEditBaselineDoc.content?.length ?? 0) > 0));
  const bodyBusy = bodySaving || bodyRefreshing;
  const bodyRefreshVisible = bodyRefreshing || detailRefreshing;

  useEffect(() => {
    bodyEditBaselineDocRef.current = bodyEditBaselineDoc;
  }, [bodyEditBaselineDoc]);
  useEffect(() => {
    bodyEditingRef.current = bodyEditing;
  }, [bodyEditing]);
  useEffect(() => {
    bodyBusyRef.current = bodyBusy;
  }, [bodyBusy]);
  useEffect(() => {
    if (!bodyDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [bodyDirty]);
  useEffect(() => {
    const dialog = bodyDialogRef.current;
    if (!dialog) return;
    if (bodyEditing && !dialog.open) {
      dialog.showModal();
    } else if (!bodyEditing && dialog.open) {
      dialog.close();
    }
  }, [bodyEditing]);
  const initializedDetailRef = useRef("");
  useEffect(() => {
    if (detailPending || detailError) return;
    if (initializedDetailRef.current === requirement.id) return;
    initializedDetailRef.current = requirement.id;
    const nextDraft = toDraft(requirement, contentDescription);
    const nextBodyBaseline = cloneBodyDoc(bodyBaselineDoc);
    setDraft(nextDraft);
    setBaseline(nextDraft);
    bodyEditBaselineDocRef.current = nextBodyBaseline;
    setBodyEditBaselineDoc(nextBodyBaseline);
    setBodyDirty(false);
    bodyDirtyRef.current = false;
    bodyEditingRef.current = false;
    bodyBusyRef.current = false;
    setSaveState("saved");
    setBodyEditing(false);
    setBodySaving(false);
    setBodyRefreshing(false);
    setBodyError("");
    setBodyDiscardOpen(false);
    onBodyDirtyChange?.(false);
  }, [
    bodyBaselineDoc,
    contentDescription,
    detailError,
    detailPending,
    onBodyDirtyChange,
    requirement,
  ]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  const kindLabel = requirementKindOptions.find(
    (option) => option.value === draft.primaryKind,
  )?.label;
  const secondaryKindLabels = draft.secondaryKinds.map(
    (kind) => requirementKindOptions.find((option) => option.value === kind)?.label ?? kind,
  );
  const incomplete = draft.description.trim() === "";
  const identifierPending =
    requirement.identifierAutoGenerated || requirement.externalIdentifier.trim() === "";
  const errors = getRequirementDraftErrors(draft);
  const status = dirty ? saveState : "saved";
  const lastModifiedAt = requirement.lastModifiedAt ? new Date(requirement.lastModifiedAt) : null;
  const lastModifiedLabel = requirement.lastModifiedAction === "create" ? "创建于" : "最近修改";
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
          secondaryKinds: draft.secondaryKinds,
          tags: requirement.tags,
        }),
        new Promise((resolve) => window.setTimeout(resolve, 500)),
      ]);
      if (updated) {
        const next = toDraft(updated, updated.description ?? draft.description);
        setBaseline(next);
        setDraft(next);
        const nextContent = {
          id: requirement.id,
          description: next.description,
          hasDescription: next.description.trim() !== "",
          updatedAt: updated.updatedAt,
        };
        queryClient.setQueryData(requirementContentKey(requirement.id), nextContent);
        if (detail.mode === "blocks") {
          queryClient.setQueryData(requirementDetailBodyKey(requirement.id), {
            mode: "blocks",
            body: {
              ...detail.body,
              plainText: next.description,
              hasContent: next.description.trim() !== "",
            },
          });
        } else {
          queryClient.setQueryData(requirementDetailBodyKey(requirement.id), {
            mode: "text",
            body: detail.body,
            content: nextContent,
          });
        }
      }
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [detail, dirty, draft, onUpdate, queryClient, requirement]);
  // ponytail: 首次编辑即标记 dirty，不逐键对比全文；用户改回原文也按 dirty 处理。
  const handleBodyChange = useCallback(() => {
    if (!bodyEditingRef.current || bodyBusyRef.current || bodyDirtyRef.current) return;
    bodyDirtyRef.current = true;
    setBodyDirty(true);
    onBodyDirtyChange?.(true);
  }, [onBodyDirtyChange]);

  const startBodyEditing = () => {
    const nextBaseline = cloneBodyDoc(bodyBaselineDoc);
    bodyEditBaselineDocRef.current = nextBaseline;
    setBodyEditBaselineDoc(nextBaseline);
    bodyDirtyRef.current = false;
    setBodyDirty(false);
    setBodyError("");
    setBodyEditorMounted(true);
    setBodyEditorSession((value) => value + 1);
    bodyEditingRef.current = true;
    setBodyEditing(true);
    onBodyDirtyChange?.(false);
  };

  const closeBodyEditor = () => {
    bodyDirtyRef.current = false;
    setBodyDirty(false);
    setBodyError("");
    bodyEditingRef.current = false;
    setBodyEditing(false);
    onBodyDirtyChange?.(false);
  };

  const discardBodyEditing = () => {
    setBodyDiscardOpen(false);
    closeBodyEditor();
  };

  const requestBodyDialogClose = (open: boolean) => {
    if (open) {
      setBodyEditing(true);
      return;
    }
    if (bodyBusy) return;
    if (bodyDirty) {
      setBodyDiscardOpen(true);
      return;
    }
    closeBodyEditor();
  };

  const handleBodyDialogCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    if (bodyBusy) {
      event.preventDefault();
      return;
    }
    if (!bodyDirty) return;
    event.preventDefault();
    setBodyDiscardOpen(true);
  };

  const handleBodyDialogClose = () => {
    if (!bodyEditingRef.current) return;
    closeBodyEditor();
  };

  const saveBody = async () => {
    if (!bodyCanSave || bodyBusy) return;
    bodyBusyRef.current = true;
    setBodySaving(true);
    setBodyError("");
    try {
      const currentDoc = bodyEditorHandleRef.current?.getDoc() ?? bodyEditBaselineDocRef.current;
      const [prepared] = await Promise.all([
        materializeAssetImages(currentDoc, projectCode),
        new Promise((resolve) => window.setTimeout(resolve, 450)),
      ]);
      const saved = await requirementsApi.saveBlocks(
        requirement.id,
        prepared,
        detail.body.origin,
        detail.body.authoringMode === "auto" ? "mixed" : detail.body.authoringMode,
      );
      const savedDoc = cloneBodyDoc(saved.doc);
      const nextContent = {
        id: requirement.id,
        description: saved.plainText,
        hasDescription: saved.plainText.trim() !== "",
        updatedAt: saved.updatedAt,
      };
      bodyEditBaselineDocRef.current = savedDoc;
      setBodyEditBaselineDoc(savedDoc);
      bodyDirtyRef.current = false;
      setBodyDirty(false);
      onBodyDirtyChange?.(false);
      setDraft((previous) => ({ ...previous, description: saved.plainText }));
      setBaseline((previous) => ({ ...previous, description: saved.plainText }));
      queryClient.setQueryData(requirementDetailBodyKey(requirement.id), {
        mode: "blocks",
        body: saved,
      });
      queryClient.setQueryData(requirementContentKey(requirement.id), nextContent);
      bodyEditingRef.current = false;
      setBodySaving(false);
      setBodyEditing(false);
      setBodyDiscardOpen(false);
      setBodyRefreshing(true);
      try {
        await queryClient.invalidateQueries({
          queryKey: requirementDetailBodyKey(requirement.id),
          refetchType: "active",
        });
      } catch {
        // 保存响应已经写入缓存；刷新失败不回滚，避免把成功保存误报为失败。
      }
    } catch (error) {
      setBodyError(error instanceof Error ? error.message : "正文保存失败");
    } finally {
      bodyBusyRef.current = false;
      setBodySaving(false);
      setBodyRefreshing(false);
    }
  };

  return (
    <section
      className={styles.shell}
      data-incomplete={incomplete ? "true" : undefined}
      aria-busy={detailPending ? true : undefined}
      aria-label="需求详情容器"
    >
      {detailPending || detailError ? (
        <div className={styles.detailLoadOverlay} aria-live="polite">
          {detailError ? (
            <QueryError title={detailError} onRetry={onRetryDetail} />
          ) : (
            <QueryLoading label="正在加载需求正文" rows={5} />
          )}
        </div>
      ) : null}
      <header className={styles.header}>
        <div className="min-w-0">
          <p className={styles.eyebrow}>
            {source ? `${requirementSourceLabel(source)}${source.version}` : "来源文档"}
          </p>
          <h3>
            §{draft.chapterNumber || requirement.chapterNumber} {draft.name || requirement.name}
          </h3>
          {lastModifiedAt && !Number.isNaN(lastModifiedAt.getTime()) ? (
            <p
              className={styles.auditHint}
              data-audit-action={requirement.lastModifiedAction === "create" ? "create" : "update"}
            >
              <History aria-hidden />
              <span>
                {lastModifiedLabel}：{requirement.lastModifiedByName || "系统"} ·{" "}
                {lastModifiedAt.toLocaleString("zh-CN")}
              </span>
            </p>
          ) : null}
        </div>
        <div className={styles.status}>
          <Badge variant="primary">已确认</Badge>
          {incomplete ? (
            <Badge variant="warning" className={styles.incompleteBadge}>
              <AlertTriangle aria-hidden />
              待补描述
            </Badge>
          ) : null}
          {identifierPending ? (
            <Badge variant="warning" className={styles.identifierBadge}>
              <Sparkles aria-hidden />
              待确认标识
            </Badge>
          ) : null}
          <Badge variant="outline">{kindLabel ?? "其他"}</Badge>
          {secondaryKindLabels.length ? (
            <Badge variant="outline">副类型：{secondaryKindLabels.join(" / ")}</Badge>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={styles.copyTrigger}
                aria-label="复制新增已确认需求"
                onClick={() => onCopy(requirement, draft)}
              >
                <CopyPlus data-icon="inline-start" aria-hidden />
                复制新增
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">复制新增已确认需求</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={styles.deleteTrigger}
                aria-label="删除已确认需求"
                onClick={() => onDelete(requirement, dirty)}
              >
                <Trash2 data-icon="inline-start" aria-hidden />
                删除
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">删除已确认需求</TooltipContent>
          </Tooltip>
          <span className={styles.statusChip} data-save-state={status} aria-live="polite">
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

      <div className={styles.body} onBlur={saveDraft}>
        <div className={styles.grid}>
          <Field data-invalid={errors.chapterNumber ? true : undefined}>
            <FieldLabel htmlFor="detail-chapter">
              章节号
              <span className={styles.requiredMark} aria-hidden>
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
            <FieldError id="detail-chapter-error">{errors.chapterNumber}</FieldError>
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
              <span className={styles.requiredMark} aria-hidden>
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
            <FieldError id="detail-name-error">{errors.name}</FieldError>
          </Field>
          <Field data-invalid={errors.primaryKind ? true : undefined}>
            <FieldLabel htmlFor="detail-kind">
              需求类型
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
                setSaveState("editing");
              }}
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
            <FieldError id="detail-kind-error">{errors.primaryKind}</FieldError>
          </Field>

          <Field className={styles.secondary}>
            <FieldLabel htmlFor="detail-secondary-kind">副类型</FieldLabel>
            <MultiSelectCombobox
              id="detail-secondary-kind"
              ariaLabel="编辑副类型"
              options={getRequirementSecondaryKindOptions(draft.primaryKind)}
              value={draft.secondaryKinds}
              onChange={(secondaryKinds) =>
                update(
                  "secondaryKinds",
                  secondaryKinds as ReturnType<typeof toDraft>["secondaryKinds"],
                )
              }
              placeholder="可选，多选"
              searchPlaceholder="搜索副类型"
              emptyText="没有匹配的副类型"
            />
            <FieldError id="detail-secondary-kind-error">{errors.secondaryKinds}</FieldError>
          </Field>
        </div>

        <section
          className={styles.descriptionCard}
          aria-busy={bodyRefreshVisible ? true : undefined}
          aria-label="测试项的需求描述"
        >
          <header className={styles.descriptionHeader}>
            <FieldTitle>测试项的需求描述</FieldTitle>
            <div className={styles.descriptionActions}>
              {bodyRefreshVisible ? (
                <span className={styles.descriptionRefresh} role="status" aria-live="polite">
                  <Loader2 aria-hidden />
                  正在刷新
                </span>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="default"
                sheen
                disabled={bodyRefreshVisible || bodyBusy}
                onClick={startBodyEditing}
              >
                编辑正文
              </Button>
            </div>
          </header>
          <div className={styles.descriptionBody} aria-busy={bodyRefreshVisible ? true : undefined}>
            {bodyRefreshVisible ? (
              <div className={styles.descriptionRefreshOverlay} role="status" aria-live="polite">
                <Loader2 aria-hidden />
                <span>正在刷新正文…</span>
              </div>
            ) : null}
            {hasBody ? (
              <Suspense
                fallback={
                  <div className={styles.bodyLoading}>
                    <QueryLoading label="正在加载正文" rows={4} />
                  </div>
                }
              >
                <LazyRequirementBody doc={bodyBaselineDoc} projectCode={projectCode} />
              </Suspense>
            ) : (
              <div className={styles.emptyBody}>
                <p>暂无正文内容，点击“编辑正文”录入。</p>
              </div>
            )}
          </div>
        </section>

        <dialog
          ref={bodyDialogRef}
          className={styles.bodyDialog}
          aria-labelledby="body-dialog-title"
          aria-busy={bodyBusy ? true : undefined}
          onCancel={handleBodyDialogCancel}
          onClose={handleBodyDialogClose}
        >
          <header className={styles.bodyDialogHeader}>
            <div className={styles.bodyDialogHeading}>
              <h2 id="body-dialog-title" className={styles.bodyDialogTitle}>
                编辑“测试项的需求描述”
              </h2>
              <p className={styles.bodyDialogDescription}>
                支持段落首行缩进与对齐、表格、多级有序列表和图片；其他 Word 格式会自动忽略。
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={styles.bodyDialogClose}
              aria-label="关闭正文编辑"
              title="关闭"
              disabled={bodyBusy}
              onClick={() => requestBodyDialogClose(false)}
            >
              <X aria-hidden />
            </Button>
          </header>
          {bodyError ? (
            <p className={styles.bodyDialogError} role="alert">
              {bodyError}
            </p>
          ) : null}
          <div className={styles.bodyDialogEditor}>
            {bodyEditorMounted ? (
              <Suspense
                fallback={
                  <div className={styles.bodyLoading}>
                    <QueryLoading label="正在加载正文编辑器" rows={4} />
                  </div>
                }
              >
                <LazyRequirementBodyEditor
                  doc={bodyEditBaselineDoc}
                  projectCode={projectCode}
                  session={bodyEditorSession}
                  focusOnOpen={bodyEditing}
                  busy={bodyBusy}
                  handleRef={bodyEditorHandleRef}
                  onChange={handleBodyChange}
                />
              </Suspense>
            ) : null}
          </div>
          <footer className={styles.bodyDialogFooter}>
            <Button
              type="button"
              variant="outline"
              disabled={bodyBusy}
              onClick={() => requestBodyDialogClose(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={!bodyCanSave || bodyBusy}
              onClick={() => void saveBody()}
            >
              {bodyBusy ? (
                <Loader2 data-icon="inline-start" className={styles.buttonSpinner} aria-hidden />
              ) : null}
              {bodySaving ? "保存中..." : bodyRefreshing ? "正在刷新..." : "保存正文"}
            </Button>
          </footer>
          {bodyDiscardOpen ? (
            <div
              className={styles.discardOverlay}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="body-discard-title"
            >
              <div className={styles.discardPanel}>
                <h3 id="body-discard-title">正文尚未保存</h3>
                <p>关闭后当前修改会丢失，确定要放弃吗？</p>
                <div className={styles.discardActions}>
                  <Button type="button" variant="outline" onClick={() => setBodyDiscardOpen(false)}>
                    继续编辑
                  </Button>
                  <Button type="button" variant="destructive" onClick={discardBodyEditing}>
                    放弃修改
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </dialog>

        <section className={styles.related}>
          <header>
            <div>
              <h4>
                <Link2 aria-hidden />
                关联测试项
              </h4>
              <p>测试项模块落地后在此维护多对多追踪关系。</p>
              {incomplete ? (
                <p className={styles.incompleteHint}>补全描述后才能关联测试项。</p>
              ) : null}
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

function textToBodyDoc(text: string): RequirementBlockNode {
  const paragraphs = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    type: "doc",
    content: paragraphs.map((line) => ({
      type: "paragraph",
      attrs: { firstLineIndent: 2 },
      content: [{ type: "text", text: line }],
    })),
  };
}

function cloneBodyDoc(doc: RequirementBlockNode): RequirementBlockNode {
  return JSON.parse(JSON.stringify(doc)) as RequirementBlockNode;
}

function toDraft(requirement: RequirementRecord, description: string) {
  return {
    chapterNumber: requirement.chapterNumber,
    externalIdentifier: requirement.externalIdentifier,
    name: requirement.name,
    description,
    primaryKind: requirement.primaryKind,
    secondaryKinds: requirement.secondaryKinds,
  };
}

export const RequirementDetail = memo(RequirementDetailImpl);
