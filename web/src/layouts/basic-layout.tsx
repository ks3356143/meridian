import { useQuery } from "@tanstack/react-query";
import { FolderKanban, LogOut, MenuIcon, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Navigate, NavLink, Outlet, useMatch } from "react-router";
import { cn } from "cn";
import { BrandLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/provider/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
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
      <main className="bg-background flex min-h-svh items-center justify-center p-6">
        <div className="flex w-full max-w-sm flex-col gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      </main>
    );
  }
  if (currentUserQuery.isError) {
    return <Navigate to="/login" replace />;
  }

  const user = currentUserQuery.data;
  const navigation = (
    <nav className="flex flex-1 flex-col gap-2" aria-label="主导航">
      <SidebarLink to="/" end icon={FolderKanban} onClick={() => setMobileNavOpen(false)}>
        项目列表
      </SidebarLink>
      {user.role === "admin" ? (
        <SidebarLink
          to="/settings/dictionaries"
          icon={SlidersHorizontal}
          onClick={() => setMobileNavOpen(false)}
        >
          字典配置
        </SidebarLink>
      ) : null}
    </nav>
  );

  return (
    <div className="bg-background flex min-h-svh flex-col lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      <aside className="border-border bg-card/50 sticky top-0 z-20 hidden h-svh flex-col overflow-hidden border-r lg:flex">
        <div
          className="visual-glow pointer-events-none absolute -top-24 -right-20 size-80 opacity-35"
          aria-hidden
        />
        <div className="border-border relative flex h-14 items-center gap-2.5 border-b px-5">
          <BrandLogo className="text-primary size-8 shrink-0" />
          <div className="min-w-0">
            <p className="brand-wordmark truncate text-sm font-semibold">ChenMeridian</p>
            <p className="text-muted-foreground font-mono text-[10px]">V0.0.1</p>
          </div>
        </div>
        <div className="relative flex flex-1 flex-col p-3">{navigation}</div>
        <div className="border-border relative flex items-center gap-2 border-t px-5 py-3">
          <ShieldCheck className="text-primary size-4" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{user.displayName}</p>
            <p className="text-muted-foreground font-mono text-[10px]">{user.role}</p>
          </div>
        </div>
      </aside>

      <div className="flex min-h-svh flex-col">
        <header className="border-border bg-background/92 sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b px-4 shadow-[0_1px_10px_-8px_rgb(20_42_30_/_0.32)] backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="lg:hidden"
                  aria-label="打开导航菜单"
                >
                  <MenuIcon aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader className="items-center gap-2 pr-12">
                  <BrandLogo className="text-primary size-8" aria-hidden />
                  <SheetTitle className="brand-wordmark">ChenMeridian</SheetTitle>
                </SheetHeader>
                <div className="flex flex-1 flex-col p-3">{navigation}</div>
              </SheetContent>
            </Sheet>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.displayName}</p>
              <Badge variant="outline" className="h-4 px-1 text-[10px] uppercase">
                {user.role}
              </Badge>
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
        <main className="flex-1 p-5 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarLink({
  to,
  end,
  icon: Icon,
  onClick,
  children,
}: {
  to: string;
  end?: boolean;
  icon: typeof FolderKanban;
  onClick?: () => void;
  children: ReactNode;
}) {
  const match = useMatch({ path: to, end });
  const active = Boolean(match);

  return (
    <Button
      asChild
      variant="ghost"
      className={cn(
        "h-auto w-full justify-start px-3 py-2.5 text-sm",
        active
          ? "border-primary/30 bg-primary/12 font-semibold text-primary hover:bg-primary/10"
          : "text-foreground hover:bg-primary/6 hover:text-primary",
      )}
    >
      <NavLink to={to} end={end} onClick={onClick}>
        <Icon data-icon="inline-start" aria-hidden />
        {children}
      </NavLink>
    </Button>
  );
}
