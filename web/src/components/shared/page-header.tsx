import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  badge,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "page-header relative flex flex-col gap-4 overflow-hidden sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="relative flex min-w-0 items-start gap-4">
        <span className="border-primary/25 bg-primary/10 text-primary relative flex size-11 shrink-0 items-center justify-center rounded-sm border">
          <span className="bg-primary/15 absolute -top-px -right-px size-8 blur-md" aria-hidden />
          <Icon className="relative size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-foreground text-2xl leading-tight font-bold tracking-tight">
              {title}
            </h1>
            {badge}
          </div>
          {description ? (
            <p className="text-muted-foreground mt-1.5 max-w-3xl text-sm leading-relaxed">
              {description}
            </p>
          ) : null}
          <div className="border-border/70 relative mt-4 h-px w-full">
            <span className="meridian-beam absolute inset-y-0 left-0 w-full" aria-hidden />
          </div>
        </div>
      </div>
      {actions ? <div className="relative flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
