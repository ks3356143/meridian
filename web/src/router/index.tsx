import { createBrowserRouter } from "react-router";
import { RouterErrorBoundary } from "@/components/router-util/error-boundary";
import { RootRoute } from "@/components/router-util/root-route";
import BasicLayout from "@/layouts/basic-layout";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootRoute />,
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
            path: "projects/:projectId",
            lazy: () => import("@/pages/ProjectWorkbenchPage"),
          },
        ],
      },
    ],
  },
]);
