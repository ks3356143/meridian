import { useMutation } from "@tanstack/react-query";
import { CalendarIcon, LoaderCircle, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { YearMonthCalendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

export function StandardEditor({
  open,
  item,
  onSaved,
  onCancel,
}: {
  open: boolean;
  item: ReferenceStandard | null;
  onSaved: (standard: ReferenceStandard) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [code, setCode] = useState(item?.code ?? "");
  const [publishedDate, setPublishedDate] = useState(item?.publishedDate ?? "");
  const [source, setSource] = useState(item?.source ?? "");
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 1));
  const [isEnabled, setIsEnabled] = useState(item?.isEnabled ?? true);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    code?: string;
    publishedDate?: string;
    source?: string;
    sortOrder?: string;
  }>({});
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
          })
        : projectsApi.createStandard({
            name: name.trim(),
            code: code.trim(),
            publishedDate,
            source: source.trim(),
            sortOrder: Number(sortOrder) || 0,
            isEnabled,
          }),
    onSuccess: async (standard) => {
      await onSaved(standard);
      toast.success(item ? "依据标准已保存" : "依据标准已新增");
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: {
      name?: string;
      code?: string;
      publishedDate?: string;
      source?: string;
      sortOrder?: string;
    } = {};
    if (!name.trim()) {
      nextErrors.name = "请输入文档名称";
    }
    if (!code.trim()) {
      nextErrors.code = "请输入标识/版本";
    }
    if (!publishedDate) {
      nextErrors.publishedDate = "请选择发布日期";
    }
    if (!source.trim()) {
      nextErrors.source = "请输入来源单位";
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="standard-name">
              文档名称 <RequiredMark />
            </Label>
            <Input
              id="standard-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setErrors((previous) => ({ ...previous, name: undefined }));
              }}
              placeholder="例：GJB 438C-2021"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "standard-name-error" : undefined}
            />
            {errors.name ? (
              <p id="standard-name-error" className="text-destructive text-xs">
                {errors.name}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="standard-code">
                标识/版本 <RequiredMark />
              </Label>
              <Input
                id="standard-code"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  setErrors((previous) => ({ ...previous, code: undefined }));
                }}
                aria-invalid={Boolean(errors.code)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="standard-date">
                发布日期 <RequiredMark />
              </Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    id="standard-date"
                    aria-invalid={Boolean(errors.publishedDate)}
                    className={
                      publishedDate
                        ? "w-full justify-between font-normal"
                        : "text-muted-foreground w-full justify-between font-normal"
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
                      setErrors((previous) => ({ ...previous, publishedDate: undefined }));
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="standard-source">
              来源单位 <RequiredMark />
            </Label>
            <Input
              id="standard-source"
              value={source}
              onChange={(event) => {
                setSource(event.target.value);
                setErrors((previous) => ({ ...previous, source: undefined }));
              }}
              aria-invalid={Boolean(errors.source)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="standard-sort">排序</Label>
            <Input
              id="standard-sort"
              type="number"
              min={0}
              max={9999}
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value);
                setErrors((previous) => ({ ...previous, sortOrder: undefined }));
              }}
              aria-invalid={Boolean(errors.sortOrder)}
              aria-describedby={errors.sortOrder ? "standard-sort-error" : undefined}
            />
            {errors.sortOrder ? (
              <p id="standard-sort-error" className="text-destructive text-xs">
                {errors.sortOrder}
              </p>
            ) : null}
          </div>
          <label
            htmlFor="standard-enabled"
            className="border-border bg-card/60 flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2"
          >
            <Checkbox
              id="standard-enabled"
              checked={isEnabled}
              onCheckedChange={(checked) => setIsEnabled(checked === true)}
            />
            <span className="text-sm">启用</span>
          </label>
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
