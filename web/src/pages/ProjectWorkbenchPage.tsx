import { ArrowLeft } from "lucide-react";
import { useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { gsap, useGSAP } from "@/lib/gsap";
import { mockProjects } from "@/features/projects/mock";
import { levelStyle, statusStyle } from "@/features/projects/status-style";

const TABS = ["概览", "测试项", "用例", "执行记录", "问题单", "文档产出"] as const;

export function Component() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const project = mockProjects.find((p) => p.id === projectId);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("概览");
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from(".workbench-reveal", {
        opacity: 0,
        y: 14,
        duration: 0.45,
        stagger: 0.06,
        ease: "power3.out",
      });
    },
    { scope: containerRef },
  );

  if (!project) {
    return <Navigate to="/" replace />;
  }

  const rate = Math.round((project.casesExecuted / Math.max(project.casesTotal, 1)) * 100);

  return (
    <div ref={containerRef} className="flex flex-col gap-5">
      <header className="workbench-reveal flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground -ml-2 w-fit"
          onClick={() => navigate("/")}
        >
          <ArrowLeft data-icon="inline-start" />
          返回项目组合
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            <span className="text-muted-foreground mr-2 font-mono text-lg">{project.id}</span>
            {project.name}
          </h1>
          <span
            className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${statusStyle[project.status]}`}
          >
            {project.status}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Tag label="性质" value={project.nature} />
          <Tag label="类型" value={project.testType} />
          <span
            className={`inline-flex items-center gap-1 border px-2 py-0.5 ${levelStyle[project.level]}`}
          >
            安全等级 {project.level}
          </span>
          <Tag label="平台" value={project.platform} />
          <Tag label="研制单位" value={project.organization} />
          <Tag label="负责人" value={project.owner} />
          <Tag label="用例" value={`${project.casesExecuted}/${project.casesTotal} · ${rate}%`} />
          <span className="text-muted-foreground font-mono">更新 {project.updatedAt}</span>
        </div>
      </header>

      <nav className="border-border bg-card flex border">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            data-active={activeTab === tab}
            className="border-border text-muted-foreground hover:text-foreground data-[active=true]:text-primary data-[active=true]:border-primary relative border-r px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors last:border-r-0 data-[active=true]:bg-primary/5"
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === "概览" ? (
        <OverviewTab projectId={project.id} />
      ) : (
        <div className="border-border bg-card flex min-h-48 items-center justify-center border">
          <p className="text-muted-foreground text-sm">
            「{activeTab}」模块将在后续版本接入，当前版本聚焦项目组合与工作台骨架。
          </p>
        </div>
      )}
    </div>
  );
}

function Tag({ label, value }: { label: string; value: string }) {
  return (
    <span className="border-border bg-card inline-flex items-center gap-1 border px-2 py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

function OverviewTab({ projectId }: { projectId: string }) {
  const modules = [
    { name: "测试项", value: "0" },
    { name: "测试用例", value: "0" },
    { name: "执行记录", value: "0" },
    { name: "问题单", value: "0" },
    { name: "文档产出", value: "0" },
    { name: "回归轮次", value: "0" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <section className="border-border bg-card border p-4">
        <h2 className="mb-3 text-sm font-semibold">被测对象信息</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-[13px] lg:grid-cols-4">
          <InfoItem label="软件名称" value={`${projectId} 被测软件`} />
          <InfoItem label="软件类型" value="新研" />
          <InfoItem label="运行环境" value="VxWorks / Linux" />
          <InfoItem label="编程语言" value="C" />
          <InfoItem label="版本" value="1.00" />
          <InfoItem label="代码规模" value="-- 行" />
          <InfoItem label="接收日期" value="--" />
          <InfoItem label="研制单位" value="--" />
        </dl>
      </section>

      <section className="border-border bg-card grid grid-cols-2 gap-px border lg:grid-cols-3">
        {modules.map((m) => (
          <div
            key={m.name}
            className="bg-card hover:border-primary/50 flex min-h-20 flex-col justify-center gap-1 border p-4 transition-colors"
          >
            <span className="text-muted-foreground text-xs">{m.name}</span>
            <span className="font-mono text-xl font-semibold">{m.value}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
