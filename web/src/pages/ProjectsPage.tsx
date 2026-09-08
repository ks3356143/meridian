import { gsap, useGSAP } from "@/lib/gsap";
import { CalendarDays, FilePlus2, FolderPlus } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { KpiBar } from "@/features/projects/components/kpi-bar";
import { ProjectsTable } from "@/features/projects/components/projects-table";
import { TodoPanel } from "@/features/projects/components/todo-panel";
import { mockProjects } from "@/features/projects/mock";

const TITLE = "项目组合";

export function Component() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
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

      // 匀速流光：起终点都在容器外，循环重置不可见。
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
          <Button variant="outline" size="sm">
            <FilePlus2 data-icon="inline-start" />
            生成文档
          </Button>
          <Button size="sm">
            <FolderPlus data-icon="inline-start" />
            新建项目
          </Button>
        </div>
      </header>

      <div className="dash-reveal border-border/60 relative h-px w-full">
        <div className="dash-beam meridian-beam absolute inset-y-0 left-0 w-full" aria-hidden />
      </div>

      <div className="dash-reveal">
        <KpiBar projects={mockProjects} />
      </div>

      <div className="dash-reveal flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <ProjectsTable projects={mockProjects} />
        </div>
        <div className="dash-reveal hidden xl:block">
          <TodoPanel projects={mockProjects} />
        </div>
      </div>
    </div>
  );
}
