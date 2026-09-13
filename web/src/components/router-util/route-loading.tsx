import { BrandLogo } from "@/components/brand/logo";
import { ShinyText } from "@/components/ui/shiny-text";

export function RouteLoading() {
  return (
    <main className="bg-background relative flex min-h-svh flex-col items-center justify-center gap-5 overflow-hidden p-6">
      <div
        aria-hidden="true"
        className="visual-glow pointer-events-none absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/2"
      />
      <div className="relative flex size-16 items-center justify-center">
        <svg
          aria-hidden="true"
          viewBox="0 0 32 32"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="orbit-spin absolute -inset-2.5 text-primary/40"
        >
          <ellipse cx="16" cy="16" rx="14.5" ry="6.5" />
        </svg>
        <BrandLogo className="size-10 text-primary" />
      </div>
      <span className="brand-wordmark text-2xl font-bold">ChenMeridian</span>
      <ShinyText text="正在校准经线" speed={2.4} className="text-sm" />
      <span aria-live="polite" aria-busy="true" className="sr-only">
        正在加载页面
      </span>
    </main>
  );
}
