import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { InlineLoading } from "@/components/shared/inline-loading";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function QueryLoading({
  label,
  rows = 3,
  action,
}: {
  label: string;
  rows?: number;
  action?: ReactNode;
}) {
  return (
    <section className="panel-surface border-border flex flex-col gap-4 rounded-sm border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <InlineLoading className="text-sm font-medium" label={label} />
        {action ?? <Skeleton className="h-8 w-24" />}
      </div>
      <div aria-busy="true" className="grid gap-2">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </section>
  );
}

export function QueryError({
  title,
  description = "请确认服务状态后重试。",
  onRetry,
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertTriangle aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      {onRetry ? (
        <AlertAction>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw data-icon="inline-start" />
            重新加载
          </Button>
        </AlertAction>
      ) : null}
    </Alert>
  );
}
