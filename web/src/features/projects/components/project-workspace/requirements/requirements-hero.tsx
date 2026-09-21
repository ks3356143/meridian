import { Archive, ClipboardPaste } from "lucide-react";
import { useMemo } from "react";
import type { RequirementRecord } from "@/features/requirements/types";
import { Button } from "@/components/ui/button";
import styles from "./requirements-hero.module.css";

export function RequirementsHero({
  requirements,
  loading,
  onOpenDeleted,
  onOpenBulkPaste,
}: {
  requirements: RequirementRecord[];
  loading: boolean;
  onOpenDeleted: () => void;
  onOpenBulkPaste: () => void;
}) {
  const stats = useMemo(() => {
    let officialCount = 0;
    let parsedCandidateCount = 0;
    let deletedCount = 0;
    let incompleteCount = 0;

    for (const requirement of requirements) {
      if (requirement.status === "official") {
        officialCount++;
        if (requirement.description.trim() === "") incompleteCount++;
      } else if (requirement.origin === "parsed" && requirement.status === "candidate") {
        parsedCandidateCount++;
      } else if (
        requirement.status === "excluded" &&
        requirement.deletedFromStatus === "official"
      ) {
        deletedCount++;
      }
    }

    return [
      { label: "已确认需求", tone: "primary", value: officialCount },
      { label: "自动解析未确认需求", tone: "warning", value: parsedCandidateCount },
      { label: "已删除需求", tone: "danger", value: deletedCount, opensDeleted: true },
      { label: "待补描述", tone: "warning", value: incompleteCount },
    ];
  }, [requirements]);

  return (
    <header className={styles.card} aria-label="需求任务卡片容器">
      <div className={styles.copy}>
        <h2>软件需求基线</h2>
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
        <Button type="button" size="sm" onClick={onOpenBulkPaste}>
          <ClipboardPaste data-icon="inline-start" aria-hidden />
          批量粘贴建树
        </Button>
      </div>
    </header>
  );
}
