import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  ImageOff,
  ImagePlus,
  MessageSquarePlus,
  Pencil,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { quickIssuesApi } from "@/features/quick-issues/api";
import type { QuickIssueNote } from "@/features/quick-issues/types";
import type { RequirementBlockNode } from "@/features/requirements/types";
import { requirementsApi } from "@/features/requirements/api";
import { RequirementBlocks } from "../requirements/body/requirement-body";
import styles from "./quick-issues-panel.module.css";

const MAX_NOTE_CHARS = 500;

export interface QuickIssueComposerRequest {
  nonce: number;
  stepId?: string;
  stepSeq?: number;
  note?: QuickIssueNote;
}

export function QuickIssuesPanel({
  caseId,
  projectCode,
  request,
  onRequest,
}: {
  caseId: string;
  projectCode: string;
  request: QuickIssueComposerRequest | null;
  onRequest: (request: QuickIssueComposerRequest | null) => void;
}) {
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<QuickIssueNote | null>(null);
  const notesQuery = useQuery({
    queryKey: ["test-cases", caseId, "quick-issues"],
    queryFn: () => quickIssuesApi.list(caseId),
  });
  const deleteMutation = useMutation({
    mutationFn: (noteId: string) => quickIssuesApi.delete(noteId),
    onSuccess: () => {
      toast.success("问题草稿已删除");
      setPendingDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["test-cases", caseId, "quick-issues"] });
    },
  });
  const notes = notesQuery.data ?? [];

  return (
    <>
      <section className={styles.panel} aria-label="快捷问题草稿">
        <header className={styles.header}>
          <div className={styles.heading}>
            <span className={styles.headingIcon} aria-hidden>
              <MessageSquarePlus />
            </span>
            <span>
              <strong>问题草稿</strong>
              <small>{notes.length > 0 ? `${notes.length} 条待整理` : "随手记，后续再整理"}</small>
            </span>
          </div>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => onRequest({ nonce: Date.now() })}
          >
            <MessageSquarePlus aria-hidden />
            记问题
          </Button>
        </header>

        {notesQuery.isPending ? (
          <div className={styles.state}>正在读取问题草稿…</div>
        ) : notesQuery.isError ? (
          <div className={styles.errorState}>
            问题草稿读取失败。
            <Button type="button" size="xs" variant="outline" onClick={() => notesQuery.refetch()}>
              重试
            </Button>
          </div>
        ) : notes.length === 0 ? (
          <div className={styles.emptyState}>
            <Camera aria-hidden />
            <span>还没有问题草稿。执行中可随手记一句话，并附一张截图。</span>
          </div>
        ) : (
          <div className={styles.list}>
            {notes.map((note) => (
              <article key={note.id} className={styles.note} data-own={note.canEdit || undefined}>
                <div className={styles.noteMeta}>
                  {note.stepSeq ? (
                    <span className={styles.stepChip}>第 {note.stepSeq} 步</span>
                  ) : null}
                  <span className={styles.author}>
                    <UserRound aria-hidden />
                    {note.createdByName || "未知成员"}
                  </span>
                  <time dateTime={note.createdAt}>{formatTime(note.createdAt)}</time>
                  {note.canEdit ? (
                    <span className={styles.ownChip}>自己的草稿</span>
                  ) : (
                    <span className={styles.readOnlyChip}>只读</span>
                  )}
                </div>
                <p className={styles.noteText}>{note.noteText}</p>
                {note.screenshotAssetId ? (
                  <div className={styles.screenshot}>
                    <RequirementBlocks
                      doc={screenshotDoc(note.screenshotAssetId)}
                      projectCode={projectCode}
                    />
                  </div>
                ) : null}
                {note.canEdit ? (
                  <div className={styles.noteActions}>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label="编辑问题草稿"
                      onClick={() => onRequest({ nonce: Date.now(), note })}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      className={styles.dangerButton}
                      aria-label="删除问题草稿"
                      onClick={() => setPendingDelete(note)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {request ? (
        <QuickIssueDialog
          key={`${request.nonce}-${request.note?.id ?? request.stepId ?? "case"}`}
          open
          caseId={caseId}
          projectCode={projectCode}
          request={request}
          onOpenChange={(open) => {
            if (!open) onRequest(null);
          }}
          onSaved={(savedNote) => {
            onRequest(null);
            queryClient.setQueryData<QuickIssueNote[]>(
              ["test-cases", caseId, "quick-issues"],
              (current = []) =>
                current.some((note) => note.id === savedNote.id)
                  ? current.map((note) => (note.id === savedNote.id ? savedNote : note))
                  : [savedNote, ...current],
            );
            void queryClient.invalidateQueries({
              queryKey: ["test-cases", caseId, "quick-issues"],
            });
          }}
        />
      ) : null}

      {pendingDelete ? (
        <AlertDialog open onOpenChange={(open) => (open ? undefined : setPendingDelete(null))}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除这条问题草稿？</AlertDialogTitle>
              <AlertDialogDescription>
                将删除“{truncate(pendingDelete.noteText, 60)}”。这不是正式问题单，删除后不可恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                className={styles.dangerAction}
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(pendingDelete.id)}
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}

function QuickIssueDialog({
  open,
  caseId,
  projectCode,
  request,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  caseId: string;
  projectCode: string;
  request: QuickIssueComposerRequest;
  onOpenChange: (open: boolean) => void;
  onSaved: (note: QuickIssueNote) => void;
}) {
  const fileInputId = useId();
  const originalAssetId = request.note?.screenshotAssetId ?? "";
  const [noteText, setNoteText] = useState(request.note?.noteText ?? "");
  const [screenshotAssetId, setScreenshotAssetId] = useState(originalAssetId);
  const [attempted, setAttempted] = useState(false);
  const charCount = Array.from(noteText).length;
  const remaining = MAX_NOTE_CHARS - charCount;
  const stepSeq = request.note?.stepSeq ?? request.stepSeq;
  const isEditing = Boolean(request.note);
  const uploadMutation = useMutation({
    mutationFn: (file: File) => requirementsApi.uploadAsset(projectCode, file),
    onSuccess: (asset) => {
      setScreenshotAssetId(asset.id);
      toast.success("截图已上传");
    },
  });
  const saveMutation = useMutation({
    mutationFn: async () => {
      const text = noteText.trim();
      if (isEditing && request.note) {
        return await quickIssuesApi.update(request.note.id, {
          noteText: text,
          ...(screenshotAssetId === originalAssetId
            ? {}
            : screenshotAssetId
              ? { screenshotAssetId }
              : { clearScreenshot: true }),
        });
      }
      return await quickIssuesApi.create(caseId, {
        noteText: text,
        ...(request.stepId ? { testCaseStepId: request.stepId } : {}),
        ...(screenshotAssetId ? { screenshotAssetId } : {}),
      });
    },
    onSuccess: (savedNote) => {
      toast.success(isEditing ? "问题草稿已更新" : "问题草稿已记录");
      onSaved(savedNote);
    },
  });
  const busy = uploadMutation.isPending || saveMutation.isPending;

  const changeNoteText = (value: string) => {
    setNoteText(Array.from(value).slice(0, MAX_NOTE_CHARS).join(""));
  };
  const submit = () => {
    setAttempted(true);
    if (noteText.trim() === "") {
      toast.error("请先填写一句问题描述");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && busy) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className={styles.dialog} aria-busy={busy || undefined}>
        <DialogHeader>
          <DialogTitle>{isEditing ? "编辑问题草稿" : "记一条问题"}</DialogTitle>
          <DialogDescription>
            {stepSeq ? `关联第 ${stepSeq} 步；` : "关联当前用例；"}
            草稿不进入正式问题统计，后续整理时再转成问题单。
          </DialogDescription>
        </DialogHeader>

        <label className={styles.field} htmlFor={`${fileInputId}-note`}>
          <span>
            一句话描述
            <small data-warning={remaining < 50 || undefined}>剩余 {remaining} 字</small>
          </span>
          <Textarea
            id={`${fileInputId}-note`}
            value={noteText}
            minRows={3}
            maxRows={6}
            placeholder="例如：参数查询页面偶发白屏，刷新后可恢复"
            aria-invalid={attempted && noteText.trim() === "" ? true : undefined}
            onChange={(event) => changeNoteText(event.target.value)}
          />
        </label>

        <div className={styles.screenshotField}>
          <div className={styles.screenshotHeading}>
            <span>截图（可选，一张）</span>
            {screenshotAssetId ? (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className={styles.dangerButton}
                onClick={() => setScreenshotAssetId("")}
              >
                移除截图
              </Button>
            ) : null}
          </div>
          {screenshotAssetId ? (
            <div className={styles.screenshotPreview}>
              <RequirementBlocks doc={screenshotDoc(screenshotAssetId)} projectCode={projectCode} />
            </div>
          ) : (
            <div className={styles.uploadEmpty}>
              <ImageOff aria-hidden />
              <span>没有截图</span>
            </div>
          )}
          <input
            id={fileInputId}
            className={styles.fileInput}
            type="file"
            tabIndex={-1}
            aria-hidden="true"
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadMutation.mutate(file);
              event.currentTarget.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => document.getElementById(fileInputId)?.click()}
          >
            <ImagePlus aria-hidden />
            {uploadMutation.isPending ? "正在上传…" : screenshotAssetId ? "替换截图" : "选择截图"}
          </Button>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saveMutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            disabled={busy || noteText.trim() === "" || remaining < 0}
            aria-busy={saveMutation.isPending || undefined}
            onClick={submit}
          >
            {saveMutation.isPending ? "正在保存…" : isEditing ? "保存修改" : "保存草稿"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function screenshotDoc(assetId: string): RequirementBlockNode {
  return {
    type: "doc",
    content: [{ type: "assetImage", attrs: { assetId } }],
  };
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function truncate(value: string, length: number) {
  const chars = Array.from(value);
  return chars.length > length ? `${chars.slice(0, length).join("")}…` : value;
}
