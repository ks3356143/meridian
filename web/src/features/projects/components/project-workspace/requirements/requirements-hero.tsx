import { Archive } from "lucide-react";
import type { RequirementRecord } from "@/features/requirements/types";
import styles from "./requirements-hero.module.css";

export function RequirementsHero({
  requirements,
  loading,
  onOpenDeleted,
}: {
  requirements: RequirementRecord[];
  loading: boolean;
  onOpenDeleted: () => void;
}) {
  const deletedRequirements = requirements.filter(
    (requirement) =>
      requirement.status === "excluded" && requirement.deletedFromStatus === "official",
  );
  const stats = [
    {
      label: "已确认需求",
      tone: "primary",
      value: requirements.filter((requirement) => requirement.status === "official").length,
    },
    {
      label: "自动解析未确认需求",
      tone: "warning",
      value: requirements.filter(
        (requirement) => requirement.origin === "parsed" && requirement.status === "candidate",
      ).length,
    },
    {
      label: "已删除需求",
      tone: "danger",
      value: deletedRequirements.length,
      opensDeleted: true,
    },
  ];

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
              <span className={styles.actionPill} aria-hidden>
                <Archive />
                管理
              </span>
            ) : null}
            {stat.opensDeleted ? (
              <button
                type="button"
                className={styles.trigger}
                aria-label={`查看${stat.label}，当前 ${stat.value} 条`}
                onClick={onOpenDeleted}
              />
            ) : null}
          </div>
        ))}
      </dl>
    </header>
  );
}
