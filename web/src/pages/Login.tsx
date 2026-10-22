import { Navigate, useSearchParams } from "react-router";
import { LoginForm } from "@/features/auth/components/login-form";
import { LoginVisual } from "@/features/auth/components/login-visual";
import { BrandLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/provider/theme-toggle";
import { Card } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";

export function Component() {
  const token = useAuthStore((state) => state.token);
  const [searchParams] = useSearchParams();
  const redirectTo = getSafeRedirect(searchParams.get("redirect"));

  if (token) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <main className="bg-background flex min-h-svh flex-col lg:flex-row">
      <LoginVisual />
      <section className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12">
        <div className="login-ambient pointer-events-none absolute" aria-hidden />
        <div className="animate-in fade-in-0 absolute top-6 left-6 flex items-center gap-2.5 duration-200 slide-in-from-top-1 motion-reduce:animate-none lg:hidden">
          <BrandLogo className="text-primary size-8 shrink-0" />
          <div>
            <p className="brand-wordmark text-sm font-semibold">ChenMeridian</p>
            <p className="text-muted-foreground text-[10px]">本地测试管理工作台</p>
          </div>
        </div>
        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>
        <div className="relative w-full max-w-md">
          <Card className="relative overflow-hidden py-0">
            <span
              className="from-primary via-info to-warning absolute inset-y-0 left-0 w-[4px] bg-gradient-to-b"
              aria-hidden
            />
            <LoginForm redirectTo={redirectTo} />
          </Card>
        </div>
      </section>
    </main>
  );
}

function getSafeRedirect(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
