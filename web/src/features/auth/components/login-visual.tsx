import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Database,
  FileText,
  FlaskConical,
  ListChecks,
  Play,
  ShieldCheck,
} from "lucide-react";
import { useRef } from "react";
import { systemApi } from "@/api/system";
import { BrandLogo } from "@/components/brand/logo";
import { gsap, useGSAP } from "@/lib/gsap";

const WORDMARK = "ChenMeridian";
const FLOW_STEPS = [
  { icon: ListChecks, label: "测试项" },
  { icon: FlaskConical, label: "用例" },
  { icon: Play, label: "执行" },
  { icon: FileText, label: "报告" },
];

export function LoginVisual() {
  const containerRef = useRef<HTMLDivElement>(null);
  const healthQuery = useQuery({
    queryKey: ["system", "health"],
    queryFn: systemApi.health,
    refetchInterval: 15_000,
  });

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        containerRef.current?.querySelector(".flow-step")?.classList.add("is-active");
        return;
      }

      gsap.from(".visual-reveal", {
        opacity: 0,
        y: 20,
        duration: 0.6,
        stagger: 0.08,
        ease: "power3.out",
      });

      gsap.from(".visual-wordmark span", {
        opacity: 0,
        yPercent: 70,
        duration: 0.55,
        stagger: 0.028,
        ease: "power3.out",
        delay: 0.2,
      });

      // 起点和终点都在容器外，循环重置时不可见，避免"跳回"。
      gsap.fromTo(
        ".meridian-beam",
        { xPercent: -100 },
        { xPercent: 100, duration: 5.2, repeat: -1, repeatDelay: 0.5, ease: "none" },
      );

      const root = containerRef.current;
      const flowNodes = Array.from(root?.querySelectorAll<HTMLElement>(".flow-step") ?? []);
      const flowProgress = root?.querySelector<HTMLElement>(".flow-progress");
      const flowPulse = root?.querySelector<HTMLElement>(".flow-pulse");

      if (flowNodes.length === FLOW_STEPS.length && flowProgress && flowPulse) {
        const activateStep = (active: number) => {
          flowNodes.forEach((node, index) => {
            node.classList.toggle("is-active", index === active);
            node.classList.toggle("is-complete", index < active);
          });
        };
        const segmentDur = 0.72;
        const travelDur = segmentDur * 3;
        const flowTl = gsap.timeline({ repeat: -1, repeatDelay: 1.5 });

        flowTl.call(() => activateStep(0), undefined, 0);
        flowTl.set(flowProgress, { opacity: 1, scaleX: 0 }, 0);
        flowTl.set(flowPulse, { opacity: 1, xPercent: 0 }, 0);
        flowTl.to(flowProgress, { duration: travelDur, ease: "none", scaleX: 1 }, 0);
        flowTl.to(flowPulse, { duration: travelDur, ease: "none", xPercent: 100 }, 0);

        for (let index = 1; index < flowNodes.length; index += 1) {
          flowTl.call(() => activateStep(index), undefined, index * segmentDur);
        }

        flowTl.to(
          [flowProgress, flowPulse],
          { duration: 0.24, ease: "power1.out", opacity: 0 },
          travelDur + 0.24,
        );
      }

      gsap.to(".visual-glow", {
        opacity: 0.5,
        scale: 1.12,
        duration: 4.8,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
    },
    { scope: containerRef },
  );

  const serviceState = healthQuery.isError ? "离线" : healthQuery.isPending ? "检测中" : "在线";

  return (
    <div
      ref={containerRef}
      className="bg-card border-border relative hidden overflow-hidden border-r lg:flex lg:w-[46%] lg:flex-col lg:justify-between"
    >
      <div
        className="visual-glow pointer-events-none absolute -top-24 -left-24 size-96 opacity-30"
        aria-hidden
      />
      <div
        className="visual-glow pointer-events-none absolute -right-20 -bottom-32 size-[28rem] opacity-25"
        aria-hidden
      />
      <svg
        className="globe-wireframe text-primary/10 pointer-events-none absolute -top-32 -right-24 size-[34rem]"
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

      <div className="visual-reveal relative flex items-center gap-3 p-8 xl:p-10">
        <BrandLogo className="text-primary size-8" />
        <div>
          <p className="text-sm font-semibold">ChenMeridian</p>
          <p className="text-muted-foreground text-xs">本地测试管理工作台</p>
        </div>
      </div>

      <div className="relative px-8 xl:px-10">
        <h2 className="visual-wordmark text-5xl font-semibold tracking-tight xl:text-6xl">
          {WORDMARK.split("").map((char, index) => (
            <span
              key={index}
              className="wordmark-char inline-block will-change-transform"
              style={{
                backgroundImage: "var(--wordmark-gradient)",
                backgroundSize: `${WORDMARK.length * 100}% 100%`,
                backgroundPositionX: `${(index / (WORDMARK.length - 1)) * 100}%`,
              }}
            >
              {char}
            </span>
          ))}
        </h2>

        <div className="flow-rail visual-reveal relative mt-7" aria-hidden>
          <div className="flow-track" />
          <div className="flow-progress" />
          <div className="flow-pulse" />
          {FLOW_STEPS.map((step) => (
            <div key={step.label} className="flow-step">
              <span className="flow-marker">
                <step.icon className="size-4" />
              </span>
              <span className="flow-label">{step.label}</span>
            </div>
          ))}
        </div>
        <p className="visual-reveal mt-4 max-w-sm text-base leading-snug font-medium">
          <span className="text-primary font-semibold">本地优先</span>
          <span className="text-muted-foreground">，</span>
          <span className="text-foreground">从录入到交付</span>
          <span className="text-primary font-semibold">一站完成</span>
          <span className="text-muted-foreground">。</span>
        </p>

        <div className="border-border/60 relative mt-10 h-px w-full">
          <div className="meridian-beam absolute inset-y-0 left-0 w-full" aria-hidden />
        </div>
      </div>

      <div className="visual-reveal relative flex items-center gap-6 p-8 xl:p-10">
        <StatusItem
          icon={Activity}
          label="服务"
          value={serviceState}
          tone={healthQuery.isError ? "error" : healthQuery.isPending ? "default" : "success"}
        />
        <StatusItem
          icon={Database}
          label="SQLite"
          value={healthQuery.data?.sqliteVersion || "--"}
          tone={healthQuery.data ? "success" : "default"}
        />
        <StatusItem icon={ShieldCheck} label="认证" value="JWT / RBAC" tone="success" />
      </div>
    </div>
  );
}

function StatusItem({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone: "default" | "success" | "error";
}) {
  const toneClass =
    tone === "success" ? "text-primary" : tone === "error" ? "text-destructive" : "text-foreground";

  return (
    <div className="flex items-center gap-2">
      <Icon className={`size-3.5 shrink-0 ${toneClass}`} aria-hidden />
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`font-mono text-xs font-medium ${toneClass}`}>{value}</span>
    </div>
  );
}
