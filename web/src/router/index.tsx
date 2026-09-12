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
            path: "projects/:code",
            lazy: () => import("@/pages/ProjectDetailPage"),
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
      {
        path: "projects/:code/workspace",
        lazy: () => import("@/pages/ProjectWorkspacePage"),
        children: [
          {
            index: true,
            lazy: () => import("@/pages/ProjectWorkspaceEntryPage"),
          },
          {
            path: "outline",
            lazy: () => import("@/pages/ProjectOutlinePage"),
          },
          {
            path: "overview",
            lazy: () => import("@/pages/ProjectWorkspaceOverviewPage"),
          },
          {
            path: "profile",
            lazy: () => import("@/pages/ProjectProfilePage"),
          },
          {
            path: "dut",
            lazy: () => import("@/pages/ProjectDutPage"),
          },
          {
            path: "requirements",
            lazy: () => import("@/pages/ProjectRequirementsPage"),
          },
          {
            path: "test-items",
            lazy: () => import("@/pages/ProjectTestItemsPage"),
          },
          {
            path: "rounds/:roundId",
            lazy: () => import("@/pages/ProjectTestRoundPage"),
          },
          {
            path: "issues",
            lazy: () => import("@/pages/ProjectIssuesPage"),
          },
          {
            path: "documents",
            lazy: () => import("@/pages/ProjectDocumentsPage"),
          },
        ],
      },
    ],
  },
]);
