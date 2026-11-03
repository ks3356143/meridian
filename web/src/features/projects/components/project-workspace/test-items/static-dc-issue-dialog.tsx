import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { issuesApi } from "@/features/test-items/api";
import type { Issue, StaticReviewCheck, StaticReviewSheet } from "@/features/test-items/types";

export function IssueCreateDialog({
  projectCode,
  testItemId,
  sheet,
  check,
  onClose,
  onCreated,
}: {
  projectCode: string;
  testItemId: string;
  sheet: StaticReviewSheet;
  check: StaticReviewCheck;
  onClose: () => void;
  onCreated: (issue: Issue) => void;
}) {
  const [title, setTitle] = useState(check.title);
  const [description, setDescription] = useState(check.notes);
  const [level, setLevel] = useState("一般");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const issue = await issuesApi.create(projectCode, {
        testItemId,
        sheetId: sheet.id,
        sheetName: sheet.name,
        checkId: check.id,
        checkTitle: check.title,
        targetDocument: sheet.targetDocumentName || sheet.name,
        title: title.trim(),
        description,
        defectType: "文档问题",
        level,
        closureMethod: "修改文档",
      });
      onCreated(issue);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "立单失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>立问题单</DialogTitle>
          <DialogDescription>
            来源：{sheet.name} · {check.title}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="issue-title">问题标题</FieldLabel>
            <Input
              id="issue-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="issue-desc">问题描述</FieldLabel>
            <Textarea
              id="issue-desc"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>等级</FieldLabel>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["重大", "严重", "一般", "建议改进"].map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            type="button"
            disabled={submitting || !title.trim()}
            onClick={() => void submit()}
          >
            {submitting ? "提交中…" : "创建立单"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
