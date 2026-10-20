import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { testItemsApi } from "@/features/test-items/api";
import type { StaticState, StaticWorkbench } from "@/features/test-items/types";
import type { ProjectPlatform } from "@/features/projects/types";
import { CrWorkbench } from "./static-cr";
import { CwWorkbench } from "./static-cw";
import { DcWorkbench } from "./static-review";
import { SaWorkbench } from "./static-sa";
import { SaveChip } from "./static-shared";
import styles from "./static-workbench.module.css";

function StaticWorkbenchEditor({
  initial,
  platform,
}: {
  initial: StaticWorkbench;
  platform: ProjectPlatform;
}) {
  const [state, setState] = useState(initial.state);
  const [saveState, setSaveState] = useState<"saved" | "editing" | "saving" | "error">("saved");
  const [dirtyVersion, setDirtyVersion] = useState(0);
  const stateRef = useRef(state);
  const versionRef = useRef(initial.version);
  const savingRef = useRef(false);
  const queuedRef = useRef(false);
  const dirtyRef = useRef(false);

  const persist = useCallback(async () => {
    if (savingRef.current) {
      queuedRef.current = true;
      return;
    }
    savingRef.current = true;
    setSaveState("saving");
    const snapshot = stateRef.current;
    try {
      const saved = await testItemsApi.saveStaticWorkbench(
        initial.testItemId,
        versionRef.current,
        snapshot,
      );
      versionRef.current = saved.version;
      if (stateRef.current === snapshot) {
        dirtyRef.current = false;
        setSaveState("saved");
      } else {
        queuedRef.current = true;
        setSaveState("editing");
      }
    } catch (error) {
      setSaveState("error");
      toast.error(error instanceof Error ? error.message : "静态测试保存失败");
    } finally {
      savingRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        void persist();
      }
    }
  }, [initial.testItemId]);

  useEffect(() => {
    if (dirtyVersion === 0) return;
    const timer = window.setTimeout(() => void persist(), 650);
    return () => window.clearTimeout(timer);
  }, [dirtyVersion, persist]);

  // 切测试项或关闭页面时补一次保存，避免 650ms 防抖窗口内的最后一次输入丢失。
  useEffect(
    () => () => {
      if (dirtyRef.current) void persist();
    },
    [persist],
  );

  const update = useCallback((recipe: (draft: StaticState) => void) => {
    const next = structuredClone(stateRef.current);
    recipe(next);
    stateRef.current = next;
    dirtyRef.current = true;
    setState(next);
    setSaveState("editing");
    setDirtyVersion((value) => value + 1);
  }, []);

  const title = { DC: "文档审查", SA: "静态分析", CR: "代码审查", CW: "代码走查" }[initial.kind];
  return (
    <section className={styles.workbench}>
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <span className={styles.iconBox}>
            <ShieldCheck aria-hidden />
          </span>
          <div>
            <h3>静态测试 · {title}</h3>
            <span>按 GJB 438C 附录模板实施；数据自动保存。</span>
          </div>
        </div>
        <div className={styles.headerMeta}>
          <SaveChip state={saveState} />
          <Badge variant="outline">{initial.kind}</Badge>
        </div>
      </header>
      <div className={styles.body}>
        {initial.kind === "DC" ? (
          <DcWorkbench state={state} catalog={initial.catalog} update={update} />
        ) : null}
        {initial.kind === "SA" ? (
          <SaWorkbench state={state} catalog={initial.catalog} update={update} />
        ) : null}
        {initial.kind === "CR" ? (
          <CrWorkbench
            state={state}
            catalog={initial.catalog}
            platform={platform}
            update={update}
          />
        ) : null}
        {initial.kind === "CW" ? <CwWorkbench state={state} update={update} /> : null}
      </div>
    </section>
  );
}

export function StaticWorkbenchSection({
  testItemId,
  kind,
  platform,
}: {
  testItemId: string;
  kind: string;
  platform: ProjectPlatform;
}) {
  const query = useQuery({
    queryKey: ["test-items", "static-workbench", testItemId],
    queryFn: () => testItemsApi.staticWorkbench(testItemId),
    enabled: ["DC", "SA", "CR", "CW"].includes(kind),
    staleTime: 30_000,
  });
  if (query.isPending)
    return (
      <div className={styles.loading}>
        <Loader2 className={styles.spin} aria-hidden />
        正在加载静态测试工作台
      </div>
    );
  if (query.isError || !query.data)
    return (
      <div className={styles.loading}>
        <AlertTriangle aria-hidden />
        静态测试工作台加载失败
      </div>
    );
  return (
    <StaticWorkbenchEditor key={query.data.testItemId} initial={query.data} platform={platform} />
  );
}
