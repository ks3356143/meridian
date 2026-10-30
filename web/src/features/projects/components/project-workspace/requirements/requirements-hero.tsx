import { Archive, ArrowRight, ClipboardPaste, Plus, Sparkles } from "lucide-react";
import { memo, useMemo } from "react";
import type { RequirementRecord } from "@/features/requirements/types";
import { Button } from "@/components/ui/button";
import { SpotlightSurface } from "@/components/shared/spotlight-surface";
import styles from "./requirements-hero.module.css";

function RequirementsHeroImpl({
  requirements,
  loading,
  onOpenDeleted,
  onOpenBulkPaste,
  onCreateAllTestItems,
  onCreate,
  candidateCount,
  onOpenCandidate,
}: {
  requirements: RequirementRecord[];
  loading: boolean;
  onOpenDeleted: () => void;
  onOpenBulkPaste: () => void;
  onCreateAllTestItems: () => void;
  onCreate: () => void;
  candidateCount: number;
  onOpenCandidate: () => void;
}) {
  const hasOfficialRequirement = requirements.some(
    (requirement) => requirement.status === "official",
  );
  const stats = useMemo(() => {
    let officialCount = 0;
    let parsedCandidateCount = 0;
    let recycleBinCount = 0;
    let incompleteCount = 0;

    for (const requirement of requirements) {
      if (requirement.status === "official") {
        officialCount++;
        if (!requirement.hasDescription) incompleteCount++;
      } else if (requirement.origin === "parsed" && requirement.status === "candidate") {
        parsedCandidateCount++;
      } else if (requirement.status === "excluded") {
        recycleBinCount++;
      }
    }

    return [
      { label: "已确认需求", tone: "primary", value: officialCount },
      { label: "自动解析未确认需求", tone: "warning", value: parsedCandidateCount },
      { label: "回收站", tone: "danger", value: recycleBinCount, opensDeleted: true },
      { label: "待补描述", tone: "warning", value: incompleteCount },
    ];
  }, [requirements]);

  return (
    <SpotlightSurface as="header" className={styles.card} aria-label="需求任务卡片容器">
      <div className={styles.copy}>
        <div className={styles.titleRow}>
          <h2>软件需求基线</h2>
          {candidateCount > 0 ? (
            <Button
              type="button"
              size="xs"
              variant="secondary"
              className={styles.queueAction}
              onClick={onOpenCandidate}
              sheen
            >
              {candidateCount} 条待确认
              <ArrowRight data-icon="inline-end" aria-hidden />
            </Button>
          ) : null}
        </div>
        <p>手动树状录入与 SRS 解析汇入同一个需求池；正式需求默认记录测试项待创建契约。</p>
      </div>
      <dl className={styles.stats} aria-busy={loading}>
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={styles.stat}
            data-tone={stat.tone}
            data-action={stat.opensDeleted ? "true" : undefined}
          >
            <dt>{stat.label}</dt>
            <dd className="font-mono">{loading ? "--" : stat.value}</dd>
            {stat.opensDeleted ? (
              <>
                <span className={styles.actionPill} aria-hidden>
                  <Archive />
                  管理
                </span>
                <button
                  type="button"
                  className={styles.trigger}
                  aria-label={`查看${stat.label}，当前 ${stat.value} 条`}
                  onClick={onOpenDeleted}
                />
              </>
            ) : null}
          </div>
        ))}
      </dl>
      <div className={styles.actions}>
        <Button
          type="button"
          size="sm"
          variant={candidateCount > 0 ? "outline" : "default"}
          onClick={onCreate}
        >
          <Plus data-icon="inline-start" aria-hidden />
          新增确认需求
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!hasOfficialRequirement}
          aria-label={
            hasOfficialRequirement ? "一键创建测试项" : "一键创建测试项，暂无已确认需求可创建"
          }
          title={hasOfficialRequirement ? undefined : "暂无已确认需求，请先新增或确认需求"}
          onClick={onCreateAllTestItems}
        >
          <Sparkles data-icon="inline-start" aria-hidden />
          一键创建测试项
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onOpenBulkPaste}>
          <ClipboardPaste data-icon="inline-start" aria-hidden />
          批量粘贴建树
        </Button>
      </div>
    </SpotlightSurface>
  );
}
export const RequirementsHero = memo(RequirementsHeroImpl);
