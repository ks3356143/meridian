import type { RequirementRecord } from "@/features/requirements/types";

export function RequirementsHero({
  requirements,
  loading,
}: {
  requirements: RequirementRecord[];
  loading: boolean;
}) {
  const stats = [
    {
      label: "已确认需求",
      tone: "primary",
      value: countBy(requirements, { status: "official" }),
    },
    {
      label: "自动解析未确认需求",
      tone: "warning",
      value: countBy(requirements, { origin: "parsed", status: "candidate" }),
    },
  ];

  return (
    <header className="requirements-hero-card" aria-label="需求任务卡片容器">
      <div className="requirements-hero-copy">
        <h2>软件需求基线</h2>
        <p>手动树状录入与 SRS 解析汇入同一个需求池；正式需求默认记录测试项待创建契约。</p>
      </div>
      <dl className="requirements-hero-stats" aria-busy={loading}>
        {stats.map((stat) => (
          <div key={stat.label} data-hero-tone={stat.tone}>
            <dt>{stat.label}</dt>
            <dd className="font-mono">{loading ? "--" : stat.value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

function countBy(
  requirements: Array<{ origin: string; status: string }>,
  expected: { origin?: string; status?: string },
) {
  return requirements.filter(
    (requirement) =>
      (expected.origin === undefined || requirement.origin === expected.origin) &&
      (expected.status === undefined || requirement.status === expected.status),
  ).length;
}
