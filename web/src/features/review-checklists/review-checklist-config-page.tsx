import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, ClipboardList, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { reviewChecklistsApi } from "@/features/test-items/api";
import type { ReviewChecklistItem, ReviewChecklistTemplate } from "@/features/test-items/types";
import { ReviewChecklistTemplateDialog } from "./review-checklist-template-dialog";
import {
  DOCUMENT_TYPES,
  EMPTY_ITEM,
  conditionLabel,
  practiceDone,
  type Draft,
} from "./review-checklist-config-model";
import styles from "./review-checklist-config.module.css";

export function ReviewChecklistConfigPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [practiceIndex, setPracticeIndex] = useState<number | null>(null);
  const templatesQuery = useQuery({
    queryKey: ["review-checklists"],
    queryFn: reviewChecklistsApi.list,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["review-checklists"] });
    // DC 工作台目录与模板同源，模板变更后重新拉取，避免 30s 内仍拿到旧检查项。
    void queryClient.invalidateQueries({ queryKey: ["test-items"] });
  };

  const saveMutation = useMutation({
    mutationFn: (value: Draft) => {
      const payload = {
        name: value.name.trim(),
        appendix: value.appendix.trim(),
        condition: value.condition.trim(),
        documentType: value.documentType,
        documentVersion: value.documentVersion.trim(),
        items: value.items.map((item, index) => ({ ...item, seq: index + 1 })),
      };
      return value.id
        ? reviewChecklistsApi.update(value.id, payload)
        : reviewChecklistsApi.create(payload);
    },
    onSuccess: () => {
      toast.success("审查单模板已保存");
      setDraft(null);
      void invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "保存失败"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reviewChecklistsApi.remove(id),
    onSuccess: () => {
      toast.success("模板已删除");
      void invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "删除失败"),
  });

  const templates = templatesQuery.data ?? [];

  const openEdit = (template: ReviewChecklistTemplate) => {
    setPracticeIndex(null);
    setDraft({
      id: template.id,
      name: template.name,
      appendix: template.appendix,
      condition: template.condition,
      documentType: template.documentType,
      documentVersion: template.documentVersion,
      items: template.items.map((item) => ({ ...item })),
    });
  };

  const openCreate = () => {
    setPracticeIndex(null);
    const usedTypes = new Set(templates.map((template) => template.documentType));
    setDraft({
      name: "",
      appendix: "",
      condition: "",
      documentType: DOCUMENT_TYPES.find((type) => !usedTypes.has(type)) ?? DOCUMENT_TYPES[0],
      documentVersion: "",
      items: [{ ...EMPTY_ITEM }],
    });
  };

  const patchItem = (index: number, patch: Partial<ReviewChecklistItem>) => {
    setDraft((current) => {
      if (!current) return current;
      const items = current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      );
      return { ...current, items };
    });
  };

  const totalItems = templates.reduce((sum, template) => sum + template.items.length, 0);
  const practiceStats = templates.reduce(
    (acc, template) => {
      const done = practiceDone(template.items);
      acc.configured += done.configured;
      acc.total += done.total;
      return acc;
    },
    { configured: 0, total: 0 },
  );
  const coveredTypes = DOCUMENT_TYPES.filter((type) =>
    templates.some((template) => template.documentType === type),
  ).length;
  const latestUpdated = templates.reduce(
    (latest, template) => (!latest || template.updatedAt > latest ? template.updatedAt : latest),
    "",
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ClipboardList}
        title="审查单配置"
        description="维护文档审查的检查项与推荐 / 不推荐做法；修改只影响之后新建或添加的审查单。"
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus data-icon="inline-start" />
            新建审查单
          </Button>
        }
      />

      {templatesQuery.isPending ? <p className={styles.state}>正在读取审查单模板…</p> : null}
      {templatesQuery.isError ? <p className={styles.state}>审查单模板读取失败，请重试。</p> : null}

      <div className={styles.stats}>
        <div>
          <span>模板</span>
          <strong>{templates.length}</strong>
          <em>/ {DOCUMENT_TYPES.length} 类</em>
        </div>
        <div>
          <span>检查项</span>
          <strong>{totalItems}</strong>
        </div>
        <div>
          <span>做法配置</span>
          <strong>
            {practiceStats.total
              ? Math.round((practiceStats.configured / practiceStats.total) * 100)
              : 0}
            %
          </strong>
        </div>
        <div>
          <span>文档类型覆盖</span>
          <strong>{coveredTypes}/5</strong>
        </div>
        <div>
          <span>最近更新</span>
          <strong>{latestUpdated ? latestUpdated.slice(0, 10) : "—"}</strong>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>审查文档类型</TableHead>
              <TableHead className={styles.nameHead}>审查单名称</TableHead>
              <TableHead>检查项</TableHead>
              <TableHead>当前版本</TableHead>
              <TableHead>做法</TableHead>
              <TableHead>适用条件</TableHead>
              <TableHead>最近更新</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template, index) => {
              const done = practiceDone(template.items);
              return (
                <TableRow
                  key={template.id}
                  className={styles.tableRow}
                  style={{ animationDelay: `${index * 28}ms` }}
                >
                  <TableCell className={styles.seqCell}>
                    {String(index + 1).padStart(2, "0")}
                  </TableCell>
                  <TableCell>
                    <span className={styles.typeChip}>{template.documentType || "未分类"}</span>
                  </TableCell>
                  <TableCell className={styles.nameCol}>
                    <div className={styles.nameCell}>
                      <BookOpenCheck aria-hidden />
                      <strong>{template.name}</strong>
                    </div>
                  </TableCell>
                  <TableCell className={styles.numCell}>{template.items.length} 项</TableCell>
                  <TableCell className={styles.numCell}>
                    {template.documentVersion || "未设置"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={styles.practiceBadge}
                      data-state={
                        done.configured === 0
                          ? "empty"
                          : done.configured === done.total
                            ? "full"
                            : "partial"
                      }
                    >
                      {done.configured}/{done.total}
                    </span>
                  </TableCell>
                  <TableCell>{conditionLabel(template.condition)}</TableCell>
                  <TableCell className={styles.numCell}>
                    {template.updatedAt.slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    <div className={styles.rowActions}>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => openEdit(template)}
                      >
                        编辑
                      </Button>
                      <ConfirmAction
                        title="删除审查单模板"
                        description={`确认删除“${template.name}”？已绑定到测试项的审查单不受影响。`}
                        onConfirm={() => deleteMutation.mutate(template.id)}
                      >
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          aria-label={`删除${template.name}`}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </ConfirmAction>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ReviewChecklistTemplateDialog
        draft={draft}
        practiceIndex={practiceIndex}
        saving={saveMutation.isPending}
        onChange={setDraft}
        onPracticeIndexChange={setPracticeIndex}
        onPatchItem={patchItem}
        onSave={(value) => saveMutation.mutate(value)}
        usedTypes={templates
          .filter((template) => template.id !== draft?.id)
          .map((template) => template.documentType)}
      />
    </div>
  );
}
