import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, MinusCircle, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { QueryError, QueryLoading } from "@/components/shared/query-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { testItemsApi } from "@/features/test-items/api";
import type {
  TypeCoverageCard,
  TypeCoverageRoundSlice,
  TypeCoverageStatus,
} from "@/features/test-items/types";
import styles from "./type-coverage-view.module.css";

const STATUS_LABEL: Record<TypeCoverageStatus, string> = {
  covered: "已覆盖",
  explained: "已说明",
  missing: "未说明",
  not_applicable: "不适用",
};

export function TypeCoverageView({
  projectCode,
  roundId,
  onOpenType,
}: {
  projectCode: string;
  roundId: string;
  onOpenType: (typeCode: string) => void;
}) {
  const [editing, setEditing] = useState<TypeCoverageCard | null>(null);
  const coverageQuery = useQuery({
    queryKey: ["projects", projectCode, "type-coverage", roundId],
    queryFn: () => testItemsApi.typeCoverage(projectCode, roundId),
    staleTime: 15_000,
  });
  const groups = useMemo(() => {
    const result = new Map<string, TypeCoverageCard[]>();
    for (const itemType of coverageQuery.data?.types ?? []) {
      const current = result.get(itemType.category) ?? [];
      current.push(itemType);
      result.set(itemType.category, current);
    }
    return [...result.entries()];
  }, [coverageQuery.data?.types]);

  if (coverageQuery.isPending) {
    return <QueryLoading label="正在汇总类型覆盖" rows={8} />;
  }
  if (coverageQuery.isError || !coverageQuery.data) {
    return (
      <QueryError
        title="类型覆盖加载失败"
        description="无法读取 24 类测试项的覆盖统计。"
        onRetry={() => void coverageQuery.refetch()}
      />
    );
  }
  const coverage = coverageQuery.data;
  const summary = coverage.summary;
  return (
    <div className={styles.view}>
      <section className={styles.summary} aria-label="类型覆盖摘要">
        <div className={styles.summaryLead}>
          <span className={styles.summaryKicker}>TYPE COVERAGE</span>
          <strong>{coverage.allRounds ? "全部轮次 · 只读" : coverage.round?.name}</strong>
          <small>24 类测试项覆盖与不测评说明</small>
        </div>
        <Metric label={coverage.allRounds ? "适用检查" : "适用类型"} value={summary.applicable} />
        <Metric label="已覆盖" value={summary.covered} tone="success" />
        <Metric label="已说明" value={summary.explained} tone="info" />
        <Metric
          label="未说明"
          value={summary.missing}
          tone={summary.missing > 0 ? "danger" : "muted"}
        />
        <Metric label="不适用" value={summary.notApplicable} tone="muted" />
        <Metric label="测试项" value={summary.testItemCount} />
        <Metric label="用例" value={summary.caseCount} />
      </section>

      <div className={styles.groups}>
        {groups.map(([category, types]) => (
          <section key={category} className={styles.group}>
            <header className={styles.groupHeader}>
              <span>{category}</span>
              <small>
                {types.filter((itemType) => itemType.status === "covered").length}/{types.length}
              </small>
            </header>
            <div className={styles.cards}>
              {types.map((itemType) => (
                <article key={itemType.code} className={styles.card} data-status={itemType.status}>
                  <div className={styles.cardHeader}>
                    <div className={styles.typeIdentity}>
                      <span className={styles.typeCode}>{itemType.code}</span>
                      <strong>{itemType.name}</strong>
                    </div>
                    <StatusBadge
                      status={itemType.status}
                      partial={
                        coverage.allRounds &&
                        itemType.itemCount > 0 &&
                        itemType.status === "missing"
                      }
                    />
                  </div>
                  <div className={styles.cardStats}>
                    <span>
                      测试项 <b>{itemType.itemCount}</b>
                    </span>
                    <span>
                      用例 <b>{itemType.caseCount}</b>
                    </span>
                    <span>
                      通过率 <b>{formatRate(itemType.passRate)}</b>
                    </span>
                    {!coverage.allRounds ? (
                      <span>
                        未执行 <b>{itemType.pendingCount}</b>
                      </span>
                    ) : null}
                  </div>
                  {coverage.allRounds ? (
                    <div className={styles.roundList}>
                      {itemType.rounds.map((round) => (
                        <RoundLine key={round.roundId} round={round} />
                      ))}
                    </div>
                  ) : itemType.note ? (
                    <div className={styles.note}>
                      <span>不测评说明</span>
                      <p>{itemType.note.reasonText}</p>
                      <small>
                        {itemType.note.updatedByName || "未知成员"} ·{" "}
                        {formatDate(itemType.note.updatedAt)}
                      </small>
                    </div>
                  ) : null}
                  <footer className={styles.cardFooter}>
                    {itemType.itemCount > 0 ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => onOpenType(itemType.code)}
                      >
                        查看测试项
                        <ArrowRight aria-hidden />
                      </Button>
                    ) : null}
                    {!coverage.allRounds && itemType.applicable && itemType.itemCount === 0 ? (
                      <Button
                        type="button"
                        size="xs"
                        variant={itemType.note ? "ghost" : "outline"}
                        className={itemType.status === "missing" ? styles.noteAction : undefined}
                        onClick={() => setEditing(itemType)}
                      >
                        <PencilLine aria-hidden />
                        {itemType.note ? "编辑说明" : "填写不测评说明"}
                      </Button>
                    ) : null}
                    {!coverage.allRounds && !itemType.applicable ? (
                      <span className={styles.staticHint}>静态项只保留首轮</span>
                    ) : null}
                  </footer>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {editing ? (
        <CoverageNoteDialog
          key={`${editing.code}-${roundId}-${editing.note?.updatedAt ?? "new"}`}
          open
          projectCode={projectCode}
          roundId={roundId}
          card={editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onSaved={() => {
            void coverageQuery.refetch();
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function CoverageNoteDialog({
  open,
  projectCode,
  roundId,
  card,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  projectCode: string;
  roundId: string;
  card: TypeCoverageCard;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState(card.note?.reasonText ?? "");
  const saveMutation = useMutation({
    mutationFn: () =>
      testItemsApi.saveTypeCoverageNote(projectCode, roundId, card.code, reason.trim()),
    onSuccess: () => {
      toast.success(`${card.code} 不测评说明已保存`);
      void queryClient.invalidateQueries({
        queryKey: ["projects", projectCode, "type-coverage"],
      });
      onSaved();
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saveMutation.isPending) onOpenChange(next);
      }}
    >
      <DialogContent className={styles.noteDialog} aria-busy={saveMutation.isPending || undefined}>
        <DialogHeader>
          <DialogTitle>
            填写 {card.code} · {card.name} 不测评说明
          </DialogTitle>
          <DialogDescription>
            当前轮次没有该类型测试项。说明原因，后续查看覆盖视图时可直接核对。
          </DialogDescription>
        </DialogHeader>
        <label className={styles.noteField} htmlFor="type-coverage-reason">
          <span>不测评说明</span>
          <Textarea
            id="type-coverage-reason"
            value={reason}
            minRows={4}
            maxRows={8}
            placeholder="例如：本期不涉及接口测试，接口能力随下一版本联调。"
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={reason.trim() === "" || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "正在保存…" : "保存说明"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className={styles.metric} data-tone={tone}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function StatusBadge({ status, partial }: { status: TypeCoverageStatus; partial?: boolean }) {
  const label = partial ? "部分未说明" : STATUS_LABEL[status];
  return (
    <span className={styles.status} data-status={status}>
      {status === "covered" ? <CheckCircle2 aria-hidden /> : null}
      {status === "missing" ? <AlertTriangle aria-hidden /> : null}
      {status === "not_applicable" || status === "explained" ? <MinusCircle aria-hidden /> : null}
      {label}
    </span>
  );
}

function RoundLine({ round }: { round: TypeCoverageRoundSlice }) {
  return (
    <div className={styles.roundLine} data-status={round.status}>
      <span>第 {round.roundNumber} 轮</span>
      <b>{round.itemCount} 项</b>
      <small>
        {STATUS_LABEL[round.status]} · {formatRate(round.passRate)}
      </small>
    </div>
  );
}

function formatRate(value: number | null) {
  if (value === null) return "—";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
