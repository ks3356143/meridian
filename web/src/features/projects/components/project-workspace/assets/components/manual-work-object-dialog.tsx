import { FilePlus2 } from "lucide-react";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SaveWorkObjectPayload } from "@/features/assets/api";
import {
  assetPlatformOptions,
  receiveModeOptions,
  workObjectKindOptions,
  type AssetPlatform,
  type ReceiveMode,
  type ReceivedAssetDefaults,
  type WorkObjectKind,
} from "../received-asset-model";

interface ManualWorkObjectValues {
  objectKind: WorkObjectKind;
  objectName: string;
  version: string;
  platform: AssetPlatform;
  source: string;
  receivedAt: string;
  receiveMode: ReceiveMode;
}

export function ManualWorkObjectDialog({
  open,
  submitting,
  defaults,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  submitting: boolean;
  defaults: ReceivedAssetDefaults;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ManualWorkObjectValues) => void;
}) {
  const [values, setValues] = useState<ManualWorkObjectValues>({
    objectKind: "other_reference",
    objectName: "",
    version: "V1.00",
    platform: "common",
    source: defaults.source,
    receivedAt: defaults.receivedAt,
    receiveMode: defaults.receiveMode,
  });

  const valid = Boolean(values.objectName.trim() && values.version.trim() && values.source.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>手工登记工作对象</DialogTitle>
          <DialogDescription>登记尚未取得电子文件的依据资料或代码版本。</DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel htmlFor="manual-object-kind">对象类型</FieldLabel>
            <Select
              value={values.objectKind}
              onValueChange={(value) =>
                setValues((previous) => ({ ...previous, objectKind: value as WorkObjectKind }))
              }
            >
              <SelectTrigger id="manual-object-kind" size="sm">
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
          <Field>
            <FieldLabel htmlFor="manual-object-name">对象名称</FieldLabel>
            <Input
              id="manual-object-name"
              value={values.objectName}
              placeholder="例如 BCD星软件研制任务书"
              onChange={(event) =>
                setValues((previous) => ({ ...previous, objectName: event.target.value }))
              }
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="manual-object-version">版本</FieldLabel>
              <Input
                id="manual-object-version"
                className="font-mono"
                value={values.version}
                onChange={(event) =>
                  setValues((previous) => ({ ...previous, version: event.target.value }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="manual-object-platform">平台</FieldLabel>
              <Select
                value={values.platform}
                onValueChange={(value) =>
                  setValues((previous) => ({ ...previous, platform: value as AssetPlatform }))
                }
              >
                <SelectTrigger id="manual-object-platform" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assetPlatformOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="manual-object-source">提供方</FieldLabel>
              <Input
                id="manual-object-source"
                value={values.source}
                onChange={(event) =>
                  setValues((previous) => ({ ...previous, source: event.target.value }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="manual-object-received-at">接收日期</FieldLabel>
              <Input
                id="manual-object-received-at"
                type="date"
                value={values.receivedAt}
                onChange={(event) =>
                  setValues((previous) => ({ ...previous, receivedAt: event.target.value }))
                }
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="manual-object-receive-mode">接收方式</FieldLabel>
            <Select
              value={values.receiveMode}
              onValueChange={(value) =>
                setValues((previous) => ({ ...previous, receiveMode: value as ReceiveMode }))
              }
            >
              <SelectTrigger id="manual-object-receive-mode" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {receiveModeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={!valid || submitting}
            onClick={() => onSubmit(values as SaveWorkObjectPayload & { platform: AssetPlatform })}
          >
            <FilePlus2 data-icon="inline-start" aria-hidden />
            保存登记
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
