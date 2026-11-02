import { FileText } from "lucide-react";
import { TruncatedText } from "@/components/shared/truncated-text";
import type {
  TestCaseRecord,
  TestItemRecord,
  TestItemRequirementRef,
} from "@/features/test-items/types";
import styles from "./test-case-panel.module.css";

export function TestCaseTraceRow({
  requirements,
  item,
  caseRecord,
}: {
  requirements: TestItemRequirementRef[];
  item: TestItemRecord;
  caseRecord: TestCaseRecord;
}) {
  return (
    <tr>
      <th scope="row">追踪关系</th>
      <td colSpan={3}>
        {requirements.length === 0 ? (
          <span className={styles.reqEmpty}>
            未关联需求（继承所属测试项，关联入口在测试项详情的「追踪关系」）
          </span>
        ) : (
          <ul className={styles.trackTree}>
            <li>
              <span className={styles.trackDoc}>
                <FileText className={styles.trackIcon} aria-hidden />
                {requirements[0].sourceName || "未标注来源文档"}
                {requirements[0].sourceVersion ? ` ${requirements[0].sourceVersion}` : ""}
              </span>
              <ul>
                {requirements.map((reference, index) => (
                  <li key={reference.id}>
                    <span className={styles.trackReq}>
                      <span className={styles.trackChapter}>§{reference.chapterNumber}</span>
                      <TruncatedText
                        value={reference.name}
                        className={styles.trackName}
                        tooltipValue={`${reference.name} · ${reference.externalIdentifier}`}
                      />
                      {reference.externalIdentifier ? (
                        <span className={styles.trackIdent}>{reference.externalIdentifier}</span>
                      ) : null}
                    </span>
                    {index === 0 ? (
                      <ul>
                        <li>
                          <span className={styles.trackItem}>
                            {item.identifier}
                            <span className={styles.trackMuted}>{item.name}</span>
                          </span>
                          <ul>
                            <li>
                              <span className={styles.trackCase} data-current="true">
                                {caseRecord.identifier}
                                <span className={styles.trackMuted}>{caseRecord.name}</span>
                              </span>
                            </li>
                          </ul>
                        </li>
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          </ul>
        )}
      </td>
    </tr>
  );
}
