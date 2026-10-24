import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CornerDownRight, FileSearch, Search, X } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { testItemsApi } from "@/features/test-items/api";
import type { TestCaseSearchHit } from "@/features/test-items/types";
import styles from "./case-search.module.css";

const EMPTY_HITS: TestCaseSearchHit[] = [];

function HighlightedSnippet({ text, query }: { text: string; query: string }) {
  const keyword = query.trim();
  if (keyword === "") return text;
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const index = lowerText.indexOf(lowerKeyword);
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + keyword.length)}</mark>
      {text.slice(index + keyword.length)}
    </>
  );
}

/** 测试项头部查找：用例字段 + 步骤正文，点击命中直达用例/步骤。 */
export function CaseSearch({
  testItemId,
  onOpenHit,
}: {
  testItemId: string;
  onOpenHit: (hit: TestCaseSearchHit) => void;
}) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(input.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [input]);

  const searchQuery = useQuery({
    queryKey: ["test-cases", "search", testItemId, query],
    queryFn: () => testItemsApi.searchCases(testItemId, query),
    enabled: query.length > 0,
    staleTime: 15_000,
  });
  const hits = searchQuery.data ?? EMPTY_HITS;
  const showResults = open && query.length > 0;

  return (
    <Popover open={showResults} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={styles.searchField}>
          <Search className={styles.searchIcon} aria-hidden />
          <input
            ref={inputRef}
            className={styles.input}
            value={input}
            placeholder="查找用例 / 步骤…"
            aria-label="测试项内查找"
            onChange={(event) => {
              setInput(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                event.currentTarget.blur();
              }
            }}
          />
          {input ? (
            <button
              type="button"
              className={styles.clearButton}
              aria-label="清空测试项查找"
              onClick={() => {
                setInput("");
                setQuery("");
                setOpen(false);
                inputRef.current?.focus();
              }}
            >
              <X aria-hidden />
            </button>
          ) : null}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={6}
        className={styles.popover}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {searchQuery.isPending ? (
          <div className={styles.state}>正在查找…</div>
        ) : searchQuery.isError ? (
          <div className={styles.state}>查找失败，请稍后重试</div>
        ) : hits.length === 0 ? (
          <div className={styles.empty}>
            <FileSearch className={styles.emptyIcon} aria-hidden />
            <span>没有找到“{query}”</span>
          </div>
        ) : (
          <>
            <div className={styles.summary}>找到 {hits.length} 处命中</div>
            <div className={styles.results}>
              {hits.map((hit) => (
                <button
                  key={`${hit.kind}-${hit.stepId ?? hit.caseId}-${hit.field}`}
                  type="button"
                  className={styles.result}
                  onClick={() => {
                    onOpenHit(hit);
                    setOpen(false);
                  }}
                >
                  <span className={styles.resultIcon} data-kind={hit.kind} aria-hidden>
                    <CornerDownRight className={styles.resultIconGlyph} />
                  </span>
                  <span className={styles.resultBody}>
                    <span className={styles.resultTop}>
                      <span className={styles.caseIdent}>{hit.caseIdentifier}</span>
                      <span className={styles.caseName}>{hit.caseName}</span>
                      <span className={styles.fieldChip} data-kind={hit.kind}>
                        {hit.kind === "step" ? `第 ${hit.stepSeq} 步 · ${hit.field}` : hit.field}
                      </span>
                    </span>
                    <span className={styles.snippet}>
                      <HighlightedSnippet text={hit.snippet} query={query} />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
