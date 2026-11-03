import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutletContext, useSearchParams } from "react-router";
import { Bug, ChevronRight, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { issuesApi } from "@/features/test-items/api";
import type { Issue } from "@/features/test-items/types";
import type { ProjectWorkspaceOutletContext } from "../project-workspace-layout";
import styles from "./issues-module.module.css";

const LEVELS = ["重大", "严重", "一般", "建议改进"];

export function IssuesModule() {
  const { project } = useOutletContext<ProjectWorkspaceOutletContext>();
  const [searchParams] = useSearchParams();
  const roundId = searchParams.get("roundId") ?? undefined;
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [closureNote, setClosureNote] = useState("");
  const [levelDraft, setLevelDraft] = useState<string>("");

  const issuesQuery = useQuery({
    queryKey: ["issues", project.id, roundId ?? "all"],
    queryFn: () => issuesApi.list(project.id, roundId),
  });

  const issues = useMemo(() => {
    const all = issuesQuery.data ?? [];
    return statusFilter === "all" ? all : all.filter((issue) => issue.status === statusFilter);
  }, [issuesQuery.data, statusFilter]);

  const active = (issuesQuery.data ?? []).find((issue) => issue.id === activeId) ?? null;
  const openCount = (issuesQuery.data ?? []).filter((issue) => issue.status === "open").length;

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof issuesApi.update>[1];
    }) => issuesApi.update(id, payload),
    onSuccess: () => {
      toast.success("问题单已更新");
      setClosureNote("");
      void queryClient.invalidateQueries({ queryKey: ["issues", project.id] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "更新失败"),
  });

  const openDetail = (issue: Issue) => {
    setActiveId(issue.id);
    setClosureNote("");
    setLevelDraft(issue.level);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.iconBox} aria-hidden>
            <ShieldAlert />
          </span>
          <div>
            <h2>问题单</h2>
            <p>
              当前筛选 {issues.length} 条 · 未关闭 {openCount} 条
            </p>
          </div>
        </div>
        <div className={styles.filters} role="group" aria-label="按状态筛选">
          {(
            [
              ["all", "全部"],
              ["open", "开放"],
              ["closed", "已关闭"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={styles.filterChip}
              data-active={statusFilter === value ? "true" : undefined}
              onClick={() => setStatusFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {issuesQuery.isPending ? <p className={styles.state}>正在读取问题单…</p> : null}
      {issuesQuery.isError ? <p className={styles.state}>问题单读取失败，请刷新重试。</p> : null}
      {!issuesQuery.isPending && issues.length === 0 ? (
        <div className={styles.empty}>
          <Bug aria-hidden />
          <strong>还没有问题单</strong>
          <span>在文档审查里把不通过的检查项「立问题单」，就会出现在这里。</span>
        </div>
      ) : null}

      <div className={styles.list}>
        {issues.map((issue) => (
          <button
            key={issue.id}
            type="button"
            className={styles.row}
            onClick={() => openDetail(issue)}
          >
            <span className={styles.rowRound}>第 {issue.roundNumber} 轮</span>
            <span className={styles.rowMain}>
              <strong>{issue.title}</strong>
              <span>
                {issue.testItemIdentifier || "—"} · {issue.sourceSheetName || "文档审查"}
                {issue.sourceCheckTitle ? ` · ${issue.sourceCheckTitle}` : ""}
              </span>
            </span>
            <span className={styles.rowLevel} data-level={issue.level}>
              {issue.level}
            </span>
            <span className={styles.rowStatus} data-status={issue.status}>
              {issue.status === "open" ? "开放" : "已关闭"}
            </span>
            <ChevronRight className={styles.rowArrow} aria-hidden />
          </button>
        ))}
      </div>

      <Dialog open={active !== null} onOpenChange={(open) => !open && setActiveId(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{active?.title}</DialogTitle>
            <DialogDescription>
              第 {active?.roundNumber} 轮 · {active?.testItemIdentifier} · 来源{" "}
              {active?.sourceSheetName || "文档审查"}
              {active?.sourceCheckTitle ? ` / ${active.sourceCheckTitle}` : ""}
            </DialogDescription>
          </DialogHeader>
          {active ? (
            <div className={styles.detail}>
              <div className={styles.detailMeta}>
                <span>缺陷类型：{active.defectType}</span>
                <span>处理方式：{active.closureMethod}</span>
                <span>受审文档：{active.targetDocument || "—"}</span>
                <span>状态：{active.status === "open" ? "开放" : "已关闭"}</span>
              </div>
              <Field>
                <FieldLabel>问题描述</FieldLabel>
                <p className={styles.detailText}>{active.description || "（无描述）"}</p>
              </Field>
              <Field>
                <FieldLabel htmlFor="issue-level">等级</FieldLabel>
                <Select
                  value={levelDraft || active.level}
                  onValueChange={(value) => {
                    setLevelDraft(value);
                    updateMutation.mutate({ id: active.id, payload: { level: value } });
                  }}
                >
                  <SelectTrigger id="issue-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {active.status === "closed" ? (
                <Field>
                  <FieldLabel>整改与验证说明</FieldLabel>
                  <p className={styles.detailText}>{active.closureNote || "（无）"}</p>
                  {active.closedAt ? (
                    <span className={styles.detailHint}>
                      关闭时间：{active.closedAt.slice(0, 16).replace("T", " ")}
                    </span>
                  ) : null}
                </Field>
              ) : (
                <Field>
                  <FieldLabel htmlFor="issue-closure">整改与验证说明（关闭前必填）</FieldLabel>
                  <Textarea
                    id="issue-closure"
                    rows={3}
                    value={closureNote}
                    placeholder="例如：研制方已修订软件需求规格说明 §3.3，复查通过。"
                    onChange={(event) => setClosureNote(event.target.value)}
                  />
                </Field>
              )}
            </div>
          ) : null}
          <DialogFooter>
            {active?.status === "open" ? (
              <Button
                type="button"
                disabled={updateMutation.isPending || !closureNote.trim()}
                onClick={() =>
                  active &&
                  updateMutation.mutate({
                    id: active.id,
                    payload: { status: "closed", closureNote: closureNote.trim() },
                  })
                }
              >
                关闭并记录整改
              </Button>
            ) : active ? (
              <Button
                type="button"
                variant="outline"
                disabled={updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({ id: active.id, payload: { status: "open" } })
                }
              >
                重新打开
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setActiveId(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
