import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { requirementsApi } from "@/features/requirements/api";
import styles from "./requirement-link-picker.module.css";

/** 关联需求选择器：按来源文档分组，隐含需求开启时禁用。 */
export function RequirementLinkPicker({
  projectId,
  linkedIds,
  disabled = false,
  onPick,
}: {
  projectId: string;
  linkedIds: string[];
  /** 隐含需求开启时禁止再关联需求（两者互斥）。 */
  disabled?: boolean;
  onPick: (requirementId: string) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const workbenchQuery = useQuery({
    queryKey: ["projects", projectId, "requirements", "workbench"],
    queryFn: () => requirementsApi.workbench(projectId),
    enabled: open,
    staleTime: 60_000,
  });

  // 按来源文档分组：研制总要求 / 需求规格说明…..多文档时仍能一眼分清。
  const groups = useMemo(() => {
    const linked = new Set(linkedIds);
    const text = keyword.trim();
    const records = (workbenchQuery.data?.requirements ?? [])
      .filter((record) => record.status === "official" && record.hasDescription)
      .filter((record) => !linked.has(record.id))
      .filter((record) =>
        text === ""
          ? true
          : record.name.includes(text) ||
            record.chapterNumber.startsWith(text) ||
            record.externalIdentifier.includes(text),
      )
      .slice(0, 40);
    const bySource = new Map<string, typeof records>();
    for (const record of records) {
      const list = bySource.get(record.sourceVersionId);
      if (list) list.push(record);
      else bySource.set(record.sourceVersionId, [record]);
    }
    return (workbenchQuery.data?.sources ?? [])
      .map((source) => ({
        id: source.id,
        name: source.objectName,
        version: source.version,
        records: bySource.get(source.id) ?? [],
      }))
      .filter((group) => group.records.length > 0);
  }, [keyword, linkedIds, workbenchQuery.data]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className={styles.linkButton}
          disabled={disabled}
          title={disabled ? "当前按隐含需求处理，如需关联需求请先关闭隐含需求" : undefined}
        >
          <span className={styles.btnDot} data-tone="green" aria-hidden />
          关联需求
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={styles.linkPopover}>
        <input
          className={styles.linkSearch}
          placeholder="搜索章节号 / 名称 / 标识"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <div className={styles.linkResults}>
          {workbenchQuery.isPending ? (
            <span className={styles.muted}>加载需求列表…</span>
          ) : groups.length === 0 ? (
            <span className={styles.muted}>没有可关联的需求</span>
          ) : (
            groups.map((group) => (
              <div key={group.id} className={styles.linkGroup}>
                <span className={styles.linkGroupTitle}>
                  {group.name}
                  {group.version ? ` · ${group.version}` : ""}
                </span>
                {group.records.map((record) => (
                  <button
                    key={record.id}
                    type="button"
                    className={styles.linkResult}
                    onClick={() => {
                      void onPick(record.id).then(() => setOpen(false));
                    }}
                  >
                    <span className={styles.linkResultChapter}>§{record.chapterNumber}</span>
                    <span className={styles.linkResultName}>{record.name}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
