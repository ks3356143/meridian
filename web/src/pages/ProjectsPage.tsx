import { gsap, useGSAP } from "@/lib/gsap";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FolderKanban, FolderPlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { QueryError, QueryLoading } from "@/components/shared/query-state";
import { projectsApi } from "@/features/projects/api";
import { KpiBar } from "@/features/projects/components/kpi-bar";
import { ProjectFilters } from "@/features/projects/components/project-filters";
import {
  emptyProjectFilters,
  loadProjectFilters,
  saveProjectFilters,
  type ProjectFilterValues,
} from "@/features/projects/components/project-filter-state";
import { ProjectsTable } from "@/features/projects/components/projects-table";
import { RiskActivityBar } from "@/features/projects/components/risk-activity-bar";
import { TodoPanel } from "@/features/projects/components/todo-panel";

export function Component() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<ProjectFilterValues>(loadProjectFilters);
  const projectsQuery = useQuery({ queryKey: ["projects", "list"], queryFn: projectsApi.list });
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

  useEffect(() => {
    saveProjectFilters(filters);
  }, [filters]);

  const filteredProjects = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase();
    return projects.filter((project) => {
      const keywordMatched =
        keyword.length === 0 ||
        [project.id, project.name, project.organization, project.owner].some((field) =>
          String(field ?? "")
            .toLowerCase()
            .includes(keyword),
        );
      const statusMatched = filters.status.length === 0 || project.status === filters.status;
      const levelMatched = filters.level.length === 0 || project.level === filters.level;
      const platformMatched =
        filters.platform.length === 0 || project.platform === filters.platform;
      return keywordMatched && statusMatched && levelMatched && platformMatched;
    });
  }, [filters, projects]);

  useGSAP(
    () => {
      if (!containerRef.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.from(".dash-reveal", {
        opacity: 0,
        y: 18,
        duration: 0.5,
        stagger: 0.07,
        ease: "power3.out",
      });

      const root = containerRef.current;
      const counters = Array.from(root?.querySelectorAll<HTMLElement>(".metric-count") ?? []);
      counters.forEach((el) => {
        const target = Number(el.dataset.value ?? "0");
        gsap.fromTo(
          el,
          { innerText: 0 },
          { innerText: target, duration: 0.8, ease: "power2.out", snap: { innerText: 1 } },
        );
      });

      gsap.fromTo(
        ".page-header .meridian-beam",
        { xPercent: -100 },
        { xPercent: 100, duration: 4.5, repeat: -1, repeatDelay: 0.8, ease: "none" },
      );
    },
    { scope: containerRef },
  );

  const today = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  if (projectsQuery.isPending) {
    return <QueryLoading label="正在加载项目列表" rows={7} />;
  }

  if (projectsQuery.isError) {
    return (
      <QueryError
        title="项目列表加载失败"
        description="请确认后端服务已启动，然后重新加载。"
        onRetry={() => projectsQuery.refetch()}
      />
    );
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-6 overflow-hidden">
      <svg
        className="globe-wireframe text-primary/6 pointer-events-none absolute -top-28 -right-28 size-[26rem]"
        viewBox="0 0 200 200"
        fill="none"
        aria-hidden
      >
        <circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth="0.75" />
        <ellipse cx="100" cy="100" rx="56" ry="88" stroke="currentColor" strokeWidth="0.75" />
        <ellipse cx="100" cy="100" rx="24" ry="88" stroke="currentColor" strokeWidth="0.75" />
        <ellipse cx="100" cy="100" rx="88" ry="34" stroke="currentColor" strokeWidth="0.75" />
        <line x1="12" y1="100" x2="188" y2="100" stroke="currentColor" strokeWidth="0.75" />
      </svg>

      <PageHeader
        className="dash-reveal"
        icon={FolderKanban}
        title="项目列表"
        description={today}
        badge={
          <Badge variant="primary" className="h-6 font-mono">
            {filteredProjects.length}/{projects.length}
          </Badge>
        }
        actions={
          <Button size="sm" type="button" onClick={() => navigate("/projects/new")}>
            <FolderPlus data-icon="inline-start" />
            新建项目
          </Button>
        }
      />

      <div className="dash-reveal">
        <ProjectFilters
          filters={filters}
          resultCount={filteredProjects.length}
          totalCount={projects.length}
          onChange={setFilters}
        />
      </div>

      <div className="dash-reveal">
        <KpiBar projects={filteredProjects} />
      </div>

      <RiskActivityBar projects={filteredProjects} />

      <div className="flex min-w-0 flex-col items-stretch gap-5 min-[1760px]:flex-row min-[1760px]:items-start">
        <div className="dash-reveal min-w-0 flex-1">
          <ProjectsTable
            projects={filteredProjects}
            onClearFilters={() => setFilters(emptyProjectFilters)}
          />
        </div>
        <div className="dash-reveal hidden min-[1760px]:block">
          <TodoPanel projects={filteredProjects} />
        </div>
      </div>

      <p className="text-muted-foreground dash-reveal flex items-center gap-1.5 text-xs">
        <CalendarDays className="size-3.5" aria-hidden />
        统计口径跟随当前筛选结果变化
      </p>
    </div>
  );
}
