import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { AppProviders } from "@/components/provider/app-providers";
import { router } from "@/router";
import "@/styles/app.css";

createRoot(document.getElementById("root")!).render(
  <AppProviders>
    <RouterProvider router={router} />
  </AppProviders>,
);
