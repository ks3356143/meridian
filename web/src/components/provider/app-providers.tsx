import type { ReactNode } from "react";
import { ReducedMotionContext } from "@animate-ui/react/utils/motion";
import { MotionConfig } from "@/lib/motion";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppThemeProvider } from "./theme-provider";
import { QueryProvider } from "./query-provider";
import { SelectionDragGuard } from "./selection-drag-guard";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppThemeProvider>
      <QueryProvider>
        <ReducedMotionContext.Provider value="never">
          <MotionConfig reducedMotion="never">
            <TooltipProvider delayDuration={150}>
              <SelectionDragGuard />
              {children}
              <Toaster />
            </TooltipProvider>
          </MotionConfig>
        </ReducedMotionContext.Provider>
      </QueryProvider>
    </AppThemeProvider>
  );
}
