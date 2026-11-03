import { Input } from "@/components/ui/input";
import type { StaticReviewCheck } from "@/features/test-items/types";
import styles from "./static-workbench.module.css";

/** CR 代码审查用的三态检查表；DC 使用 static-dc.tsx 的专用表。 */
export function ReviewCheckTable({
  checks,
  onUpdate,
}: {
  checks: StaticReviewCheck[];
  onUpdate: (checkID: string, recipe: (check: StaticReviewCheck) => void) => void;
}) {
  const cycle = (check: StaticReviewCheck) =>
    onUpdate(check.id, (next) => {
      next.result =
        next.result === "unreviewed"
          ? "passed"
          : next.result === "passed"
            ? "failed"
            : "unreviewed";
    });
  return (
    <table className={styles.reviewTable}>
      <thead>
        <tr>
          <th>#</th>
          <th>类别</th>
          <th>检查项</th>
          <th>依据标准</th>
          <th>结果</th>
          <th>备注</th>
        </tr>
      </thead>
      <tbody>
        {checks.map((check) => (
          <tr key={check.id} data-result={check.result} data-check-id={check.id}>
            <td className={styles.seqCell}>{check.seq}</td>
            <td>
              <span className={styles.categoryChip}>{check.category || "未分类"}</span>
            </td>
            <td>
              <div className={styles.checkText}>
                <strong>{check.title}</strong>
                {check.requirement && check.requirement !== check.title ? (
                  <span>{check.requirement}</span>
                ) : null}
                {check.practice ? <em>做法：{check.practice}</em> : null}
              </div>
            </td>
            <td className={styles.basisCell}>{check.basis || "—"}</td>
            <td>
              <button
                type="button"
                className={styles.resultButton}
                data-result={check.result}
                aria-label={`${check.title}：${check.result === "unreviewed" ? "未审" : check.result === "passed" ? "通过" : "不通过"}，点击切换`}
                onClick={() => cycle(check)}
              >
                {check.result === "passed" ? "通过" : check.result === "failed" ? "不通过" : "未审"}
              </button>
            </td>
            <td>
              <Input
                value={check.notes}
                className={styles.inlineInput}
                placeholder="备注"
                aria-label={`${check.title}备注`}
                onChange={(event) =>
                  onUpdate(check.id, (next) => {
                    next.notes = event.target.value;
                  })
                }
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
