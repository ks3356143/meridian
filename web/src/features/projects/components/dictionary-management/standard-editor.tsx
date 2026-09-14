import { useMutation } from "@tanstack/react-query";
import { CalendarIcon, LoaderCircle, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { YearMonthCalendar } from "@/components/ui/calendar";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { projectsApi } from "@/features/projects/api";
import { RequiredMark } from "@/features/projects/components/project-create/basic-fields";
import type { ReferenceStandard } from "@/features/projects/types";

function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function fromDateKey(key: string): Date | undefined {
  const parsed = new Date(`${key}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

interface StandardEditorErrors {
  name?: string;
  code?: string;
  publishedDate?: string;
  source?: string;
  sortOrder?: string;
}

export function StandardEditor({
  open,
  item,
  allStandards = [],
  defaultSortOrder = 1,
  fixedEnabled = false,
  onSaved,
  onCancel,
}: {
  open: boolean;
  item: ReferenceStandard | null;
  allStandards?: ReferenceStandard[];
  defaultSortOrder?: number;
  fixedEnabled?: boolean;
  onSaved: (standard: ReferenceStandard) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [code, setCode] = useState(item?.code ?? "");
  const [publishedDate, setPublishedDate] = useState(item?.publishedDate ?? "");
  const [source, setSource] = useState(item?.source ?? "");
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? defaultSortOrder));
  const [isEnabled, setIsEnabled] = useState(item?.isEnabled ?? true);
  const [isDefault, setIsDefault] = useState(item?.isDefault ?? false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [errors, setErrors] = useState<StandardEditorErrors>({});
  const selectedDate = publishedDate ? fromDateKey(publishedDate) : undefined;
  const mutation = useMutation({
    mutationFn: () =>
      item
        ? projectsApi.updateStandard(item.id, {
            name: name.trim(),
            code: code.trim(),
            publishedDate,
            source: source.trim(),
            sortOrder: Number(sortOrder) || 0,
            isEnabled,
            isDefault,
          })
        : projectsApi.createStandard({
            name: name.trim(),
            code: code.trim(),
            publishedDate,
            source: source.trim(),
            sortOrder: Number(sortOrder) || 0,
            isEnabled,
            isDefault,
          }),
    onSuccess: async (standard) => {
      await onSaved(standard);
      toast.success(item ? "依据标准已保存" : "依据标准已新增");
    },
  });

  const clearError = (field: keyof StandardEditorErrors) =>
    setErrors((previous) => ({ ...previous, [field]: undefined }));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: StandardEditorErrors = {};
    const trimmedName = name.trim();
    const trimmedCode = code.trim();
    const trimmedSource = source.trim();
    if (!trimmedName) nextErrors.name = "请输入文档名称";
    if (trimmedName.length > 160) nextErrors.name = "文档名称不能超过 160 个字符";
    const duplicate = allStandards.some(
      (standard) =>
        standard.id !== item?.id &&
        String(standard.name ?? "")
          .trim()
          .toLowerCase() === trimmedName.toLowerCase(),
    );
    if (duplicate) {
      nextErrors.name = "该依据标准已存在";
    }
    if (!trimmedCode) nextErrors.code = "请输入标识/版本";
    if (trimmedCode.length > 160) nextErrors.code = "标识/版本不能超过 160 个字符";
    if (!publishedDate) nextErrors.publishedDate = "请选择发布日期";
    if (!trimmedSource) nextErrors.source = "请输入来源单位";
    if (trimmedSource.length > 160) nextErrors.source = "来源单位不能超过 160 个字符";
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
        className="max-w-xl"
        onEscapeKeyDown={(event) => {
          if (mutation.isPending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (mutation.isPending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{item ? "编辑依据标准" : "新增依据标准"}</DialogTitle>
          <DialogDescription>文档名称全局唯一，忽略大小写。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Field className="gap-2" data-invalid={errors.name ? true : undefined}>
            <FieldLabel htmlFor="standard-name">
              文档名称
              <RequiredMark />
            </FieldLabel>
            <Input
              id="standard-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                clearError("name");
              }}
              placeholder="例：GJB 438C-2021"
              aria-required="true"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "standard-name-error" : undefined}
            />
            {errors.name ? <FieldError id="standard-name-error">{errors.name}</FieldError> : null}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="gap-2" data-invalid={errors.code ? true : undefined}>
              <FieldLabel htmlFor="standard-code">
                标识/版本
                <RequiredMark />
              </FieldLabel>
              <Input
                id="standard-code"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  clearError("code");
                }}
                placeholder="例：2021"
                aria-required="true"
                aria-invalid={Boolean(errors.code)}
                aria-describedby={errors.code ? "standard-code-error" : undefined}
              />
              {errors.code ? <FieldError id="standard-code-error">{errors.code}</FieldError> : null}
            </Field>

            <Field className="gap-2" data-invalid={errors.publishedDate ? true : undefined}>
              <FieldLabel htmlFor="standard-date">
                发布日期
                <RequiredMark />
              </FieldLabel>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    id="standard-date"
                    aria-required="true"
                    aria-invalid={Boolean(errors.publishedDate)}
                    aria-describedby={errors.publishedDate ? "standard-date-error" : undefined}
                    className={
                      publishedDate
                        ? "w-full justify-between font-normal"
                        : "text-placeholder w-full justify-between font-normal"
                    }
                  >
                    {publishedDate || "选择日期"}
                    <CalendarIcon aria-hidden />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-1" align="start">
                  <YearMonthCalendar
                    selected={selectedDate}
                    onSelect={(date) => {
                      setPublishedDate(date ? toDateKey(date) : "");
                      setCalendarOpen(false);
                      clearError("publishedDate");
                    }}
                  />
                </PopoverContent>
              </Popover>
              {errors.publishedDate ? (
                <FieldError id="standard-date-error">{errors.publishedDate}</FieldError>
              ) : null}
            </Field>
          </div>

          <Field className="gap-2" data-invalid={errors.source ? true : undefined}>
            <FieldLabel htmlFor="standard-source">
              来源单位
              <RequiredMark />
            </FieldLabel>
            <Input
              id="standard-source"
              value={source}
              onChange={(event) => {
                setSource(event.target.value);
                clearError("source");
              }}
              aria-required="true"
              aria-invalid={Boolean(errors.source)}
              aria-describedby={errors.source ? "standard-source-error" : undefined}
            />
            {errors.source ? (
              <FieldError id="standard-source-error">{errors.source}</FieldError>
            ) : null}
          </Field>

          <Field className="gap-2" data-invalid={errors.sortOrder ? true : undefined}>
            <FieldLabel htmlFor="standard-sort">排序</FieldLabel>
            <Input
              id="standard-sort"
              type="number"
              min={0}
              max={9999}
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value);
                clearError("sortOrder");
              }}
              aria-invalid={Boolean(errors.sortOrder)}
              aria-describedby={errors.sortOrder ? "standard-sort-error" : undefined}
            />
            <FieldDescription>决定依据文件章节顺序。</FieldDescription>
            {errors.sortOrder ? (
              <FieldError id="standard-sort-error">{errors.sortOrder}</FieldError>
            ) : null}
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border-border bg-muted/35 flex items-center justify-between gap-4 rounded-sm border p-3">
              <div className="min-w-0">
                <label htmlFor="standard-default" className="text-sm font-semibold">
                  默认标准
                </label>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {isDefault ? "新建项目自动勾选" : "新建项目不自动勾选"}
                </p>
              </div>
              <Switch
                id="standard-default"
                checked={isDefault}
                onCheckedChange={setIsDefault}
                aria-label="设为默认依据标准"
              />
            </div>

            <div className="border-border bg-muted/35 flex items-center justify-between gap-4 rounded-sm border p-3">
              <div className="min-w-0">
                <label
                  htmlFor={fixedEnabled ? undefined : "standard-enabled"}
                  className="text-sm font-semibold"
                >
                  启用状态
                </label>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {isEnabled ? "可被新建项目选择" : "仅保留历史项目引用"}
                </p>
              </div>
              {fixedEnabled ? (
                <Badge variant="success">启用</Badge>
              ) : (
                <Switch
                  id="standard-enabled"
                  checked={isEnabled}
                  onCheckedChange={setIsEnabled}
                  aria-label="启用依据标准"
                />
              )}
            </div>
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
