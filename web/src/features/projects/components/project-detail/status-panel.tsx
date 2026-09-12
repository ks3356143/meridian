import type { ReactNode } from "react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ReadinessState } from "./status-model";

export function StatusPanel({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action: string;
  onAction: () => void;
  children: ReactNode;
}) {
  return (
    <section className="panel-surface flex flex-col gap-5 rounded-sm border p-4 sm:p-5">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h2 className="text-base leading-none font-semibold">{title}</h2>
        <Button type="button" size="sm" onClick={onAction}>
          {action}
        </Button>
      </div>
      {children}
    </section>
  );
}

export function MetricTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "info" | "warning" | "danger";
}) {
  return (
    <div data-tonal-panel={tone === "default" ? "primary" : tone} className="min-w-0 p-3.5 pl-4">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p
        className={cn(
          "mt-2 truncate text-lg leading-none font-semibold",
          tone === "danger" && "text-destructive",
          tone === "warning" && "text-warning",
          tone === "info" && "text-info",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function Checklist({
  items,
}: {
  items: Array<{ label: string; state: ReadinessState; detail: string }>;
}) {
  return (
    <ul className="detail-checklist divide-border divide-y">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex min-w-0 items-center justify-between gap-4 px-3.5 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">{item.label}</p>
            <p className="text-muted-foreground mt-1 truncate text-[11px]">{item.detail}</p>
          </div>
          <StateChip state={item.state}>
            {item.state === "ready" ? "已具备" : item.state === "partial" ? "部分具备" : "待补齐"}
          </StateChip>
        </li>
      ))}
    </ul>
  );
}

export function StateChip({ state, children }: { state: ReadinessState; children: string }) {
  return (
    <Badge
      variant={state === "ready" ? "success" : state === "partial" ? "warning" : "secondary"}
      className="h-6 shrink-0"
    >
      <span
        className={cn(
          "status-dot",
          state === "ready" && "bg-success",
          state === "partial" && "bg-warning",
        )}
        aria-hidden
      />
      {children}
    </Badge>
  );
}
