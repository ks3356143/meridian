import { Navigate } from "react-router";
import { LoginForm } from "@/features/auth/components/login-form";
import { LoginVisual } from "@/features/auth/components/login-visual";
import { ThemeToggle } from "@/components/provider/theme-toggle";
import { Card } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";

export function Component() {
  const token = useAuthStore((state) => state.token);
  if (token) {
    return <Navigate to="/" replace />;
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
            <LoginForm />
          </Card>
        </div>
      </section>
    </main>
  );
}
