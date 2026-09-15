import {
  ChevronDown,
  ChevronUp,
  FileSearch,
  GitBranch,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { gsap, useGSAP } from "@/lib/gsap";
import { QueryError, QueryLoading } from "@/components/shared/query-state";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { RequirementPrimaryKind, SoftwareRequirement } from "@/features/requirements/types";
import type { Project } from "../../../types";
import { BatchRequirementDialog } from "./batch-requirement-dialog";
import { CandidateReviewTable } from "./candidate-review-table";
import { RequirementEditor } from "./requirement-editor";
import {
  buildRequirementTree,
  countRequirements,
  filterRequirementTree,
  primaryKindOptions,
  type RequirementTreeNode,
} from "./requirement-model";
import { RequirementTree, type RequirementTreeControls } from "./requirement-tree";
import { RequirementsLayout } from "./requirements-layout";
import { useRequirementsWorkbench } from "./use-requirements-workbench";
import { useResizableRequirementsLayout } from "./use-requirements-layout";

export function RequirementsWorkbench({ project }: { project: Project }) {
  const workbench = useRequirementsWorkbench(project);
  const containerRef = useRef<HTMLElement>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "candidate" | "all">("active");
  const [kindFilter, setKindFilter] = useState<RequirementPrimaryKind | "all">("all");
  const [candidateIds, setCandidateIds] = useState<string[]>([]);
  const [copySource, setCopySource] = useState<SoftwareRequirement | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [excludeOpen, setExcludeOpen] = useState(false);
  const resizableLayout = useResizableRequirementsLayout();

  useGSAP(
    () => {
      if (!containerRef.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.fromTo(
        "[data-requirements-panel]",
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.32, ease: "power3.out", stagger: 0.05 },
      );
    },
    { scope: containerRef },
  );
  const [excludeReason, setExcludeReason] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const treeControlsRef = useRef<RequirementTreeControls>(null);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const fullTree = useMemo(
    () =>
      buildRequirementTree(workbench.workbench ?? { sources: [], sections: [], requirements: [] }),
    [workbench.workbench],
  );
  const visibleTree = useMemo(
    () => filterRequirementTree(fullTree, search, statusFilter, kindFilter),
    [fullTree, kindFilter, search, statusFilter],
  );
  const selectedNode = useMemo(
    () =>
      findNode(visibleTree, selectedKey) ?? findNode(fullTree, selectedKey) ?? fullTree[0] ?? null,
    [fullTree, selectedKey, visibleTree],
  );
  const candidates = useMemo(
    () => (workbench.workbench?.requirements ?? []).filter((item) => item.status === "candidate"),
    [workbench.workbench],
  );
  const officialCount = countRequirements(fullTree, "official");
  const candidateCount = countRequirements(fullTree, "candidate");
  const pendingTestItemCount = (workbench.workbench?.requirements ?? []).filter(
    (requirement) =>
      requirement.status === "official" && requirement.testItemTaskStatus === "pending",
  ).length;
  const sectionCount = workbench.workbench?.sections.length ?? 0;

  const selectNode = (node: RequirementTreeNode) => {
    setCopySource(null);
    setSelectedKey(node.key);
  };

  const handleCreateSection = async (
    payload: Parameters<typeof workbench.createSectionMutation.mutateAsync>[0],
  ) => {
    const section = await workbench.createSectionMutation.mutateAsync(payload);
    setSelectedKey(`section:${section.id}`);
    return section;
  };
  const handleCreateRequirement = async (
    payload: Parameters<typeof workbench.createRequirementMutation.mutateAsync>[0],
  ) => {
    const result = await workbench.createRequirementMutation.mutateAsync(payload);
    setCopySource(null);
    return result;
  };
  const handleCopyRequirement = (requirement: SoftwareRequirement) => {
    setCopySource(requirement);
    setSelectedKey(
      requirement.sectionId ? `section:${requirement.sectionId}` : (fullTree[0]?.key ?? ""),
    );
  };
  const handleDiscardCopy = () => setCopySource(null);
  const handleUpdateRequirement = async (
    requirementId: string,
    payload: Parameters<typeof workbench.updateRequirementMutation.mutateAsync>[0]["payload"],
  ) => {
    await workbench.updateRequirementMutation.mutateAsync({ id: requirementId, payload });
  };

  if (workbench.workbenchQuery.isPending) {
    return <QueryLoading label="正在加载需求工作台" rows={8} />;
  }
  if (workbench.workbenchQuery.isError || !workbench.workbench) {
    return (
      <QueryError title="需求工作台加载失败" onRetry={() => workbench.workbenchQuery.refetch()} />
    );
  }

  const header = (
    <header className="requirements-header" data-requirements-panel>
      <div className="requirements-header-main">
        <div className="requirements-header-copy">
          <div className="requirements-header-badges">
            <Badge variant="secondary" className="h-6 px-2">
              <GitBranch data-icon="inline-start" aria-hidden />
              需求与追踪
            </Badge>
            <Badge variant={workbench.activeSource?.parseState === "ready" ? "primary" : "warning"}>
              {workbench.activeSource?.parseState === "ready" ? "SRS 可解析" : "建议手动建立"}
            </Badge>
          </div>
          <h2 id="requirements-title">软件需求基线</h2>
          <p>手动树状录入与 SRS 解析汇入同一个需求池；正式需求默认记录测试项待创建契约。</p>
        </div>
        <dl className="requirements-summary">
          <SummaryTile label="章节" value={sectionCount} />
          <SummaryTile label="正式需求" value={officialCount} tone="primary" />
          <SummaryTile label="候选需求" value={candidateCount} tone="warning" />
          <SummaryTile label="待建测试项" value={pendingTestItemCount} tone="info" />
        </dl>
      </div>
      <div className="requirements-header-actions">
        <div className="requirements-header-source">
          <Select value={workbench.sourceVersionId} onValueChange={workbench.setSourceVersionId}>
            <SelectTrigger size="sm" aria-label="选择主 SRS 版本">
              <SelectValue placeholder="选择已确认 SRS" />
            </SelectTrigger>
            <SelectContent collisionPadding={12} className="max-w-[calc(100vw-1.5rem)]">
              {workbench.sources.map((source) => (
                <SelectItem key={source.id} value={source.id}>
                  {source.objectName} {source.version}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="requirements-header-commands">
          <Button
            type="button"
            disabled={!workbench.activeSource || workbench.parseMutation.isPending}
            onClick={() => {
              if (workbench.activeSource?.parseState !== "ready") {
                toast.warning("当前 SRS 是 .doc 或无电子文件，请先转换 DOCX 或使用手动录入");
                return;
              }
              workbench.parseMutation.mutate(workbench.activeSource.id);
            }}
          >
            {workbench.parseMutation.isPending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
            ) : (
              <Sparkles data-icon="inline-start" aria-hidden />
            )}
            解析 SRS
          </Button>
          <Button type="button" variant="outline" onClick={() => setBatchOpen(true)}>
            <Upload data-icon="inline-start" aria-hidden />
            批量粘贴
          </Button>
        </div>
      </div>
    </header>
  );

  const tree = (
    <aside className="requirements-tree-panel" data-requirements-panel>
      <div className="requirements-tree-toolbar">
        <Input
          ref={searchRef}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索章节号、名称、描述"
          aria-label="搜索需求树"
          className="h-7 text-xs"
        />
        <Tabs
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}
        >
          <TabsList className="w-full">
            <TabsTrigger value="active" className="px-2 text-[11px]">
              有效
            </TabsTrigger>
            <TabsTrigger value="candidate" className="px-2 text-[11px]">
              候选
            </TabsTrigger>
            <TabsTrigger value="all" className="px-2 text-[11px]">
              全部
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="requirements-tree-quick-tools">
          <Select
            value={kindFilter}
            onValueChange={(value) => setKindFilter(value as typeof kindFilter)}
          >
            <SelectTrigger size="sm" aria-label="筛选主需求性质" className="h-7 flex-1 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部性质</SelectItem>
              {primaryKindOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                aria-label="展开全部章节"
                onClick={() => treeControlsRef.current?.expandAll()}
              >
                <ChevronDown aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>展开全部</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                aria-label="收起全部章节"
                onClick={() => treeControlsRef.current?.collapseAll()}
              >
                <ChevronUp aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>收起全部</TooltipContent>
          </Tooltip>
        </div>
        <p className="requirements-tree-hotkeys" aria-hidden>
          <kbd>/</kbd>搜索
          <kbd>↑↓</kbd>移动
          <kbd>←→</kbd>收展
        </p>
      </div>
      <RequirementTree
        nodes={visibleTree}
        selectedKey={selectedNode?.key ?? ""}
        onSelect={selectNode}
        controlsRef={treeControlsRef}
      />
    </aside>
  );

  const main = (
    <div className="requirements-main" data-requirements-panel>
      <RequirementEditor
        key={`${selectedNode?.key ?? "root"}:${selectedNode?.requirement?.updatedAt ?? ""}:${
          copySource?.id ?? ""
        }`}
        source={workbench.activeSource}
        sections={workbench.workbench.sections}
        requirements={workbench.workbench.requirements}
        selectedNode={selectedNode}
        copySource={copySource}
        creatingSection={workbench.createSectionMutation.isPending}
        creatingRequirement={workbench.createRequirementMutation.isPending}
        updatingRequirement={workbench.updateRequirementMutation.isPending}
        onCreateSection={handleCreateSection}
        onCreateRequirement={handleCreateRequirement}
        onUpdateRequirement={handleUpdateRequirement}
        onCopyRequirement={handleCopyRequirement}
        onDiscardCopy={handleDiscardCopy}
      />

      <section
        className="requirements-candidates"
        aria-labelledby="candidate-title"
        data-requirements-panel
      >
        <header>
          <div className="min-w-0">
            <h3 id="candidate-title">候选需求确认</h3>
            <p>解析结果先进入候选区，确认后才进入正式基线。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!candidateIds.length || workbench.changeStatusMutation.isPending}
              onClick={() =>
                workbench.changeStatusMutation.mutate(
                  { ids: candidateIds, action: "confirm" },
                  { onSuccess: () => setCandidateIds([]) },
                )
              }
            >
              确认选中
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!candidateIds.length || workbench.changeStatusMutation.isPending}
              onClick={() => {
                setExcludeReason("");
                setExcludeOpen(true);
              }}
            >
              <XCircle data-icon="inline-start" aria-hidden />
              排除选中
            </Button>
          </div>
        </header>
        <CandidateReviewTable
          requirements={candidates}
          selectedIds={candidateIds}
          onToggle={(id, checked) =>
            setCandidateIds((previous) =>
              checked ? [...new Set([...previous, id])] : previous.filter((item) => item !== id),
            )
          }
          onToggleAll={(checked) =>
            setCandidateIds(checked ? candidates.map((item) => item.id) : [])
          }
          onActivate={(requirement) => setSelectedKey(`requirement:${requirement.id}`)}
          onConfirm={(ids) =>
            workbench.changeStatusMutation.mutate(
              { ids, action: "confirm" },
              { onSuccess: () => setCandidateIds([]) },
            )
          }
        />
      </section>
    </div>
  );

  return (
    <section
      ref={containerRef}
      className="requirements-workbench"
      aria-labelledby="requirements-title"
    >
      {workbench.sources.length ? (
        <RequirementsLayout header={header} tree={tree} detail={main} resizable={resizableLayout} />
      ) : (
        <div className="requirements-empty-layout">
          {header}
          <div className="requirements-empty">
            <FileSearch aria-hidden />
            <h3>还没有可用的主 SRS 基线</h3>
            <p>先在资料与对象中确认软件需求规格说明版本，再回到这里解析或手动建立需求树。</p>
          </div>
        </div>
      )}

      {batchOpen ? (
        <BatchRequirementDialog
          open={batchOpen}
          sections={workbench.workbench.sections}
          submitting={workbench.bulkCreateMutation.isPending}
          onOpenChange={setBatchOpen}
          onSubmit={async (payload) => {
            await workbench.bulkCreateMutation.mutateAsync({
              sourceVersionId: workbench.sourceVersionId,
              items: payload.items,
            });
          }}
        />
      ) : null}

      <Dialog open={excludeOpen} onOpenChange={setExcludeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>排除候选需求</DialogTitle>
            <DialogDescription>
              排除结果会保留，下次重新解析时不再反复提醒；正式需求排除同样保留追踪历史。
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="exclude-reason">排除原因</FieldLabel>
            <Textarea
              id="exclude-reason"
              value={excludeReason}
              onChange={(event) => setExcludeReason(event.target.value)}
              rows={4}
              placeholder="例如：该段是说明文字，不构成软件需求"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExcludeOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              disabled={!excludeReason.trim() || workbench.changeStatusMutation.isPending}
              onClick={() => {
                workbench.changeStatusMutation.mutate(
                  { ids: candidateIds, action: "exclude", reason: excludeReason.trim() },
                  {
                    onSuccess: () => {
                      setExcludeOpen(false);
                      setCandidateIds([]);
                    },
                  },
                );
              }}
            >
              {workbench.changeStatusMutation.isPending ? (
                <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
              ) : (
                <RefreshCw data-icon="inline-start" aria-hidden />
              )}
              确认排除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function findNode(nodes: RequirementTreeNode[], key: string): RequirementTreeNode | null {
  for (const node of nodes) {
    if (node.key === key) return node;
    const child = findNode(node.children, key);
    if (child) return child;
  }
  return null;
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "primary" | "warning" | "info";
}) {
  return (
    <div data-summary-tone={tone}>
      <dt>{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
