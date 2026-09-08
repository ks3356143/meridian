import { Suspense } from "react";
import { Outlet } from "react-router";
import { RouteLoading } from "@/components/router-util/route-loading";

export function RootRoute() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Outlet />
    </Suspense>
  );
}
