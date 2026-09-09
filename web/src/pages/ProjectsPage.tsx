import { gsap, useGSAP } from "@/lib/gsap";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FilePlus2, FolderPlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
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

const TITLE = "项目组合";

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
          field.toLowerCase().includes(keyword),
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

      gsap.from(".dash-title-char", {
        opacity: 0,
        yPercent: 70,
        duration: 0.5,
        stagger: 0.04,
        ease: "power3.out",
        delay: 0.15,
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
        ".dash-beam",
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
    return (
      <div className="flex min-h-80 items-center justify-center">
        <span className="text-muted-foreground text-sm">正在加载项目组合</span>
      </div>
    );
  }

  if (projectsQuery.isError) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center gap-3">
        <p className="text-sm">项目列表加载失败</p>
        <Button variant="outline" onClick={() => projectsQuery.refetch()}>
          重新加载
        </Button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-4 overflow-hidden">
      <svg
        className="globe-wireframe text-primary/5 pointer-events-none absolute -top-24 -right-24 size-96"
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

      <header className="dash-reveal flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {TITLE.split("").map((char, index) => (
              <span
                key={index}
                className="dash-title-char wordmark-char inline-block"
                style={{
                  backgroundImage: "var(--wordmark-gradient)",
                  backgroundSize: `${TITLE.length * 100}% 100%`,
                  backgroundPositionX: `${(index / (TITLE.length - 1)) * 100}%`,
                }}
              >
                {char}
              </span>
            ))}
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
            <CalendarDays className="size-3.5" aria-hidden />
            {today}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" type="button">
            <FilePlus2 data-icon="inline-start" />
            生成文档
          </Button>
          <Button size="sm" type="button" onClick={() => navigate("/projects/new")}>
            <FolderPlus data-icon="inline-start" />
            新建项目
          </Button>
        </div>
      </header>

      <div className="dash-reveal border-border/60 relative h-px w-full">
        <div className="dash-beam meridian-beam absolute inset-y-0 left-0 w-full" aria-hidden />
      </div>

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

      <div className="flex flex-col items-stretch gap-4 min-[1760px]:flex-row min-[1760px]:items-start">
        <div className="min-w-0 flex-1">
          <ProjectsTable
            projects={filteredProjects}
            onClearFilters={() => setFilters(emptyProjectFilters)}
          />
        </div>
        <div className="dash-reveal hidden min-[1760px]:block">
          <TodoPanel projects={filteredProjects} />
        </div>
      </div>
    </div>
  );
}
