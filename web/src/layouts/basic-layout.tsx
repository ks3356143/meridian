import { useQuery } from "@tanstack/react-query";
import { LogOut, MenuIcon, ShieldCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Navigate, NavLink, Outlet } from "react-router";
import { cn } from "cn";
import { BrandLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/provider/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { authApi } from "@/features/auth/api";
import { useAuthStore } from "@/stores/auth-store";

export default function BasicLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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
      <aside className="border-border bg-card/45 sticky top-0 z-20 hidden h-svh border-r lg:flex lg:flex-col">
        <div className="border-border elevation-1 flex h-14 items-center gap-2 border-b px-4">
          <BrandLogo className="text-primary size-8 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">ChenMeridian</p>
            <p className="text-muted-foreground font-mono text-[10px]">V0.0.1</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col p-3">
          <SidebarLink to="/" end>
            项目列表
          </SidebarLink>
          {user.role === "admin" ? (
            <SidebarLink className="mt-2" to="/settings/dictionaries">
              字典配置
            </SidebarLink>
          ) : null}
        </nav>
      </aside>

      <div className="flex min-h-svh flex-col">
        <header className="border-border bg-background/90 sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b px-4 shadow-[0_1px_10px_-8px_rgb(20_42_30_/_0.32)] backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="lg:hidden"
                  aria-label="打开导航菜单"
                >
                  <MenuIcon aria-hidden />
                </Button>
              </DialogTrigger>
              <DialogContent
                aria-describedby={undefined}
                className="top-0 left-0 h-svh max-h-none w-72 max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-r p-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
              >
                <DialogHeader className="border-border border-b p-4 pr-12">
                  <DialogTitle>导航菜单</DialogTitle>
                </DialogHeader>
                <nav className="flex flex-1 flex-col gap-2 p-3">
                  <SidebarLink to="/" end onClick={() => setMobileNavOpen(false)}>
                    项目列表
                  </SidebarLink>
                  {user.role === "admin" ? (
                    <SidebarLink
                      to="/settings/dictionaries"
                      onClick={() => setMobileNavOpen(false)}
                    >
                      字典配置
                    </SidebarLink>
                  ) : null}
                </nav>
              </DialogContent>
            </Dialog>
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

function SidebarLink({
  to,
  end,
  onClick,
  className,
  children,
}: {
  to: string;
  end?: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "elevation-1 border px-3 py-2 text-sm transition-[color,background-color,border-color,box-shadow] duration-200",
          isActive
            ? "border-primary bg-primary/12 font-semibold text-primary hover:bg-primary/10"
            : "border-border bg-card/70 font-medium text-foreground hover:border-primary/30 hover:bg-primary/6 hover:text-primary",
          className,
        )
      }
    >
      {children}
    </NavLink>
  );
}
