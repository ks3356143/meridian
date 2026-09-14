import { Navigate, useSearchParams } from "react-router";
import { LoginForm } from "@/features/auth/components/login-form";
import { LoginVisual } from "@/features/auth/components/login-visual";
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
