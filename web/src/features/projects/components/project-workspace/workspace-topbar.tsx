import { ArrowLeft, LogOut, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router";
import { ThemeToggle } from "@/components/provider/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { levelVariant, statusVariant } from "../../status-style";
import type { Project } from "../../types";

export function WorkspaceTopbar({
  project,
  executionRate,
  openIssues,
}: {
  project: Project;
  executionRate: number;
  openIssues: number;
}) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clear = useAuthStore((state) => state.clear);

  return (
    <header className="workspace-topbar sticky top-0 z-30">
      <div className="workspace-topbar-main">
        <div className="flex min-w-0 items-center gap-2.5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="workspace-topbar-icon"
            aria-label="返回项目详情"
            onClick={() => navigate(`/projects/${project.id}`)}
          >
            <ArrowLeft aria-hidden />
          </Button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="workspace-topbar-id font-mono">{project.id}</span>
              <span className="workspace-topbar-divider hidden sm:block" aria-hidden />
              <span className="workspace-topbar-eyebrow hidden font-mono sm:block">WORKSPACE</span>
            </div>
            <h1 className="workspace-topbar-title mt-1 truncate">{project.name}</h1>
          </div>

          <Badge variant={statusVariant[project.status]} className="hidden lg:inline-flex">
            <span className="status-dot" aria-hidden />
            {project.status}
          </Badge>
          <Badge
            variant={levelVariant[project.level]}
            className="workspace-topbar-level hidden xl:inline-flex"
          >
            <ShieldCheck data-icon="inline-start" aria-hidden />
            安全 {project.level}
          </Badge>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <TopMetric label="执行" value={`${executionRate}%`} />
          <TopMetric
            label="未闭环"
            value={String(openIssues)}
            tone={openIssues > 0 ? "danger" : "default"}
          />
          <span className="workspace-topbar-divider hidden h-6 xl:block" aria-hidden />
          <span className="workspace-topbar-user hidden min-w-0 items-center gap-2 xl:flex">
            <ShieldCheck className="size-3.5" aria-hidden />
            <span className="truncate">{user?.displayName ?? "系统管理员"}</span>
          </span>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon-sm"
            className="workspace-topbar-icon"
            aria-label="退出登录"
            onClick={clear}
          >
            <LogOut aria-hidden />
          </Button>
        </div>
      </div>
      <span className="workspace-topbar-beam" aria-hidden />
    </header>
  );
}

function TopMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <span className="workspace-topbar-metric font-mono">
      <span className="workspace-topbar-muted font-sans text-[10px]">{label}</span>
      <span className={tone === "danger" ? "workspace-topbar-danger" : ""}>{value}</span>
    </span>
  );
}
