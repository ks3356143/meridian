import { memo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Loader2 } from "lucide-react";
import { QueryError } from "@/components/shared/query-state";
import { requirementsApi } from "@/features/requirements/api";
import type { RequirementBodyResponse, RequirementContent } from "@/features/requirements/types";
import type { TestItemRequirementRef } from "@/features/test-items/types";
import { RequirementBody } from "../requirements/body/requirement-body";
import styles from "./requirement-accordion.module.css";

type AccordionPayload =
  | { mode: "blocks"; body: RequirementBodyResponse }
  | { mode: "text"; content: RequirementContent };

/**
 * 需求描述手风琴：展开时才拉取正文，收起与未展开零请求（含图片）。
 * 正文渲染同需求工作台：结构化块（表格、图片）优先，旧数据回退纯文本。
 */
export const RequirementAccordion = memo(function RequirementAccordionImpl({
  reference,
  projectCode,
}: {
  reference: TestItemRequirementRef;
  projectCode: string;
}) {
  const [open, setOpen] = useState(false);
  // 首次展开后保持挂载：收起动画不丢内容，再次展开不重复拉正文与图片。
  const [mounted, setMounted] = useState(false);
  const payloadQuery = useQuery({
    queryKey: ["test-items", "requirement-body", reference.id],
    queryFn: async (): Promise<AccordionPayload> => {
      const body = await requirementsApi.blocks(reference.id);
      if (body.hasContent) return { mode: "blocks", body };
      return { mode: "text", content: await requirementsApi.content(reference.id) };
    },
    enabled: open,
    staleTime: 60_000,
  });
  const payload = payloadQuery.data;
  const toggle = () => {
    setOpen((current) => !current);
    setMounted(true);
  };

  return (
    <div className={styles.accordion} data-open={open ? "true" : undefined}>
      <button type="button" className={styles.accordionHead} aria-expanded={open} onClick={toggle}>
        {reference.sourceName ? (
          <span className={styles.accordionSource}>{reference.sourceName}</span>
        ) : null}
        <span className={styles.accordionChapter}>§{reference.chapterNumber}</span>
        <span className={styles.accordionName}>{reference.name}</span>
        <ChevronRight className={styles.accordionChevron} aria-hidden />
      </button>
      <div className={styles.accordionBody}>
        <div className={styles.accordionInner}>
          {open && payloadQuery.isPending && !payload ? (
            <div className={styles.accordionLoading} aria-busy="true" aria-live="polite">
              <Loader2 className={styles.accordionSpinner} aria-hidden />
              <span>正在加载需求正文</span>
            </div>
          ) : null}
          {open && payloadQuery.isError && !payload ? (
            <div className={styles.accordionLoading}>
              <QueryError title="需求正文加载失败" onRetry={() => void payloadQuery.refetch()} />
            </div>
          ) : null}
          {mounted && payload ? (
            payload.mode === "blocks" ? (
              <div className={styles.accordionRich}>
                <RequirementBody doc={payload.body.doc} projectCode={projectCode} />
              </div>
            ) : payload.content.description.trim() ? (
              <p className={styles.accordionText}>{payload.content.description}</p>
            ) : (
              <span className={styles.requirementMissing}>该需求描述待补全，关联前请先补充</span>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
});
