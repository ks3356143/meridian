import {
  Boxes,
  CircleCheck,
  FileText,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  ListChecks,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate, useNavigationType } from "react-router";
import { QueryLoading } from "@/components/shared/query-state";
import { AppQuickSwitcher } from "@/components/shared/app-quick-switcher";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { gsap, useGSAP } from "@/lib/gsap";
import { useAuthStore } from "@/stores/auth-store";
import { useRevealActiveTab } from "@/hooks/use-reveal-active-tab";
import type { Project } from "@/features/projects/types";
import { WorkspaceTopbar } from "./workspace-topbar";
import { RoundSwitcher } from "./round-switcher";
import { ALL_ROUNDS_ID, useRoundSelection } from "./use-round-selection";
import styles from "./project-workspace-layout.module.css";

export interface ProjectWorkspaceOutletContext {
  project: Project;
  executionRate: number;
  openIssues: number;
}

type WorkspaceSection = "tasks" | "assets" | "requirements" | "execution" | "delivery";

const NAV_SECTIONS: Array<{
  value: WorkspaceSection;
  label: string;
  description: string;
  icon: LucideIcon;
  path: string;
}> = [
  {
    value: "tasks",
    label: "作业台",
    description: "当前任务、数据链路与模块状态",
    icon: CircleCheck,
    path: "",
  },
  {
    value: "assets",
    label: "资料与对象",
    description: "接收文件、工作对象与版本",
    icon: Boxes,
    path: "profile",
  },
  {
    value: "requirements",
    label: "需求与追踪",
    description: "需求树、候选确认与追踪",
    icon: GitBranch,
    path: "requirements",
  },
  {
    value: "execution",
    label: "测试与执行",
    description: "测试项树、用例与静态测试",
    icon: ListChecks,
    path: "test-items",
  },
  {
    value: "delivery",
    label: "交付与文档",
    description: "文档清单、预检与交付导出",
    icon: FileText,
    path: "documents",
  },
];

const SECTION_PRELOADERS: Partial<Record<WorkspaceSection, () => Promise<unknown>>> = {
  tasks: () => import("@/pages/ProjectWorkspaceEntryPage"),
  assets: () => import("@/pages/ProjectProfilePage"),
  requirements: () => import("@/pages/ProjectRequirementsPage"),
  execution: () => import("@/pages/ProjectTestItemsPage"),
  delivery: () => import("@/pages/ProjectDocumentsPage"),
};

const PROJECT_QUICK_SWITCH_ITEMS = [
  {
    value: "project-detail",
    label: "项目详情",
    description: "返回当前项目总览",
    icon: LayoutDashboard,
  },
  {
    value: "projects",
    label: "项目列表",
    description: "浏览全部测评项目",
    icon: FolderKanban,
  },
] as const;

function preloadSection(section: WorkspaceSection) {
  void SECTION_PRELOADERS[section]?.().catch(() => undefined);
}

export function ProjectWorkspaceLayout({
  project,
  children,
}: {
  project: Project;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const [pendingSection, setPendingSection] = useState<{
    fromPath: string;
    section: WorkspaceSection;
  } | null>(null);
  const token = useAuthStore((state) => state.token);
  const executionRate = Math.round((project.casesExecuted / Math.max(project.casesTotal, 1)) * 100);
  const openIssues =
    project.openIssues.critical +
    project.openIssues.serious +
    project.openIssues.normal +
    project.openIssues.suggestion;
  const activeSection = getActiveSection(location.pathname, project.id);
  const workspaceSegment = getWorkspaceSegment(location.pathname, project.id);
  const showRoundSwitcher = ["test-items", "rounds", "issues", "documents"].includes(
    workspaceSegment,
  );
  const allowAllRounds = workspaceSegment === "test-items";
  const roundSelection = useRoundSelection(project.id, showRoundSwitcher, allowAllRounds);
  // 浏览器前进/后退是 POP 导航，不能复用点击导航的一次性加载遮罩；
  // 否则快速后退会在目标路径命中旧 fromPath，页面永久停在加载态。
  const switchingSection =
    navigationType !== "POP" &&
    pendingSection !== null &&
    location.pathname === pendingSection.fromPath;
  const displayedSection = switchingSection ? pendingSection.section : activeSection;

  useLayoutEffect(() => {
    if (pendingSection && location.pathname !== pendingSection.fromPath) {
      // 目标路由已经提交，清除一次性过渡标记；否则浏览器后退会误命中旧路径。
      // oxlint-disable-next-line react/set-state-in-effect
      setPendingSection(null);
    }
  }, [location.pathname, pendingSection]);

  useRevealActiveTab(listRef, displayedSection);

  const indicatorRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) return;
    let cancelled = false;
    // 按真实宽度定位：Tab 不等宽或处于横向滚动时仍然对齐。
    const measure = () => {
      if (cancelled) return;
      list.removeAttribute("data-indicator-ready");
      const activeIndex = NAV_SECTIONS.findIndex((section) => section.value === displayedSection);
      const active = list.querySelectorAll<HTMLElement>('[data-slot="tabs-trigger"]')[activeIndex];
      if (!active) return;
      indicator.style.width = `${active.offsetWidth}px`;
      indicator.style.transform = `translateX(${active.offsetLeft}px)`;
      list.dataset.indicatorReady = "true";
    };
    measure();
    void document.fonts.ready.then(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [displayedSection]);

  useGSAP(
    () => {
      if (!containerRef.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.fromTo(
        ".workspace-topbar",
        { opacity: 0.9 },
        { opacity: 1, duration: 0.18, ease: "power2.out", clearProps: "opacity" },
      );
      gsap.fromTo(
        ".workspace-primary-nav",
        { opacity: 0.88 },
        {
          opacity: 1,
          duration: 0.2,
          delay: 0.02,
          ease: "power2.out",
          clearProps: "opacity",
        },
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

    let target = `/projects/${project.id}/workspace${section.path ? `/${section.path}` : ""}`;
    const targetSupportsRound = section.value === "execution" || section.value === "delivery";
    if (targetSupportsRound) {
      const fallbackRound =
        roundSelection.rounds.filter((round) => round.status !== "closed").at(-1) ??
        roundSelection.rounds.at(-1);
      const targetRound =
        roundSelection.roundId === ALL_ROUNDS_ID
          ? fallbackRound?.id
          : roundSelection.roundId || fallbackRound?.id;
      if (targetRound) target += `?roundId=${encodeURIComponent(targetRound)}`;
    }
    if (target !== location.pathname) {
      setPendingSection({ fromPath: location.pathname, section: section.value });
    }
    navigate(target);
  };

  return (
    <div ref={containerRef} className="workspace-shell flex h-svh min-h-0 flex-col">
      <WorkspaceTopbar
        project={project}
        executionRate={executionRate}
        openIssues={openIssues}
        roundSwitcher={
          showRoundSwitcher ? (
            <RoundSwitcher
              projectCode={project.id}
              rounds={roundSelection.rounds}
              roundId={roundSelection.roundId}
              allowAll={allowAllRounds}
              loading={roundSelection.isLoading}
              onRoundChange={roundSelection.setRoundId}
            />
          ) : undefined
        }
        quickSwitcher={
          <AppQuickSwitcher
            items={[...NAV_SECTIONS, ...PROJECT_QUICK_SWITCH_ITEMS]}
            activeValue={displayedSection}
            onSelect={(value) => {
              if (value === "project-detail") {
                navigate(`/projects/${project.id}`);
                return;
              }
              if (value === "projects") {
                navigate("/");
                return;
              }
              handleSectionChange(value);
            }}
            onPreload={(value) => {
              const section = NAV_SECTIONS.find((item) => item.value === value);
              if (section) preloadSection(section.value);
            }}
          />
        }
      />

      <div className="workspace-body flex min-h-0 flex-1 flex-col">
        <nav
          aria-label="项目工作区一级导航"
          className={`workspace-primary-nav ${styles.primaryNav}`}
        >
          <Tabs value={displayedSection} onValueChange={handleSectionChange}>
            <TabsList
              ref={listRef}
              variant="default"
              className={`${styles.tabList} w-full overflow-x-auto`}
            >
              {NAV_SECTIONS.map((section) => (
                <TabsTrigger
                  key={section.value}
                  value={section.value}
                  className={styles.tabTrigger}
                  onFocus={() => preloadSection(section.value)}
                  onPointerEnter={() => preloadSection(section.value)}
                >
                  <section.icon className={styles.tabIcon} aria-hidden />
                  {section.label}
                </TabsTrigger>
              ))}
              <span ref={indicatorRef} className={styles.tabIndicator} aria-hidden />
            </TabsList>
          </Tabs>
        </nav>

        <main
          key={location.pathname}
          className="workspace-route min-w-0 flex-1"
          data-workspace-section={activeSection}
        >
          {switchingSection ? <QueryLoading label="正在加载工作区模块" rows={6} /> : children}
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

function getWorkspaceSegment(pathname: string, projectCode: string) {
  const prefix = `/projects/${projectCode}/workspace/`;
  return pathname.startsWith(prefix) ? pathname.slice(prefix.length).split("/")[0] : "";
}
