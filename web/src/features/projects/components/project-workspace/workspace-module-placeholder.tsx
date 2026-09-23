import { CircleDashed, CircleCheck, Type } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type WorkspaceTone = "primary" | "info" | "warning" | "danger" | "chart" | "success";

interface WorkspaceBlock {
  label: string;
  content: string;
  status: "待录入" | "待建模" | "待生成";
}

export function WorkspaceModulePlaceholder({
  icon: Icon,
  title,
  description,
  tone = "primary",
  blocks,
}: {
  icon: typeof Type;
  title: string;
  description: string;
  tone?: WorkspaceTone;
  blocks: WorkspaceBlock[];
}) {
  const [activeBlock, setActiveBlock] = useState(blocks[0]?.label ?? "");
  const currentBlock = blocks.find((block) => block.label === activeBlock) ?? blocks[0];

  return (
    <section
      data-workspace-module={tone}
      className="grid min-h-full gap-4 p-4 pl-5 xl:grid-cols-[268px_minmax(0,1fr)]"
      aria-labelledby="workspace-module-title"
    >
      <aside className="flex min-w-0 flex-col gap-3">
        <header className="flex min-w-0 flex-col gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              data-module-icon
              className="flex size-9 shrink-0 items-center justify-center rounded-sm border"
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <h2 id="workspace-module-title" className="text-lg leading-snug font-semibold">
              {title}
            </h2>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
        </header>

        <nav aria-label={`${title}二级导航`} className="flex flex-col gap-1.5">
          {blocks.map((block) => {
            const active = block.label === currentBlock?.label;
            return (
              <Button
                key={block.label}
                type="button"
                variant="ghost"
                className={cn(
                  "h-auto justify-start px-2.5 py-2.5 text-left",
                  active && "font-semibold",
                )}
                aria-current={active ? "true" : undefined}
                onClick={() => setActiveBlock(block.label)}
              >
                <BlockStatusIcon status={block.status} />
                <span className="min-w-0 flex-1 truncate text-xs">{block.label}</span>
              </Button>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col gap-4">
        {currentBlock ? (
          <article
            key={currentBlock.label}
            data-module-card
            className="flex min-w-0 flex-col gap-4 rounded-sm border p-4"
          >
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base leading-none font-semibold">{currentBlock.label}</h3>
                <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                  {currentBlock.content}
                </p>
              </div>
              <Badge
                variant={
                  currentBlock.status === "待录入"
                    ? "warning"
                    : currentBlock.status === "待生成"
                      ? "info"
                      : "outline"
                }
              >
                {currentBlock.status}
              </Badge>
            </div>
            <div className="bg-muted/25 border-border grid gap-3 rounded-sm border p-4 sm:grid-cols-3">
              <ContextTile label="数据状态" value={currentBlock.status} />
              <ContextTile label="模块归属" value={title} />
              <ContextTile label="共享范围" value="本项目" />
            </div>
          </article>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {blocks.map((block) => (
            <article
              key={block.label}
              data-module-card
              className="flex min-w-0 flex-col gap-2 rounded-sm border p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="flex min-w-0 items-center gap-2 text-xs font-semibold">
                  <span data-module-marker aria-hidden />
                  <span className="truncate">{block.label}</span>
                </h3>
                <Badge
                  variant={
                    block.status === "待录入"
                      ? "warning"
                      : block.status === "待生成"
                        ? "info"
                        : "outline"
                  }
                >
                  {block.status}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">{block.content}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function BlockStatusIcon({ status }: { status: WorkspaceBlock["status"] }) {
  if (status === "待录入") {
    return <CircleCheck className="text-warning size-3.5 shrink-0" aria-hidden />;
  }
  if (status === "待生成") {
    return <CircleCheck className="text-info size-3.5 shrink-0" aria-hidden />;
  }
  return <CircleDashed className="text-muted-foreground size-3.5 shrink-0" aria-hidden />;
}

function ContextTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/70 border-l pl-2.5">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className="mt-1.5 truncate text-xs font-semibold">{value}</p>
    </div>
  );
}
