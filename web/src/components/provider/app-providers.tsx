import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AppThemeProvider } from "./theme-provider";
import { QueryProvider } from "./query-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppThemeProvider>
      <QueryProvider>
        {children}
        <Toaster position="top-center" closeButton />
      </QueryProvider>
    </AppThemeProvider>
  );
}
