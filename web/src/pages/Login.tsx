import { Navigate } from "react-router";
import { LoginForm } from "@/features/auth/components/login-form";
import { LoginVisual } from "@/features/auth/components/login-visual";
import { ThemeToggle } from "@/components/provider/theme-toggle";
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
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
