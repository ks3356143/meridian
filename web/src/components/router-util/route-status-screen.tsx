import type { LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";

export type RouteStatusTone = "auth" | "warning" | "danger";

export function RouteStatusScreen({
  tone,
  code,
  title,
  description,
  routePath,
  icon: Icon,
  facts,
  actions,
}: {
  tone: RouteStatusTone;
  code: string;
  title: string;
  description: string;
  routePath?: string;
  icon: LucideIcon;
  facts: Array<{ label: string; value: string }>;
  actions: ReactNode;
}) {
  const titleId = useId();

  return (
    <main className="route-status-shell" aria-labelledby={titleId}>
      <section className="route-status-panel" data-tone={tone}>
        <span className="route-status-corner" data-corner="tl" aria-hidden />
        <span className="route-status-corner" data-corner="tr" aria-hidden />
        <span className="route-status-corner" data-corner="bl" aria-hidden />
        <span className="route-status-corner" data-corner="br" aria-hidden />

        <header className="route-status-head">
          <span className="route-status-icon">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="route-status-eyebrow">CHENMERIDIAN ROUTE STATUS</p>
            <h1 id={titleId} className="route-status-title">
              {title}
            </h1>
          </div>
          <span className="route-status-code font-mono" aria-hidden>
            {code}
          </span>
        </header>

        <p className="route-status-description">{description}</p>

        {routePath ? (
          <div className="route-status-path font-mono text-xs">
            <span>{routePath}</span>
          </div>
        ) : null}

        <dl className="route-status-facts">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt>{fact.label}</dt>
              <dd className="truncate">{fact.value}</dd>
            </div>
          ))}
        </dl>

        <div className="route-status-actions">{actions}</div>
      </section>
    </main>
  );
}
