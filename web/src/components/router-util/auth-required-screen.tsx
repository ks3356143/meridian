import { LogIn, RefreshCw, ShieldAlert } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { RouteStatusScreen } from "./route-status-screen";

export function AuthRequiredScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const targetPath = `${location.pathname}${location.search}${location.hash}`;
  const loginPath = `/login?redirect=${encodeURIComponent(targetPath)}`;

  return (
    <RouteStatusScreen
      tone="auth"
      code="401"
      title="访问未授权"
      description="当前浏览器没有有效的 ChenMeridian 登录会话。为避免项目数据泄露，业务请求已在根路由拦截。"
      routePath={targetPath}
      icon={ShieldAlert}
      facts={[
        { label: "认证状态", value: "未登录" },
        { label: "会话令牌", value: "未获取" },
        { label: "拦截层级", value: "根路由" },
      ]}
      actions={
        <>
          <Button type="button" onClick={() => navigate(loginPath)}>
            <LogIn data-icon="inline-start" aria-hidden />
            返回登录界面
          </Button>
          <Button type="button" variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw data-icon="inline-start" aria-hidden />
            重新检测
          </Button>
        </>
      }
    />
  );
}
