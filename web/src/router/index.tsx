import { createBrowserRouter } from "react-router";
import { RouterErrorBoundary } from "@/components/router-util/error-boundary";
import { RouteLoading } from "@/components/router-util/route-loading";
import { RootRoute } from "@/components/router-util/root-route";
import BasicLayout from "@/layouts/basic-layout";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootRoute />,
    HydrateFallback: RouteLoading,
    errorElement: <RouterErrorBoundary />,
    children: [
      {
        path: "login",
        lazy: () => import("@/pages/Login"),
      },
      {
        element: <BasicLayout />,
        children: [
          {
            index: true,
            lazy: () => import("@/pages/ProjectsPage"),
          },
          {
            path: "projects/new",
            lazy: () => import("@/pages/ProjectCreatePage"),
          },
          {
            path: "projects/:projectId",
            lazy: () => import("@/pages/ProjectWorkbenchPage"),
          },
          {
            path: "settings/dictionaries",
            lazy: () => import("@/pages/DictionaryManagementPage"),
          },
          {
            path: "settings/users",
            lazy: () => import("@/pages/UserManagementPage"),
          },
        ],
      },
    ],
  },
]);
