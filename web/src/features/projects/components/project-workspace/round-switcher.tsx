import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, History, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { testItemsApi } from "@/features/test-items/api";
import type { RoundCopyCandidate, TestRoundRecord } from "@/features/test-items/types";
import { ALL_ROUNDS_ID } from "./use-round-selection";
import styles from "./round-switcher.module.css";

export function RoundSwitcher({
  projectCode,
  rounds,
  roundId,
  allowAll,
  loading,
  onRoundChange,
}: {
  projectCode: string;
  rounds: TestRoundRecord[];
  roundId: string;
  allowAll: boolean;
  loading?: boolean;
  onRoundChange: (roundId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const current = rounds.find((round) => round.id === roundId);
  const label = roundId === ALL_ROUNDS_ID ? "全部轮次" : (current?.name ?? "选择轮次");
  const latestRound = rounds.at(-1);

  const choose = (nextRoundId: string) => {
    setOpen(false);
    onRoundChange(nextRoundId);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={styles.trigger}
            aria-label={`切换轮次，当前 ${label}`}
            disabled={loading}
          >
            <History aria-hidden />
            <span className={styles.triggerLabel}>{loading ? "读取轮次" : label}</span>
            <ChevronDown className={styles.chevron} data-open={open || undefined} aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className={styles.menu}>
          <div className={styles.menuTitle}>选择轮次</div>
          <div role="listbox" aria-label="轮次" className={styles.options}>
            {allowAll ? (
              <button
                type="button"
                role="option"
                aria-selected={roundId === ALL_ROUNDS_ID}
                className={styles.option}
                onClick={() => choose(ALL_ROUNDS_ID)}
              >
                <span>
                  <strong>全部</strong>
                  <small>跨轮只读聚合</small>
                </span>
                {roundId === ALL_ROUNDS_ID ? <Check aria-hidden /> : null}
              </button>
            ) : null}
            {rounds.map((round) => (
              <button
                key={round.id}
                type="button"
                role="option"
                aria-selected={round.id === roundId}
                className={styles.option}
                onClick={() => choose(round.id)}
              >
                <span>
                  <strong>{round.name}</strong>
                  <small>
                    {round.dutVersion ? `${round.dutVersion} · ` : ""}
                    {round.status === "closed" ? "已关闭" : "进行中"}
                  </small>
                </span>
                {round.id === roundId ? <Check aria-hidden /> : null}
              </button>
            ))}
          </div>
          <div className={styles.menuFooter}>
            <Button
              type="button"
              size="sm"
              className={styles.newRoundButton}
              disabled={!latestRound}
              onClick={() => {
                setOpen(false);
                setWizardOpen(true);
              }}
            >
              <Plus aria-hidden />
              新建轮次
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {latestRound ? (
        <NewRoundWizard
          open={wizardOpen}
          projectCode={projectCode}
          latestRound={latestRound}
          onOpenChange={setWizardOpen}
          onCreated={(newRoundId) => {
            setWizardOpen(false);
            onRoundChange(newRoundId);
          }}
        />
      ) : null}
    </>
  );
}

function NewRoundWizard({
  open,
  projectCode,
  latestRound,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  projectCode: string;
  latestRound: TestRoundRecord;
  onOpenChange: (open: boolean) => void;
  onCreated: (roundId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState(`第 ${latestRound.roundNumber + 1} 轮`);
  const [dutVersion, setDutVersion] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const previewQuery = useQuery({
    queryKey: ["projects", projectCode, "test-rounds", latestRound.id, "copy-preview"],
    queryFn: () => testItemsApi.roundCopyPreview(projectCode, latestRound.id),
    enabled: open,
    staleTime: 10_000,
  });
  const candidates = useMemo(() => previewQuery.data?.testItems ?? [], [previewQuery.data]);
  const visible = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return candidates;
    return candidates.filter((candidate) =>
      `${candidate.identifier}\n${candidate.name}\n${candidate.typeName}`
        .toLowerCase()
        .includes(keyword),
    );
  }, [candidates, search]);
  const createMutation = useMutation({
    mutationFn: () =>
      testItemsApi.createRoundCopy(projectCode, {
        sourceRoundId: latestRound.id,
        testItemIds: [...selected],
        name: name.trim(),
        dutVersion: dutVersion.trim(),
        changeReason: changeReason.trim(),
      }),
    onSuccess: (result) => {
      toast.success(`已创建 ${result.round.name}，带入 ${result.testItemCount} 个测试项`);
      void queryClient.invalidateQueries({ queryKey: ["projects", projectCode, "test-rounds"] });
      void queryClient.invalidateQueries({ queryKey: ["projects", projectCode, "test-items"] });
      onCreated(result.round.id);
    },
  });

  useEffect(() => {
    if (!open || !previewQuery.data) return;
    // oxlint-disable-next-line react/set-state-in-effect
    setSelected(
      new Set(
        previewQuery.data.testItems
          .filter((candidate) => candidate.defaultSelected)
          .map((candidate) => candidate.testItemId),
      ),
    );
  }, [open, previewQuery.data]);

  const close = (next: boolean) => {
    if (!next && createMutation.isPending) return;
    if (!next) {
      setSearch("");
      setSelected(new Set());
      setDutVersion("");
      setChangeReason("");
      setName(`第 ${latestRound.roundNumber + 1} 轮`);
      createMutation.reset();
    }
    onOpenChange(next);
  };

  const toggle = (candidate: RoundCopyCandidate, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(candidate.testItemId);
      else next.delete(candidate.testItemId);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        className={styles.wizard}
        aria-busy={previewQuery.isPending || createMutation.isPending}
      >
        <DialogHeader>
          <DialogTitle>新建第 {latestRound.roundNumber + 1} 轮</DialogTitle>
          <DialogDescription>
            从{latestRound.name}复制整项树；实测结果与执行状态清空，静态项不会出现在复制范围。
          </DialogDescription>
        </DialogHeader>

        <div className={styles.formGrid}>
          <Label htmlFor="new-round-name">
            <span>轮次名称</span>
            <Input
              id="new-round-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Label>
          <Label htmlFor="new-round-version">
            <span>被测版本</span>
            <Input
              id="new-round-version"
              value={dutVersion}
              placeholder="例如 V2.0.0"
              onChange={(event) => setDutVersion(event.target.value)}
            />
          </Label>
          <Label htmlFor="new-round-reason" className={styles.fullField}>
            <span>变更原因</span>
            <Textarea
              id="new-round-reason"
              value={changeReason}
              placeholder="说明本轮相对上一轮的变更范围与回归依据"
              onChange={(event) => setChangeReason(event.target.value)}
            />
          </Label>
        </div>

        <div className={styles.rangeHeader}>
          <div>
            <strong>本轮范围</strong>
            <span>默认勾选上轮存在未通过用例的测试项</span>
          </div>
          <span className={styles.selectionCount}>已选 {selected.size}</span>
        </div>
        <div className={styles.rangeTools}>
          <div className={styles.searchField}>
            <Search aria-hidden />
            <Input
              value={search}
              placeholder="搜索测试项名称 / 标识"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() =>
              setSelected(new Set(candidates.map((candidate) => candidate.testItemId)))
            }
          >
            全选
          </Button>
          <Button type="button" size="xs" variant="outline" onClick={() => setSelected(new Set())}>
            全不选
          </Button>
        </div>

        <div className={styles.candidates}>
          {previewQuery.isPending ? (
            <div className={styles.state}>正在读取上轮测试项…</div>
          ) : previewQuery.isError ? (
            <div className={styles.stateError}>复制预览加载失败，请关闭后重试。</div>
          ) : visible.length === 0 ? (
            <div className={styles.state}>没有匹配的测试项；本轮可以不选任何测试项。</div>
          ) : (
            visible.map((candidate) => (
              <label
                key={candidate.testItemId}
                htmlFor={`round-candidate-${candidate.testItemId}`}
                className={styles.candidate}
              >
                <Checkbox
                  id={`round-candidate-${candidate.testItemId}`}
                  checked={selected.has(candidate.testItemId)}
                  onCheckedChange={(checked) => toggle(candidate, checked === true)}
                />
                <span className={styles.candidateMain}>
                  <span className={styles.candidateName}>{candidate.name}</span>
                  <span className={styles.candidateMeta}>
                    {candidate.identifier} · {candidate.typeName}
                  </span>
                </span>
                <span className={styles.candidateStats}>
                  <span data-tone="pass">通过 {candidate.passedCount}</span>
                  <span data-tone="fail">未通过 {candidate.failedCount}</span>
                </span>
              </label>
            ))
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={
              !name.trim() ||
              previewQuery.isPending ||
              previewQuery.isError ||
              createMutation.isPending
            }
            aria-busy={createMutation.isPending || undefined}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending
              ? "正在复制…"
              : selected.size === 0
                ? "创建空轮次"
                : "确认创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
