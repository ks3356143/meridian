import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReviewChecklistItem } from "@/features/test-items/types";
import { PracticeEditor } from "./practice-editor";
import { DOCUMENT_TYPES, EMPTY_ITEM, type Draft } from "./review-checklist-config-model";
import styles from "./review-checklist-config.module.css";

export function ReviewChecklistTemplateDialog({
  draft,
  practiceIndex,
  saving,
  onChange,
  onPracticeIndexChange,
  onPatchItem,
  onSave,
  usedTypes,
}: {
  draft: Draft | null;
  practiceIndex: number | null;
  saving: boolean;
  onChange: (draft: Draft | null) => void;
  onPracticeIndexChange: (index: number | null) => void;
  onPatchItem: (index: number, patch: Partial<ReviewChecklistItem>) => void;
  onSave: (draft: Draft) => void;
  usedTypes: string[];
}) {
  return (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && onChange(null)}>
      <DialogContent className={styles.dialog}>
        <DialogHeader className={styles.dialogHeader}>
          <span className={styles.dialogKicker}>REVIEW TEMPLATE</span>
          <DialogTitle>{draft?.id ? "编辑审查单模板" : "新建审查单模板"}</DialogTitle>
          <DialogDescription>
            检查项保存后会作为新审查单的快照；已绑定的审查单不受影响。
          </DialogDescription>
          <div className={styles.dialogChips}>
            <span>{draft?.documentType || "未选类型"}</span>
            <span>{draft?.documentVersion || "未设版本"}</span>
            <span>{draft?.items.length ?? 0} 个检查项</span>
          </div>
        </DialogHeader>
        {draft ? (
          <div className={styles.form}>
            <div className={styles.metaGrid}>
              <Field>
                <FieldLabel>审查文档类型</FieldLabel>
                <Select
                  value={draft.documentType}
                  onValueChange={(value) => onChange({ ...draft, documentType: value })}
                >
                  <SelectTrigger aria-label="审查文档类型">
                    <SelectValue placeholder="选择文档类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type} disabled={usedTypes.includes(type)}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="rc-version">当前使用版本</FieldLabel>
                <Input
                  id="rc-version"
                  value={draft.documentVersion}
                  placeholder="如 V1.02；新项目自动应用"
                  onChange={(event) => onChange({ ...draft, documentVersion: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="rc-name">模板名称</FieldLabel>
                <Input
                  id="rc-name"
                  value={draft.name}
                  onChange={(event) => onChange({ ...draft, name: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="rc-appendix">依据附录</FieldLabel>
                <Input
                  id="rc-appendix"
                  value={draft.appendix}
                  placeholder="如 附录A.1"
                  onChange={(event) => onChange({ ...draft, appendix: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="rc-condition">适用条件</FieldLabel>
                <Input
                  id="rc-condition"
                  value={draft.condition}
                  placeholder="留空表示默认添加"
                  onChange={(event) => onChange({ ...draft, condition: event.target.value })}
                />
              </Field>
            </div>

            <div className={styles.itemsHead}>
              <strong>检查项（{draft.items.length}）</strong>
              <Button
                type="button"
                size="xs"
                variant="outline"
                className={styles.addItemButton}
                onClick={() =>
                  onChange({
                    ...draft,
                    items: [...draft.items, { ...EMPTY_ITEM, seq: draft.items.length + 1 }],
                  })
                }
              >
                <Plus aria-hidden />
                添加检查项
              </Button>
            </div>

            <div className={styles.itemList}>
              {draft.items.map((item, index) => (
                <div
                  key={index}
                  className={styles.itemRow}
                  style={{ animationDelay: `${index * 18}ms` }}
                >
                  <span className={styles.itemSeq}>{index + 1}</span>
                  <div className={styles.itemFields}>
                    <div className={styles.itemMain}>
                      <Input
                        value={item.category}
                        placeholder="类别"
                        aria-label={`第 ${index + 1} 项类别`}
                        onChange={(event) => onPatchItem(index, { category: event.target.value })}
                      />
                      <Input
                        value={item.title}
                        placeholder="检查项"
                        aria-label={`第 ${index + 1} 项检查项`}
                        onChange={(event) =>
                          onPatchItem(index, {
                            title: event.target.value,
                            requirement: event.target.value,
                          })
                        }
                      />
                      <Input
                        value={item.basis}
                        placeholder="依据，如 GJB 438C §4.1"
                        aria-label={`第 ${index + 1} 项依据`}
                        onChange={(event) => onPatchItem(index, { basis: event.target.value })}
                      />
                      <Button
                        type="button"
                        size="xs"
                        variant={practiceIndex === index ? "default" : "outline"}
                        className={styles.practiceButton}
                        onClick={() =>
                          onPracticeIndexChange(practiceIndex === index ? null : index)
                        }
                      >
                        做法
                      </Button>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        className={styles.deleteButton}
                        aria-label={`删除第 ${index + 1} 项`}
                        disabled={draft.items.length <= 1}
                        onClick={() => {
                          onPracticeIndexChange(null);
                          onChange({
                            ...draft,
                            items: draft.items.filter((_, itemIndex) => itemIndex !== index),
                          });
                        }}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                    {practiceIndex === index ? (
                      <div className={styles.practiceGrid}>
                        <div>
                          <span className={styles.practiceLabel}>推荐做法</span>
                          <PracticeEditor
                            value={item.goodPractice}
                            ariaLabel={`第 ${index + 1} 项推荐做法`}
                            onChange={(html) => onPatchItem(index, { goodPractice: html })}
                          />
                        </div>
                        <div>
                          <span className={styles.practiceLabel}>不推荐做法</span>
                          <PracticeEditor
                            value={item.badPractice}
                            ariaLabel={`第 ${index + 1} 项不推荐做法`}
                            onChange={(html) => onPatchItem(index, { badPractice: html })}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onChange(null)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={
              saving || !draft?.name.trim() || !draft?.items.every((item) => item.title.trim())
            }
            onClick={() => draft && onSave(draft)}
          >
            {saving ? "保存中…" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
