import "@fontsource-variable/geist";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { AppProviders } from "@/components/provider/app-providers";
import { router } from "@/router";
import "@/styles/app.css";
import "@/styles/brand.css";
import "@/styles/route-status.css";
import "@/styles/flow.css";
import "@/styles/overlay.css";
import "@/styles/material.css";
import "@/styles/field-state.css";
import "@/styles/interaction.css";
import "@/styles/card-surface.css";
import "@/styles/tonal-surface.css";
import "@/styles/project-detail.css";
import "@/styles/project-workspace.css";
import "@/styles/upload-progress.css";
import "@/styles/polish.css";
import "@/styles/aesthetic.css";

createRoot(document.getElementById("root")!).render(
  <AppProviders>
    <RouterProvider router={router} />
  </AppProviders>,
);
