import { Loader2 } from "lucide-react";

export function RouteLoading() {
  return (
    <main className="bg-background text-muted-foreground flex min-h-svh items-center justify-center gap-2 text-sm">
      <Loader2 className="animate-spin" aria-hidden />
      <span>正在加载</span>
    </main>
  );
}
