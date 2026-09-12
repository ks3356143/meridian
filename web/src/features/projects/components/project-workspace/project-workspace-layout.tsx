import {
  BookOpen,
  Boxes,
  ClipboardList,
  FileText,
  GitBranch,
  History,
  ListChecks,
  Settings2,
  ShieldAlert,
} from "lucide-react";
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

type WorkspaceSection =
  | "outline"
  | "overview"
  | "profile"
  | "dut"
  | "requirements"
  | "test-items"
  | "rounds"
  | "issues"
  | "documents";

const NAV_SECTIONS: Array<{
  value: WorkspaceSection;
  label: string;
  icon: LucideIcon;
}> = [
  { value: "outline", label: "大纲编制", icon: BookOpen },
  { value: "overview", label: "执行总览", icon: ClipboardList },
  { value: "profile", label: "项目资料", icon: Settings2 },
  { value: "dut", label: "被测对象", icon: Boxes },
  { value: "requirements", label: "需求追溯", icon: GitBranch },
  { value: "test-items", label: "测试设计", icon: ListChecks },
  { value: "rounds", label: "轮次工作区", icon: History },
  { value: "issues", label: "问题单", icon: ShieldAlert },
  { value: "documents", label: "文档产出", icon: FileText },
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
    const target =
      section.value === "rounds"
        ? `/projects/${project.id}/workspace/rounds/round-1`
        : `/projects/${project.id}/workspace/${section.value}`;
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
                <TabsTrigger key={section.value} value={section.value} className="min-w-24 px-3">
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
  if (!pathname.startsWith(prefix)) return "outline";
  const segment = pathname.slice(prefix.length).split("/")[0];
  const matched = NAV_SECTIONS.find((section) => section.value === segment);
  return matched?.value ?? "overview";
}
