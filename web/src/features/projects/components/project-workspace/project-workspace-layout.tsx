import { Boxes, CircleCheck, FileText, GitBranch, ListChecks } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { gsap, useGSAP } from "@/lib/gsap";
import { useAuthStore } from "@/stores/auth-store";
import type { Project } from "@/features/projects/types";
import { WorkspaceTopbar } from "./workspace-topbar";

export interface ProjectWorkspaceOutletContext {
  project: Project;
  executionRate: number;
  openIssues: number;
}

type WorkspaceSection = "tasks" | "assets" | "requirements" | "execution" | "delivery";

const NAV_SECTIONS: Array<{
  value: WorkspaceSection;
  label: string;
  icon: LucideIcon;
  path: string;
}> = [
  { value: "tasks", label: "作业台", icon: CircleCheck, path: "" },
  { value: "assets", label: "资料与对象", icon: Boxes, path: "profile" },
  { value: "requirements", label: "需求与追踪", icon: GitBranch, path: "requirements" },
  { value: "execution", label: "测试与执行", icon: ListChecks, path: "test-items" },
  { value: "delivery", label: "交付与文档", icon: FileText, path: "documents" },
];

export function ProjectWorkspaceLayout({
  project,
  children,
}: {
  project: Project;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const executionRate = Math.round((project.casesExecuted / Math.max(project.casesTotal, 1)) * 100);
  const openIssues =
    project.openIssues.critical +
    project.openIssues.serious +
    project.openIssues.normal +
    project.openIssues.suggestion;
  const activeSection = getActiveSection(location.pathname, project.id);

  useGSAP(
    () => {
      if (!containerRef.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.fromTo(
        ".workspace-topbar",
        { opacity: 0, y: -14 },
        { opacity: 1, y: 0, duration: 0.34, ease: "power3.out" },
      );
      gsap.fromTo(
        ".workspace-primary-nav",
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, delay: 0.05, ease: "power3.out" },
      );
    },
    { scope: containerRef },
  );

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const handleSectionChange = (value: string) => {
    const section = NAV_SECTIONS.find((item) => item.value === value);
    if (!section) return;
    const target = `/projects/${project.id}/workspace${section.path ? `/${section.path}` : ""}`;
    navigate(target);
  };

  return (
    <div ref={containerRef} className="workspace-shell flex min-h-svh flex-col">
      <WorkspaceTopbar project={project} executionRate={executionRate} openIssues={openIssues} />

      <div className="workspace-body flex min-h-0 flex-1 flex-col">
        <nav aria-label="项目工作区一级导航" className="workspace-primary-nav">
          <Tabs value={activeSection} onValueChange={handleSectionChange}>
            <TabsList variant="line" className="w-full overflow-x-auto">
              {NAV_SECTIONS.map((section) => (
                <TabsTrigger key={section.value} value={section.value} className="min-w-28 px-3">
                  <section.icon aria-hidden />
                  {section.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </nav>

        <main key={location.pathname} className="workspace-route min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

function getActiveSection(pathname: string, projectCode: string): WorkspaceSection {
  const prefix = `/projects/${projectCode}/workspace/`;
  if (!pathname.startsWith(prefix)) return "tasks";
  const segment = pathname.slice(prefix.length).split("/")[0];
  if (!segment) return "tasks";
  if (segment === "profile" || segment === "dut") return "assets";
  if (
    segment === "test-items" ||
    segment === "rounds" ||
    segment === "issues" ||
    segment === "overview"
  ) {
    return "execution";
  }
  if (segment === "documents") return "delivery";
  if (segment === "requirements") return "requirements";
  return "tasks";
}
