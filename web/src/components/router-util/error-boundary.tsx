import { AlertTriangle, RefreshCw } from "lucide-react";
import { isRouteErrorResponse, useRouteError } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
      <Card className="w-full max-w-lg">
        <CardHeader>
          <span className="border-warning/30 bg-warning/10 text-warning flex size-11 items-center justify-center rounded-sm border">
            <AlertTriangle className="size-5" aria-hidden />
          </span>
          <CardTitle className="mt-3 text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw data-icon="inline-start" />
            重新加载
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
