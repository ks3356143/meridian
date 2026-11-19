import { Suspense, useState } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router";
import { useAuthStore } from "@/stores/auth-store";
import { AuthRequiredScreen } from "@/components/router-util/auth-required-screen";
import { RouteLoading } from "@/components/router-util/route-loading";

export function RootRoute() {
  const token = useAuthStore((state) => state.token);
  const expiresAt = useAuthStore((state) => state.expiresAt);
  const location = useLocation();

  // 以挂载时刻判定过期（Date.now 不进渲染路径）；运行中途过期交由 401 流程兜底。
  // expiresAt 为 null 的旧持久化状态视为有效；重登后 expiresAt 更新即解除门控。
  const [nowAtMount] = useState(() => Date.now());
  const sessionExpired = expiresAt !== null && new Date(expiresAt).getTime() <= nowAtMount;
  if ((!token || sessionExpired) && location.pathname !== "/login") {
    return <AuthRequiredScreen />;
  }

  return (
    <Suspense fallback={<RouteLoading />}>
      <ScrollRestoration />
      <Outlet />
    </Suspense>
  );
}
