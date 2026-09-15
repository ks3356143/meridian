import { ClipboardPaste, Loader2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { RequirementPrimaryKind, RequirementSection } from "@/features/requirements/types";
import { parseBulkLines } from "./requirement-model";

export function BatchRequirementDialog({
  open,
  sections,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  sections: RequirementSection[];
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: {
    items: Array<{
      nodeType: "section" | "requirement";
      chapterNumber: string;
      title?: string;
      name?: string;
      description?: string;
      primaryKind?: RequirementPrimaryKind;
    }>;
  }) => Promise<unknown>;
}) {
  const [content, setContent] = useState("");
  const [chapterConfirmed, setChapterConfirmed] = useState(false);
  const parsed = useMemo(() => parseBulkLines(content), [content]);
  const existingChapters = useMemo(
    () => new Set(sections.map((section) => section.chapterNumber)),
    [sections],
  );
  const inputChapters = useMemo(
    () => new Set(parsed.filter((item) => !item.error).map((item) => item.chapterNumber)),
    [parsed],
  );
  const rows = useMemo(
    () =>
      parsed.map((item) => {
        const parts = item.chapterNumber.split(".");
        parts.pop();
        const parent = parts.join(".");
        const parentMissing = item.error
          ? false
          : Boolean(parent) && !existingChapters.has(parent) && !inputChapters.has(parent);
        return {
          ...item,
          parentMissing,
          error: item.error ?? (parentMissing ? `父章节 ${parent} 不存在` : undefined),
        };
      }),
    [existingChapters, inputChapters, parsed],
  );
  const invalidCount = rows.filter((row) => row.error).length;
  const submitDisabled = invalidCount > 0 || rows.length === 0 || !chapterConfirmed || submitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>批量粘贴需求结构</DialogTitle>
          <DialogDescription>
            支持“章节号 名称”建立章节，或“章节号 名称 主性质”建立需求；也可以用竖线追加描述。
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="batch-requirements">粘贴内容</FieldLabel>
          <Textarea
            id="batch-requirements"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={7}
            className="font-mono text-xs"
            placeholder={
              "3 功能需求\n3.1 数据处理 功能需求\n3.2 处理时间 性能需求 | 处理延迟应不高于200ms"
            }
          />
          <FieldDescription>
            预览确认后才入库；描述为空的需求会先记录测试项待补描述，不会自动创建测试项。
          </FieldDescription>
        </Field>

        <div className="requirement-batch-preview" aria-live="polite">
          <div className="requirement-batch-preview-header">
            <span>解析预览</span>
            <span>
              {rows.length} 行 · {rows.length - invalidCount} 可入库 · {invalidCount} 需修正
            </span>
          </div>
          {rows.length ? (
            <div className="requirement-batch-rows">
              {rows.map((row) => (
                <div
                  key={row.line}
                  className="requirement-batch-row"
                  data-invalid={row.error ? "true" : undefined}
                >
                  <span className="font-mono">{row.line}</span>
                  <span className="font-mono">{row.chapterNumber || "--"}</span>
                  <span className="truncate">{row.title || "--"}</span>
                  <Badge variant={row.nodeType === "requirement" ? "primary" : "secondary"}>
                    {row.nodeType === "requirement" ? "需求" : "章节"}
                  </Badge>
                  {row.error ? <span className="text-destructive">{row.error}</span> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="requirement-batch-empty">
              <ClipboardPaste aria-hidden />
              粘贴后这里显示解析结果
            </div>
          )}
        </div>

        <div className="requirement-batch-confirm">
          <Checkbox
            id="batch-chapter-confirmed"
            checked={chapterConfirmed}
            onCheckedChange={(checked) => setChapterConfirmed(Boolean(checked))}
          />
          <label htmlFor="batch-chapter-confirmed">我已核对预览中的章节号与 SRS 实际章节一致</label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={submitDisabled}
            onClick={() => {
              if (submitDisabled) return;
              void onSubmit({
                items: rows
                  .filter((row) => !row.error)
                  .map((row) => ({
                    nodeType: row.nodeType,
                    chapterNumber: row.chapterNumber,
                    title: row.nodeType === "section" ? row.title : undefined,
                    name: row.nodeType === "requirement" ? row.title : undefined,
                    description: row.description,
                    primaryKind: row.nodeType === "requirement" ? row.primaryKind : undefined,
                  })),
              }).then(() => {
                setContent("");
                setChapterConfirmed(false);
                onOpenChange(false);
              });
            }}
          >
            {submitting ? (
              <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
            ) : (
              <Upload data-icon="inline-start" aria-hidden />
            )}
            确认入库
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
