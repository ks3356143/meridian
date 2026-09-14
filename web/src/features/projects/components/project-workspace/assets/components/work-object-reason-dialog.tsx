import { AlertTriangle, Undo2 } from "lucide-react";
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
import type { ReceivedWorkObject } from "../received-asset-model";

export type WorkObjectLifecycleAction = "withdraw" | "revoke";

export function WorkObjectReasonDialog({
  action,
  asset,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  action: WorkObjectLifecycleAction;
  asset: ReceivedWorkObject;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const isWithdraw = action === "withdraw";

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isWithdraw ? "撤回确认" : "作废工作对象版本"}</DialogTitle>
          <DialogDescription>
            {isWithdraw
              ? "撤回后将回到待确认状态；如果它替代过旧版本，旧版本会自动恢复为当前有效版本。"
              : "作废后保留数据库记录和接收文件，不再作为有效基线参与后续业务。"}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/30 border-border grid gap-2 rounded-sm border p-3 text-xs">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">工作对象</span>
            <span className="min-w-0 truncate font-semibold">{asset.objectName}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">版本</span>
            <span className="font-mono font-semibold">{asset.version}</span>
          </div>
        </div>

        <Field>
          <FieldLabel htmlFor="work-object-reason">操作原因</FieldLabel>
          <Input
            id="work-object-reason"
            value={reason}
            placeholder={
              isWithdraw
                ? "例如：对象类型确认错误，需要修正后重新确认"
                : "例如：客户通知该版本资料作废"
            }
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            variant={isWithdraw ? "default" : "destructive"}
            disabled={!reason.trim() || submitting}
            onClick={() => onSubmit(reason.trim())}
          >
            {isWithdraw ? (
              <Undo2 data-icon="inline-start" aria-hidden />
            ) : (
              <AlertTriangle data-icon="inline-start" aria-hidden />
            )}
            {submitting ? "提交中..." : isWithdraw ? "确认撤回" : "确认作废"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
