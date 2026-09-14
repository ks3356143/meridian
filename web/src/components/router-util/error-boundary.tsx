import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { isRouteErrorResponse, useLocation, useNavigate, useRouteError } from "react-router";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { AuthRequiredScreen } from "./auth-required-screen";
import { RouteStatusScreen } from "./route-status-screen";

export function RouterErrorBoundary() {
  const error = useRouteError();
  const location = useLocation();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const status = isRouteErrorResponse(error) ? error.status : undefined;
  const isNotFound = status === 404;

  if (!token) {
    return <AuthRequiredScreen />;
  }

  const description = isNotFound
    ? "当前链接没有匹配到可用路由，可能已失效或输入不完整。"
    : isRouteErrorResponse(error)
      ? error.statusText || "请求的页面当前不可用。"
      : error instanceof Error
        ? error.message
        : "请返回工作台后重试。";

  return (
    <RouteStatusScreen
      tone={isNotFound ? "warning" : "danger"}
      code={status ? String(status) : "500"}
      title={isNotFound ? "页面不存在" : "页面出现异常"}
      description={description}
      routePath={`${location.pathname}${location.search}${location.hash}`}
      icon={AlertTriangle}
      facts={[
        { label: "路由状态", value: isNotFound ? "未匹配" : "异常" },
        { label: "认证状态", value: "已登录" },
        { label: "处理建议", value: isNotFound ? "检查链接" : "重试页面" },
      ]}
      actions={
        <>
          <Button type="button" onClick={() => navigate("/")}>
            <Home data-icon="inline-start" aria-hidden />
            返回首页
          </Button>
          <Button type="button" variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw data-icon="inline-start" aria-hidden />
            重新加载
          </Button>
        </>
      }
    />
  );
}
