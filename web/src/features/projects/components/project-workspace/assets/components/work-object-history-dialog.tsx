import { History } from "lucide-react";
import { Fade } from "@animate-ui/react/primitives/effects/fade";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkObjectLifecycleEvent } from "@/features/assets/api";
import { getWorkObjectStatusMeta, type ReceivedWorkObject } from "../received-asset-model";
import styles from "./work-object-history-dialog.module.css";

const actionLabels = {
  confirm: "确认",
  supersede: "被替代",
  withdraw: "撤回确认",
  restore: "恢复有效",
  revoke: "作废",
  correct: "登记纠错",
} as const;

export function WorkObjectHistoryDialog({
  asset,
  events,
  loading,
  onOpenChange,
}: {
  asset: ReceivedWorkObject;
  events: WorkObjectLifecycleEvent[];
  loading: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4 text-primary" aria-hidden />
            生命周期记录
          </DialogTitle>
          <DialogDescription>
            {asset.objectName} {asset.version} 的确认、替代、撤回、恢复、作废和登记纠错审计。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="grid gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">暂无生命周期记录</p>
        ) : (
          <ol className={styles.events}>
            {events.map((event) => {
              return (
                <Fade asChild key={event.id} initialOpacity={0.8}>
                  <li className={styles.event} data-action={event.action}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={styles.action}>{actionLabels[event.action]}</span>
                      <span className="text-muted-foreground font-mono text-[12px]">
                        {new Date(event.operatedAt).toLocaleString("zh-CN")}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="h-5 px-1.5 text-[12px]">
                        {getWorkObjectStatusMeta(event.fromStatus).label}
                      </Badge>
                      <span className="text-muted-foreground text-[12px]">{"->"}</span>
                      <Badge
                        variant={getWorkObjectStatusMeta(event.toStatus).badgeVariant}
                        className="h-5 px-1.5 text-[12px]"
                      >
                        {getWorkObjectStatusMeta(event.toStatus).label}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed">{event.reason}</p>
                  </li>
                </Fade>
              );
            })}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
