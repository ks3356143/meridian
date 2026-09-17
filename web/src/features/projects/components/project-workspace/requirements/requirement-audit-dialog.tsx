import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { requirementsApi } from "@/features/requirements/api";
import type { RequirementEvent, RequirementRecord } from "@/features/requirements/types";
import styles from "./requirement-audit-dialog.module.css";

const statusMeta = {
  candidate: { label: "候选", variant: "warning" },
  official: { label: "已确认", variant: "primary" },
  excluded: { label: "已删除", variant: "danger" },
  superseded: { label: "已替代", variant: "secondary" },
  "": { label: "初始", variant: "outline" },
} as const;

export function RequirementAuditDialog({
  projectId,
  requirement,
  onOpenChange,
}: {
  projectId: string;
  requirement: RequirementRecord | null;
  onOpenChange: (open: boolean) => void;
}) {
  const eventsQuery = useQuery({
    queryKey: ["projects", projectId, "requirements", requirement?.id ?? "none", "events"],
    queryFn: () => requirementsApi.events(requirement?.id ?? ""),
    enabled: requirement !== null,
  });
  const events = eventsQuery.data ?? [];

  return (
    <Dialog open={requirement !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className={styles.title}>
            <History aria-hidden />
            需求审计记录
          </DialogTitle>
          <DialogDescription>
            {requirement
              ? `§${requirement.chapterNumber} ${requirement.name} 的创建、修改、删除和恢复轨迹。`
              : "尚未选择需求。"}
          </DialogDescription>
        </DialogHeader>

        {eventsQuery.isPending ? (
          <div className={styles.loading}>
            <Skeleton className={styles.loadingSkeleton} />
            <Skeleton className={styles.loadingSkeleton} />
          </div>
        ) : eventsQuery.isError ? (
          <p role="alert" className={styles.error}>
            审计记录加载失败：{eventsQuery.error.message}
          </p>
        ) : events.length === 0 ? (
          <p className={styles.empty}>暂无审计记录</p>
        ) : (
          <ol className={styles.events}>
            {events.map((event) => (
              <AuditEventItem key={event.id} event={event} />
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AuditEventItem({ event }: { event: RequirementEvent }) {
  return (
    <li className={styles.event}>
      <div className={styles.eventHead}>
        <span className={styles.action}>{getActionLabel(event)}</span>
        <span className={styles.time}>{new Date(event.operatedAt).toLocaleString("zh-CN")}</span>
      </div>
      <div className={styles.states}>
        <Badge variant={statusMeta[event.fromStatus].variant} className={styles.stateBadge}>
          {statusMeta[event.fromStatus].label}
        </Badge>
        <span className={styles.arrow}>-&gt;</span>
        <Badge variant={statusMeta[event.toStatus].variant} className={styles.stateBadge}>
          {statusMeta[event.toStatus].label}
        </Badge>
      </div>
      <p className={styles.detail}>
        {event.detail || "未填写说明"}
        <span className={styles.operator}> 操作人：{event.operatedByName || "系统"}</span>
      </p>
    </li>
  );
}

function getActionLabel(event: RequirementEvent) {
  if (event.action === "exclude") {
    return event.fromStatus === "official" ? "删除确认需求" : "排除候选需求";
  }
  const labels = {
    create: "创建需求",
    update: "修改需求",
    confirm: "确认需求",
    restore: "恢复确认",
    parse: "解析生成",
  } as const;
  return labels[event.action];
}
