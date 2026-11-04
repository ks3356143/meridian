import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppThemeProvider } from "./theme-provider";
import { QueryProvider } from "./query-provider";
import { SelectionDragGuard } from "./selection-drag-guard";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppThemeProvider>
      <QueryProvider>
        <TooltipProvider delayDuration={150}>
          <SelectionDragGuard />
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryProvider>
    </AppThemeProvider>
  );
}
