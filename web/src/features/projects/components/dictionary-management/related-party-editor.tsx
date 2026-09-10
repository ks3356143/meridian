import { useMutation } from "@tanstack/react-query";
import { LoaderCircle, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { projectsApi } from "@/features/projects/api";
import { RequiredMark } from "@/features/projects/components/project-create/basic-fields";
import type { RelatedParty, RelatedPartyCategory } from "@/features/projects/types";

const categoryLabels: Record<RelatedPartyCategory, string> = {
  client: "委托方",
  developer: "研制方",
  test_center: "测评中心",
};

export function RelatedPartyEditor({
  open,
  item,
  onSaved,
  onCancel,
}: {
  open: boolean;
  item: RelatedParty | null;
  onSaved: (party: RelatedParty) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<RelatedPartyCategory>(item?.category ?? "client");
  const [name, setName] = useState(item?.name ?? "");
  const [contact, setContact] = useState(item?.contact ?? "");
  const [phone, setPhone] = useState(item?.phone ?? "");
  const [address, setAddress] = useState(item?.address ?? "");
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 1));
  const [isEnabled, setIsEnabled] = useState(item?.isEnabled ?? true);
  const [errors, setErrors] = useState<{ name?: string; sortOrder?: string }>({});
  const mutation = useMutation({
    mutationFn: () =>
      item
        ? projectsApi.updateRelatedParty(item.id, {
            category,
            name: name.trim(),
            contact: contact.trim(),
            phone: phone.trim(),
            address: address.trim(),
            sortOrder: Number(sortOrder) || 0,
            isEnabled,
          })
        : projectsApi.createRelatedParty({
            category,
            name: name.trim(),
            contact: contact.trim(),
            phone: phone.trim(),
            address: address.trim(),
            sortOrder: Number(sortOrder) || 0,
            isEnabled,
          }),
    onSuccess: async (saved) => {
      await onSaved(saved);
      toast.success(item ? "相关方已保存" : "相关方已新增");
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: { name?: string; sortOrder?: string } = {};
    if (!name.trim()) {
      nextErrors.name = "请输入单位名称";
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
          <DialogTitle>{item ? "编辑相关方" : "新增相关方"}</DialogTitle>
          <DialogDescription>
            同类别名称唯一，忽略大小写。项目设置时从此处选择，每个项目使用一次。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="related-party-category">相关方类别</Label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as RelatedPartyCategory)}
            >
              <SelectTrigger id="related-party-category">
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
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="related-party-name">
              单位名称 <RequiredMark />
            </Label>
            <Input
              id="related-party-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setErrors((previous) => ({ ...previous, name: undefined }));
              }}
              placeholder="例：XX研究所"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "related-party-name-error" : undefined}
            />
            {errors.name ? (
              <p id="related-party-name-error" className="text-destructive text-xs">
                {errors.name}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="related-party-contact">联系人</Label>
              <Input
                id="related-party-contact"
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder="例：张工"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="related-party-phone">联系电话</Label>
              <Input
                id="related-party-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="例：13800000000"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="related-party-address">单位地址</Label>
            <Input
              id="related-party-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="例：北京市海淀区XX路XX号"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="related-party-sort">排序</Label>
            <Input
              id="related-party-sort"
              type="number"
              min={0}
              max={9999}
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value);
                setErrors((previous) => ({ ...previous, sortOrder: undefined }));
              }}
              aria-invalid={Boolean(errors.sortOrder)}
              aria-describedby={errors.sortOrder ? "related-party-sort-error" : undefined}
            />
            {errors.sortOrder ? (
              <p id="related-party-sort-error" className="text-destructive text-xs">
                {errors.sortOrder}
              </p>
            ) : null}
          </div>
          <label
            htmlFor="related-party-enabled"
            className="border-border bg-card/60 flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2"
          >
            <Checkbox
              id="related-party-enabled"
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
