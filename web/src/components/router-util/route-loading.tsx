import { Skeleton } from "@/components/ui/skeleton";

export function RouteLoading() {
  return (
    <main className="bg-background flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col gap-4" aria-live="polite" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="mt-4 h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-2/3" />
        <span className="sr-only">正在加载页面</span>
      </div>
    </main>
  );
}
