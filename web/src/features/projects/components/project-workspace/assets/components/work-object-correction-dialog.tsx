import { PencilLine } from "lucide-react";
import { useState } from "react";
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
  workObjectKindOptions,
  type ReceivedWorkObject,
  type WorkObjectKind,
} from "../received-asset-model";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type WorkObjectCorrectionValues = {
  objectKind: WorkObjectKind;
  objectName: string;
  version: string;
  source: string;
};

export function WorkObjectCorrectionDialog({
  asset,
  values,
  submitting,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  asset: ReceivedWorkObject;
  values: WorkObjectCorrectionValues;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (values: WorkObjectCorrectionValues) => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const valid =
    values.objectName.trim() && values.version.trim() && values.source.trim() && reason.trim();

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>登记纠错</DialogTitle>
          <DialogDescription>
            用于修正确认前录入错误的对象类型、名称、版本和提供方。版本状态、接收文件和文件哈希保持不变，操作会写入生命周期审计。
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/30 border-border grid gap-2 rounded-sm border p-3 text-xs sm:grid-cols-2">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">原类型</span>
            <span className="font-semibold">
              {workObjectKindOptions.find((option) => option.value === asset.objectKind)?.label}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">原始版本</span>
            <span className="font-mono font-semibold">{asset.version}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">原提供方</span>
            <span className="min-w-0 truncate font-semibold">{asset.source}</span>
          </div>
          <div className="flex justify-between gap-3 sm:col-span-2">
            <span className="text-muted-foreground">原始对象</span>
            <span className="min-w-0 truncate font-semibold">{asset.objectName}</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="work-object-correction-kind">正确对象类型</FieldLabel>
            <Select
              value={values.objectKind}
              onValueChange={(objectKind) =>
                onChange({ ...values, objectKind: objectKind as WorkObjectKind })
              }
            >
              <SelectTrigger id="work-object-correction-kind" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workObjectKindOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="work-object-correction-name">正确对象名称</FieldLabel>
            <Input
              id="work-object-correction-name"
              value={values.objectName}
              onChange={(event) => onChange({ ...values, objectName: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="work-object-correction-version">正确版本</FieldLabel>
            <Input
              id="work-object-correction-version"
              value={values.version}
              className="font-mono"
              onChange={(event) => onChange({ ...values, version: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="work-object-correction-source">正确提供方</FieldLabel>
            <Input
              id="work-object-correction-source"
              value={values.source}
              onChange={(event) => onChange({ ...values, source: event.target.value })}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="work-object-correction-reason">纠错原因</FieldLabel>
          <Input
            id="work-object-correction-reason"
            value={reason}
            placeholder="例如：文件名识别时名称少字，版本号误读为 V1.00"
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={!valid || submitting}
            onClick={() => onSubmit(reason.trim())}
          >
            <PencilLine data-icon="inline-start" aria-hidden />
            {submitting ? "保存中..." : "保存纠错"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
