import type { ReactNode } from "react";
import { AnimateUIProvider } from "@animate-ui/react/provider";
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
        <AnimateUIProvider reducedMotion="never">
          <MotionConfig reducedMotion="never">
            <TooltipProvider delayDuration={150}>
              <SelectionDragGuard />
              {children}
              <Toaster />
            </TooltipProvider>
          </MotionConfig>
        </AnimateUIProvider>
      </QueryProvider>
    </AppThemeProvider>
  );
}
