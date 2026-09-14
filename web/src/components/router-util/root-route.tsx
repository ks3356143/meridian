import { Suspense } from "react";
import { Outlet, useLocation } from "react-router";
import { useAuthStore } from "@/stores/auth-store";
import { AuthRequiredScreen } from "@/components/router-util/auth-required-screen";
import { RouteLoading } from "@/components/router-util/route-loading";

export function RootRoute() {
  const token = useAuthStore((state) => state.token);
  const location = useLocation();

  if (!token && location.pathname !== "/login") {
    return <AuthRequiredScreen />;
  }

  return (
    <Suspense fallback={<RouteLoading />}>
      <Outlet />
    </Suspense>
  );
}
