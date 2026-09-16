import { useMutation } from "@tanstack/react-query";
import { LoaderCircle, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { projectsApi } from "@/features/projects/api";
import { RequiredMark } from "@/features/projects/components/project-create/basic-fields";
import type { DictionaryCategory, DictionaryOption } from "@/features/projects/types";

const categoryLabels: Record<DictionaryCategory, string> = {
  language: "编程语言",
  runtime_environment: "运行环境",
  development_environment: "开发环境",
};

export function DictionaryEditor({
  open,
  item,
  onSaved,
  onCancel,
}: {
  open: boolean;
  item: DictionaryOption | null;
  onSaved: (item: DictionaryOption) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<DictionaryCategory>(item?.category ?? "language");
  const [name, setName] = useState(item?.name ?? "");
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 1));
  const [isEnabled, setIsEnabled] = useState(item?.isEnabled ?? true);
  const [errors, setErrors] = useState<{ name?: string; sortOrder?: string }>({});
  const mutation = useMutation({
    mutationFn: () =>
      item
        ? projectsApi.updateDictionary(item.id, {
            category,
            name: name.trim(),
            sortOrder: Number(sortOrder) || 0,
            isEnabled,
          })
        : projectsApi.createDictionary({
            category,
            name: name.trim(),
            sortOrder: Number(sortOrder) || 0,
            isEnabled,
          }),
    onSuccess: async (saved) => {
      await onSaved(saved);
      toast.success(item ? "技术字典已保存" : "技术字典已新增");
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: { name?: string; sortOrder?: string } = {};
    if (!name.trim()) {
      nextErrors.name = "请输入字典展示名";
    }
    const sortValue = Number(sortOrder);
    if (!Number.isInteger(sortValue) || sortValue < 0 || sortValue > 9999) {
      nextErrors.sortOrder = "排序必须是 0 到 9999 的整数";
    }
    setErrors(nextErrors);
    const messages = Object.values(nextErrors);
    if (messages.length > 0) {
      toast.error(`请先处理：${messages.join("、")}`);
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !mutation.isPending) onCancel();
      }}
    >
      <DialogContent
        className="max-w-md"
        onEscapeKeyDown={(event) => {
          if (mutation.isPending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (mutation.isPending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{item ? "编辑技术字典" : "新增技术字典"}</DialogTitle>
          <DialogDescription>停用后不再出现在新建项目选项中。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Field className="gap-2">
            <FieldLabel htmlFor="dictionary-category">字典类型</FieldLabel>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as DictionaryCategory)}
            >
              <SelectTrigger id="dictionary-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field className="gap-2" data-invalid={errors.name ? true : undefined}>
            <FieldLabel htmlFor="dictionary-name">
              展示名
              <RequiredMark />
            </FieldLabel>
            <Input
              id="dictionary-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setErrors((previous) => ({ ...previous, name: undefined }));
              }}
              placeholder="例：Rust"
              aria-required="true"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "dictionary-name-error" : undefined}
            />
            <FieldError id="dictionary-name-error">{errors.name}</FieldError>
          </Field>

          <Field className="gap-2" data-invalid={errors.sortOrder ? true : undefined}>
            <FieldLabel htmlFor="dictionary-sort">排序</FieldLabel>
            <Input
              id="dictionary-sort"
              type="number"
              min={0}
              max={9999}
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value);
                setErrors((previous) => ({ ...previous, sortOrder: undefined }));
              }}
              aria-invalid={Boolean(errors.sortOrder)}
              aria-describedby={errors.sortOrder ? "dictionary-sort-error" : undefined}
            />
            <FieldDescription>数值越小越靠前。</FieldDescription>
            <FieldError id="dictionary-sort-error">{errors.sortOrder}</FieldError>
          </Field>

          <div className="border-border bg-muted/35 flex items-center justify-between gap-4 rounded-sm border p-3">
            <div className="min-w-0">
              <label htmlFor="dictionary-enabled" className="text-sm font-semibold">
                启用状态
              </label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {isEnabled ? "出现在新建项目选项" : "仅保留历史项目引用"}
              </p>
            </div>
            <Switch
              id="dictionary-enabled"
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
              aria-label="启用技术字典"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
              ) : (
                <Save data-icon="inline-start" />
              )}
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
