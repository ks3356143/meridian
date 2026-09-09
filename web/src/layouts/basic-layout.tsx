import { useQuery } from "@tanstack/react-query";
import { LogOut, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { Navigate, NavLink, Outlet } from "react-router";
import { BrandLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/provider/theme-toggle";
import { Button } from "@/components/ui/button";
import { authApi } from "@/features/auth/api";
import { useAuthStore } from "@/stores/auth-store";

export default function BasicLayout() {
  const token = useAuthStore((state) => state.token);
  const setUser = useAuthStore((state) => state.setUser);
  const clear = useAuthStore((state) => state.clear);
  const currentUserQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: authApi.me,
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (currentUserQuery.data) {
      setUser(currentUserQuery.data);
    }
  }, [currentUserQuery.data, setUser]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (currentUserQuery.isPending) {
    return (
      <main className="bg-background flex min-h-svh items-center justify-center">
        <span className="text-muted-foreground text-sm">正在检查登录状态</span>
      </main>
    );
  }
  if (currentUserQuery.isError) {
    return <Navigate to="/login" replace />;
  }

  const user = currentUserQuery.data;

  return (
    <div className="bg-background flex min-h-svh flex-col lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="border-border bg-card/45 hidden border-r lg:flex lg:flex-col">
        <div className="border-border elevation-1 flex h-14 items-center gap-2 border-b px-4">
          <BrandLogo className="text-primary size-8 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">ChenMeridian</p>
            <p className="text-muted-foreground font-mono text-[10px]">V0.0.1</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col p-3">
          <NavLink
            to="/"
            end
            className="border-border bg-card/70 text-foreground hover:border-primary/30 hover:bg-primary/6 hover:text-primary elevation-1 border px-3 py-2 text-sm font-medium transition-[color,background-color,border-color,box-shadow] duration-200"
          >
            项目组合
          </NavLink>
          {user.role === "admin" ? (
            <NavLink
              to="/settings/dictionaries"
              className="border-border bg-card/70 text-foreground hover:border-primary/30 hover:bg-primary/6 hover:text-primary elevation-1 mt-2 border px-3 py-2 text-sm font-medium transition-[color,background-color,border-color,box-shadow] duration-200"
            >
              字典配置
            </NavLink>
          ) : null}
        </nav>
      </aside>

      <div className="flex min-h-svh flex-col">
        <header className="border-border bg-background/90 sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b px-4 shadow-[0_1px_10px_-8px_rgb(20_42_30_/_0.32)] backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <ShieldCheck className="text-primary" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.displayName}</p>
              <p className="text-muted-foreground font-mono text-[10px] uppercase">{user.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={clear}>
              <LogOut data-icon="inline-start" />
              退出
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
