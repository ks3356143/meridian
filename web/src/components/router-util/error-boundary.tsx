import { AlertTriangle, RefreshCw } from "lucide-react";
import { isRouteErrorResponse, useRouteError } from "react-router";
import { Button } from "@/components/ui/button";

export function RouterErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : undefined;
  const title = status === 404 ? "页面不存在" : "页面出现异常";
  const description = isRouteErrorResponse(error)
    ? error.statusText || "请求的页面当前不可用。"
    : error instanceof Error
      ? error.message
      : "请返回工作台后重试。";

  return (
    <main className="bg-background flex min-h-svh items-center justify-center p-6">
      <section className="panel-surface border-border text-card-foreground w-full max-w-md rounded-sm border p-6">
        <div className="text-primary flex items-center gap-2">
          <AlertTriangle data-icon="inline-start" />
          <span className="font-mono text-xs tracking-normal uppercase">Route Error</span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{description}</p>
        <Button className="mt-5" onClick={() => window.location.reload()}>
          <RefreshCw data-icon="inline-start" />
          重新加载
        </Button>
      </section>
    </main>
  );
}
