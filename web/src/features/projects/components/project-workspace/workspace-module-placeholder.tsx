import { CircleDashed, Construction, Type } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import { SpotlightSurface } from "@/components/shared/spotlight-surface";
import styles from "./workspace-module-placeholder.module.css";

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
      className={styles.shell}
      aria-labelledby="workspace-module-title"
    >
      <aside className={styles.sidebar}>
        <header className={styles.sidebarHeader}>
          <div className={styles.titleRow}>
            <span data-module-icon className={styles.moduleIcon}>
              <Icon aria-hidden />
            </span>
            <div className={styles.titleCopy}>
              <h2 id="workspace-module-title">{title}</h2>
              <Badge variant="outline">暂未接入</Badge>
            </div>
          </div>
          <p className={styles.description}>{description}</p>
        </header>

        <div className={styles.availability} role="status">
          <Construction className={styles.availabilityIcon} aria-hidden />
          <div>
            <strong>规划预览</strong>
            <span>当前页面不会录入、保存或生成任何数据。</span>
          </div>
        </div>

        <nav aria-label={`${title}规划范围`} className={styles.navigation}>
          <p className={styles.navLabel}>规划范围</p>
          {blocks.map((block) => {
            const active = block.label === currentBlock?.label;
            return (
              <Button
                key={block.label}
                type="button"
                variant="ghost"
                className={styles.navButton}
                aria-current={active ? "page" : undefined}
                onClick={() => setActiveBlock(block.label)}
              >
                <BlockStatusIcon status={block.status} />
                <span className={styles.navText}>{block.label}</span>
                <span className={styles.navMeta}>{block.status}</span>
              </Button>
            );
          })}
        </nav>
      </aside>

      <div className={styles.content}>
        {currentBlock ? (
          <SpotlightSurface
            as="article"
            key={currentBlock.label}
            data-module-card
            className={styles.currentCard}
          >
            <div className={styles.cardHeader}>
              <div className={styles.cardCopy}>
                <p className={styles.eyebrow}>MODULE PREVIEW · 功能规划</p>
                <SectionTitle as="h3" size="lg" className={styles.currentTitle}>
                  {currentBlock.label}
                </SectionTitle>
                <p className={styles.currentDescription}>{currentBlock.content}</p>
              </div>
              <Badge variant="outline">暂未接入</Badge>
            </div>

            <div className={styles.notice}>
              <Construction className={styles.noticeIcon} aria-hidden />
              <div>
                <strong>当前仅展示模块规划</strong>
                <p>此页面没有可用的录入、保存、生成或导出操作，不是按钮失效。</p>
              </div>
            </div>

            <dl className={styles.contextGrid}>
              <ContextTile label="当前状态" value="暂未接入" />
              <ContextTile label="数据写入" value="不会发生" />
              <ContextTile label="规划归属" value={title} />
            </dl>
          </SpotlightSurface>
        ) : null}

        <section className={styles.scopeSection} aria-labelledby="planned-scope-title">
          <div className={styles.scopeHeader}>
            <div>
              <h3 id="planned-scope-title">规划范围</h3>
              <p>以下条目用于说明未来能力，不代表已经完成的表单或流程。</p>
            </div>
            <span className={styles.scopeCount}>{blocks.length} 项</span>
          </div>
          <div className={styles.planGrid}>
            {blocks.map((block) => (
              <article key={block.label} data-module-card className={styles.planCard}>
                <div className={styles.planCardHeader}>
                  <SectionTitle as="h4" className={styles.planTitle}>
                    {block.label}
                  </SectionTitle>
                  <Badge variant="secondary">{block.status}</Badge>
                </div>
                <p>{block.content}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function BlockStatusIcon({ status }: { status: WorkspaceBlock["status"] }) {
  return (
    <CircleDashed
      className={cn(
        styles.statusIcon,
        status === "待录入" && styles.statusWarning,
        status === "待生成" && styles.statusInfo,
      )}
      aria-hidden
    />
  );
}

function ContextTile({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.contextTile}>
      <dt>{label}</dt>
      <dd title={value}>{value}</dd>
    </div>
  );
}
