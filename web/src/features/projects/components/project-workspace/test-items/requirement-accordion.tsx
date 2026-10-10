import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { requirementsApi } from "@/features/requirements/api";
import type { TestItemRequirementRef } from "@/features/test-items/types";
import styles from "./requirement-accordion.module.css";

/** 需求描述手风琴：展开时才拉取正文，按来源文档显示章节与名称。 */
export function RequirementAccordion({ reference }: { reference: TestItemRequirementRef }) {
  const [open, setOpen] = useState(false);
  const contentQuery = useQuery({
    queryKey: ["requirements", "content", reference.id],
    queryFn: () => requirementsApi.content(reference.id),
    enabled: open,
    staleTime: 60_000,
  });
  const description = contentQuery.data?.description?.trim() ?? "";

  return (
    <div className={styles.accordion} data-open={open ? "true" : undefined}>
      <button
        type="button"
        className={styles.accordionHead}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronRight className={styles.accordionChevron} aria-hidden />
        {reference.sourceName ? (
          <span className={styles.accordionSource}>{reference.sourceName}</span>
        ) : null}
        <span className={styles.accordionChapter}>§{reference.chapterNumber}</span>
        <span className={styles.accordionName}>{reference.name}</span>
        <span className={styles.accordionHint}>{open ? "收起" : "展开"}</span>
      </button>
      <div className={styles.accordionBody}>
        <div className={styles.accordionInner}>
          {contentQuery.isPending ? (
            <span className={styles.muted}>读取需求描述…</span>
          ) : description ? (
            <p className={styles.accordionText}>{description}</p>
          ) : (
            <span className={styles.requirementMissing}>该需求描述待补全，关联前请先补充</span>
          )}
        </div>
      </div>
    </div>
  );
}
