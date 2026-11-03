import { Fragment, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Camera, ImagePlus, Info, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requestBlob } from "@/api/client";
import type { StaticReviewCheck, StaticReviewSheet } from "@/features/test-items/types";
import { practiceTone } from "./static-dc-model";
import { RESULT_LABEL } from "./static-dc-model";
import styles from "./static-workbench.module.css";
import dcStyles from "./static-dc.module.css";

function AssetThumb({
  projectCode,
  assetId,
  onRemove,
}: {
  projectCode: string;
  assetId: string;
  onRemove?: () => void;
}) {
  const [url, setUrl] = useState("");
  const frameRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const assetQuery = useQuery({
    queryKey: ["dc-asset", projectCode, assetId],
    queryFn: ({ signal }) =>
      requestBlob(
        `/api/v1/projects/${encodeURIComponent(projectCode)}/assets/${encodeURIComponent(assetId)}?w=480`,
        signal,
      ),
    enabled: inView,
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });
  useEffect(() => {
    if (!assetQuery.data) {
      setUrl("");
      return;
    }
    const objectURL = URL.createObjectURL(assetQuery.data);
    setUrl(objectURL);
    return () => URL.revokeObjectURL(objectURL);
  }, [assetQuery.data]);
  return (
    <div ref={frameRef} className={dcStyles.dcImageItem}>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt="审查截图" loading="lazy" decoding="async" />
        </a>
      ) : (
        <span>{assetQuery.isError ? "加载失败" : "加载中…"}</span>
      )}
      {onRemove ? (
        <button
          type="button"
          className={dcStyles.dcImageRemove}
          aria-label="删除截图"
          onClick={onRemove}
        >
          <X aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function CollapseRow({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <tr
      className={dcStyles.dcCollapseRow}
      data-expanded={open ? "true" : undefined}
      aria-hidden={!open}
    >
      <td colSpan={7}>
        <div
          className={dcStyles.dcCollapse}
          data-expanded={open ? "true" : undefined}
          inert={!open}
        >
          <div className={dcStyles.dcCollapseInner}>{children}</div>
        </div>
      </td>
    </tr>
  );
}

export function DcCheckTable({
  projectCode,
  sheet,
  onlyFails,
  onCycle,
  onNotesChange,
  onRemoveImage,
  onUpload,
  onCreateIssue,
}: {
  projectCode: string;
  sheet: StaticReviewSheet;
  onlyFails: boolean;
  onCycle: (check: StaticReviewCheck) => void;
  onNotesChange: (check: StaticReviewCheck, value: string) => void;
  onRemoveImage: (check: StaticReviewCheck, assetId: string) => void;
  onUpload: (check: StaticReviewCheck, files: FileList | null) => void;
  onCreateIssue: (check: StaticReviewCheck) => void;
}) {
  const [practiceOpen, setPracticeOpen] = useState<Set<string>>(new Set());
  const [failOpen, setFailOpen] = useState<Set<string>>(new Set());
  const [historyOpen, setHistoryOpen] = useState<Set<string>>(new Set());
  const checks = onlyFails
    ? sheet.checks.filter((check) => check.result === "failed")
    : sheet.checks;
  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  return (
    <div className={styles.tableWrap}>
      <table className={`${styles.reviewTable} ${dcStyles.dcTable}`}>
        <thead>
          <tr>
            <th>#</th>
            <th>类别</th>
            <th>检查项</th>
            <th>依据</th>
            <th>参考做法</th>
            <th>结果</th>
            <th>备注 / 证据 / 立单</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => {
            const tone = practiceTone(check);
            const failExpanded = failOpen.has(check.id);
            const practiceExpanded = practiceOpen.has(check.id);
            return (
              <Fragment key={check.id}>
                <tr data-result={check.result} data-check-id={check.id}>
                  <td className={styles.seqCell}>
                    {check.seq}
                    {check.carriedFromPrevious ? (
                      <button
                        type="button"
                        className={dcStyles.dcCarryBadge}
                        title="上轮问题已解决，点击查看历史记录"
                        onClick={() => setHistoryOpen((set) => toggle(set, check.id))}
                      >
                        上轮已解决
                      </button>
                    ) : null}
                  </td>
                  <td>
                    <span className={styles.categoryChip}>{check.category || "未分类"}</span>
                  </td>
                  <td>
                    <div className={styles.checkText}>
                      <strong>{check.title}</strong>
                      {check.requirement && check.requirement !== check.title ? (
                        <span>{check.requirement}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className={styles.basisCell}>{check.basis || "—"}</td>
                  <td>
                    <button
                      type="button"
                      className={dcStyles.dcPracticeTrigger}
                      data-tone={tone}
                      disabled={tone === "empty"}
                      aria-expanded={practiceExpanded}
                      onClick={() => setPracticeOpen((set) => toggle(set, check.id))}
                    >
                      {tone === "both" ? (
                        <Info aria-hidden />
                      ) : tone === "empty" ? (
                        "—"
                      ) : tone === "good" ? (
                        "✓"
                      ) : (
                        "✗"
                      )}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.resultButton}
                      data-result={check.result}
                      aria-label={`${check.title}：${RESULT_LABEL[check.result] || "通过"}，点击切换`}
                      onClick={() => onCycle(check)}
                    >
                      {RESULT_LABEL[check.result] || "通过"}
                    </button>
                  </td>
                  <td>
                    <div className={dcStyles.dcRowActions}>
                      <Input
                        value={check.notes}
                        className={styles.inlineInput}
                        placeholder="备注"
                        aria-label={`${check.title}备注`}
                        onChange={(event) => onNotesChange(check, event.target.value)}
                      />
                      {check.result === "failed" ? (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => setFailOpen((set) => toggle(set, check.id))}
                        >
                          <Camera aria-hidden />
                          证据 / 立单
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
                <CollapseRow open={historyOpen.has(check.id) && Boolean(check.carriedFromPrevious)}>
                  <p className={dcStyles.dcPreviousNote}>
                    上轮记录：{check.previousNote || "（无文字记录）"}
                  </p>
                  {(check.previousImages ?? []).length ? (
                    <div className={dcStyles.dcImageGrid}>
                      {(check.previousImages ?? []).map((assetId) => (
                        <AssetThumb key={assetId} projectCode={projectCode} assetId={assetId} />
                      ))}
                    </div>
                  ) : null}
                </CollapseRow>
                <CollapseRow open={practiceExpanded}>
                  <div className={dcStyles.dcPracticeGrid}>
                    {check.goodPractice?.trim() ? (
                      <div className={dcStyles.dcPracticeCard} data-tone="good">
                        <span>推荐做法</span>
                        <div dangerouslySetInnerHTML={{ __html: check.goodPractice }} />
                      </div>
                    ) : null}
                    {check.badPractice?.trim() ? (
                      <div className={dcStyles.dcPracticeCard} data-tone="bad">
                        <span>不推荐做法</span>
                        <div dangerouslySetInnerHTML={{ __html: check.badPractice }} />
                      </div>
                    ) : null}
                  </div>
                </CollapseRow>
                <CollapseRow open={failExpanded && check.result === "failed"}>
                  {check.carriedFromPrevious && check.previousNote ? (
                    <p className={dcStyles.dcPreviousNote}>上轮问题：{check.previousNote}</p>
                  ) : null}
                  <Field>
                    <FieldLabel htmlFor={`notes-${check.id}`}>错误描述</FieldLabel>
                    <Textarea
                      id={`notes-${check.id}`}
                      value={check.notes}
                      rows={3}
                      placeholder="写清楚不符合点与位置，立单会带上这段描述"
                      onChange={(event) => onNotesChange(check, event.target.value)}
                    />
                  </Field>
                  <div className={dcStyles.dcEvidence}>
                    <span>截图证据（{(check.images ?? []).length}/9）</span>
                    <div className={dcStyles.dcImageGrid}>
                      {(check.images ?? []).map((assetId) => (
                        <AssetThumb
                          key={assetId}
                          projectCode={projectCode}
                          assetId={assetId}
                          onRemove={() => onRemoveImage(check, assetId)}
                        />
                      ))}
                      {(check.images ?? []).length < 9 ? (
                        <label className={dcStyles.dcImageAdd}>
                          <ImagePlus aria-hidden />
                          <span>上传截图</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            hidden
                            onChange={(event) => {
                              onUpload(check, event.target.files);
                              event.target.value = "";
                            }}
                          />
                        </label>
                      ) : null}
                    </div>
                  </div>
                  <div className={styles.inlineActions}>
                    <Button type="button" size="xs" onClick={() => onCreateIssue(check)}>
                      立问题单
                    </Button>
                  </div>
                </CollapseRow>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
