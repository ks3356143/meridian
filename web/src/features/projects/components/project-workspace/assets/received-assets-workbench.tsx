import {
  ArrowRight,
  Boxes,
  CircleCheck,
  FilePlus2,
  Loader2,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";
import { SpotlightSurface } from "@/components/shared/spotlight-surface";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Project } from "../../../types";
import { receiveModeOptions, type ReceiveMode } from "./received-asset-model";
import { useReceivedAssetsWorkbench } from "./use-received-assets-workbench";
import { ReceivedAssetDropzone } from "./components/received-asset-dropzone";
import { ReceivedAssetTable } from "./components/received-asset-table";
import { ManualWorkObjectDialog } from "./components/manual-work-object-dialog";
import { UploadProgressOverlay } from "./components/upload-progress-overlay";
import { WorkObjectReasonDialog } from "./components/work-object-reason-dialog";
import { WorkObjectHistoryDialog } from "./components/work-object-history-dialog";
import { WorkObjectCorrectionDialog } from "./components/work-object-correction-dialog";
import styles from "./received-assets-workbench.module.css";

const INTAKE_FLOW = ["资料接收", "工作对象", "需求解析", "版本比对"] as const;

export function ReceivedAssetsWorkbench({ project }: { project: Project }) {
  const navigate = useNavigate();
  const workbench = useReceivedAssetsWorkbench(project);
  const pendingCorrection = workbench.pendingCorrection;
  const containerRef = useRef<HTMLElement>(null);
  const [renderStage, setRenderStage] = useState<0 | 1 | 2>(0);
  const emptyCopy = workbench.isSearchActive
    ? {
        title: "没有匹配的工作对象",
        description: `没有找到与“${workbench.searchQuery.trim()}”匹配的资料，可调整关键词或清除搜索。`,
      }
    : {
        draft: {
          title: "还没有待确认资料",
          description: "拖入接收文件或手工登记资料后，会先进入待确认队列。",
        },
        confirmed: {
          title: "还没有已确认资料",
          description: "确认后的工作对象版本会在这里留档。",
        },
        superseded: {
          title: "还没有已替代版本",
          description: "被新版本替代后的历史资料会显示在这里。",
        },
        revoked: {
          title: "还没有已作废版本",
          description: "作废后的工作对象版本会保留在这里供追溯。",
        },
        all: {
          title: "还没有工作对象",
          description: "上传接收文件或手工登记资料后，会显示在统一队列中。",
        },
      }[workbench.queueFilter];
  const loadErrorMessage =
    workbench.workObjectsQuery.error instanceof Error
      ? workbench.workObjectsQuery.error.message
      : "请检查服务连接或稍后重试。";

  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      setRenderStage(1);
      secondFrame = window.requestAnimationFrame(() => setRenderStage(2));
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, []);

  return (
    <section
      ref={containerRef}
      className="received-assets-workbench"
      aria-labelledby="received-assets-title"
    >
      {renderStage === 0 ? (
        <div className={styles.heroSkeleton} aria-busy="true">
          <h2 id="received-assets-title" className="sr-only">
            接收文件录入
          </h2>
          <div className={styles.heroSkeletonMain}>
            <Skeleton className={styles.skeletonBadge} />
            <Skeleton className={styles.skeletonTitle} />
            <Skeleton className={styles.skeletonDescription} />
          </div>
          <div className={styles.heroSkeletonAside}>
            <Skeleton className={styles.skeletonFlow} />
            <Skeleton className={styles.skeletonSummary} />
          </div>
        </div>
      ) : (
        <SpotlightSurface as="header" className={styles.header} data-assets-panel>
          <div className={styles.heroMain}>
            <div className={styles.eyebrowRow}>
              <Badge variant="secondary" className={styles.contextBadge}>
                <Boxes data-icon="inline-start" aria-hidden />
                资料与对象
              </Badge>
              <Badge
                variant="outline"
                className={styles.dataBadge}
                data-state={
                  workbench.workObjectsQuery.isError
                    ? "error"
                    : workbench.workObjectsQuery.isFetching
                      ? "syncing"
                      : "live"
                }
              >
                {workbench.workObjectsQuery.isError
                  ? "加载失败"
                  : workbench.workObjectsQuery.isFetching
                    ? "同步中"
                    : "真实数据"}
              </Badge>
            </div>

            <div className={styles.titleBlock}>
              <span className={styles.kicker}>ASSET INTAKE · 资料接收</span>
              <div className={styles.titleRow}>
                <span className={styles.titleAccent} aria-hidden />
                <h2 id="received-assets-title" className={styles.title}>
                  接收文件录入
                </h2>
              </div>
            </div>

            <p className={styles.description}>
              把客户交付资料登记为工作对象，再进入需求解析和版本比对。
            </p>
          </div>

          <div className={styles.heroAside}>
            <ol className={styles.flow} aria-label="资料处理流程">
              {INTAKE_FLOW.map((step, index) => (
                <li
                  key={step}
                  className={styles.flowStep}
                  data-active={index === 0 ? "true" : undefined}
                  aria-current={index === 0 ? "step" : undefined}
                >
                  {index > 0 ? <ArrowRight className={styles.flowArrow} aria-hidden /> : null}
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <dl className={styles.summary}>
              <SummaryTile label="待确认" value={workbench.summary.draftCount} tone="warning" />
              <SummaryTile label="已确认" value={workbench.summary.confirmedCount} tone="primary" />
              <SummaryTile label="历史版本" value={workbench.summary.historicalCount} tone="info" />
              <SummaryTile
                label="代码包"
                value={workbench.summary.codePackageCount}
                tone="neutral"
              />
            </dl>
          </div>
        </SpotlightSurface>
      )}

      {renderStage >= 2 ? (
        <>
          <div className={`received-assets-grid ${styles.revealSequence}`}>
            <div className="received-assets-sidebar">
              <ReceivedAssetDropzone onFiles={workbench.addFiles} />

              <section
                className="received-panel"
                aria-labelledby="received-batch-title"
                data-assets-panel
              >
                <header className="received-panel-header">
                  <span className="received-panel-icon">
                    <ShieldCheck aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 id="received-batch-title" className="text-sm font-semibold">
                      接收信息
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">随本次上传保存并可批量套用</p>
                  </div>
                </header>

                <FieldGroup className="gap-3">
                  <Field>
                    <FieldLabel htmlFor="received-at">接收日期</FieldLabel>
                    <Input
                      id="received-at"
                      type="date"
                      value={workbench.defaults.receivedAt}
                      onChange={(event) =>
                        workbench.setDefaults((previous) => ({
                          ...previous,
                          receivedAt: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="received-source">提供方</FieldLabel>
                    <Input
                      id="received-source"
                      value={workbench.defaults.source}
                      onChange={(event) =>
                        workbench.setDefaults((previous) => ({
                          ...previous,
                          source: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="received-mode">接收方式</FieldLabel>
                    <Select
                      value={workbench.defaults.receiveMode}
                      onValueChange={(value) =>
                        workbench.setDefaults((previous) => ({
                          ...previous,
                          receiveMode: value as ReceiveMode,
                        }))
                      }
                    >
                      <SelectTrigger id="received-mode" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {receiveModeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </FieldGroup>

                <div className="grid gap-2">
                  <ButtonWithReason
                    type="button"
                    size="sm"
                    reason={
                      workbench.isApplyingDefaults
                        ? "正在应用接收信息"
                        : "当前没有待确认资料，暂无可套用的接收信息"
                    }
                    disabled={!workbench.summary.draftCount || workbench.isApplyingDefaults}
                    onClick={workbench.applyDefaults}
                  >
                    {workbench.isApplyingDefaults ? (
                      <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
                    ) : (
                      <CircleCheck data-icon="inline-start" aria-hidden />
                    )}
                    应用到待确认
                  </ButtonWithReason>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={workbench.isCreatingManual}
                    onClick={() => workbench.setManualOpen(true)}
                  >
                    <FilePlus2 data-icon="inline-start" aria-hidden />
                    手工登记
                  </Button>
                </div>
              </section>
            </div>

            <section
              className="received-panel received-table-panel"
              data-assets-panel
              aria-labelledby="received-queue-title"
            >
              <div className="received-table-toolbar">
                <div className="min-w-0">
                  <h3 id="received-queue-title" className="text-base font-semibold">
                    工作对象队列
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    上传后立即入库；修改在离开输入框或切换选项时保存
                  </p>
                </div>
                <div className={styles.queueControls}>
                  <div
                    className={styles.searchField}
                    data-active={workbench.isSearchActive || undefined}
                  >
                    <Search className={styles.searchIcon} aria-hidden />
                    <Input
                      value={workbench.searchQuery}
                      placeholder="搜索名称、文件、版本或提供方"
                      aria-label="搜索工作对象"
                      className={styles.searchInput}
                      onChange={(event) => workbench.changeSearchQuery(event.target.value)}
                    />
                    {workbench.searchQuery ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className={styles.searchClear}
                        aria-label="清除工作对象搜索"
                        onClick={workbench.clearSearch}
                      >
                        <X aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                  <div className={styles.batchActions}>
                    <ButtonWithReason
                      type="button"
                      size="sm"
                      reason={
                        workbench.isConfirming ? "正在确认所选对象" : "请先在待确认列表中勾选对象"
                      }
                      disabled={!workbench.selectedIds.length || workbench.isConfirming}
                      onClick={() => workbench.confirmAssets(workbench.selectedIds)}
                    >
                      {workbench.isConfirming ? (
                        <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
                      ) : null}
                      确认选中
                    </ButtonWithReason>
                    <ButtonWithReason
                      type="button"
                      variant="outline"
                      size="sm"
                      reason={workbench.isConfirming ? "正在确认工作对象" : "当前没有待确认资料"}
                      disabled={!workbench.summary.draftCount || workbench.isConfirming}
                      onClick={() =>
                        workbench.confirmAssets(
                          workbench.assets
                            .filter((asset) => asset.status === "draft")
                            .map((asset) => asset.id),
                        )
                      }
                    >
                      确认全部
                    </ButtonWithReason>
                  </div>
                </div>
              </div>

              <Tabs
                value={workbench.queueFilter}
                onValueChange={workbench.changeQueueFilter}
                className="w-full min-w-0 gap-3"
              >
                <TabsList className={styles.filterTabs}>
                  <TabsTrigger value="draft" className="px-3 text-xs">
                    待确认 {workbench.summary.draftCount}
                  </TabsTrigger>
                  <TabsTrigger value="confirmed" className="px-3 text-xs">
                    已确认 {workbench.summary.confirmedCount}
                  </TabsTrigger>
                  <TabsTrigger value="superseded" className="px-3 text-xs">
                    已替代 {workbench.summary.supersededCount}
                  </TabsTrigger>
                  <TabsTrigger value="revoked" className="px-3 text-xs">
                    已作废 {workbench.summary.revokedCount}
                  </TabsTrigger>
                  <TabsTrigger value="all" className="px-3 text-xs">
                    全部 {workbench.assets.length}
                  </TabsTrigger>
                </TabsList>
                <ReceivedAssetTable
                  assets={workbench.visibleAssets}
                  draftPatches={workbench.draftPatches}
                  selectedIds={workbench.selectedIds}
                  loading={workbench.workObjectsQuery.isPending}
                  error={
                    workbench.workObjectsQuery.isError && !workbench.workObjectsQuery.data
                      ? loadErrorMessage
                      : undefined
                  }
                  onRetry={() => void workbench.workObjectsQuery.refetch()}
                  emptyTitle={emptyCopy.title}
                  emptyDescription={emptyCopy.description}
                  searchActive={workbench.isSearchActive}
                  onClearSearch={workbench.clearSearch}
                  onToggle={workbench.toggleAsset}
                  onToggleAll={workbench.toggleVisibleAssets}
                  onEdit={workbench.editAsset}
                  onUpdate={workbench.updateAsset}
                  onConfirm={(id) => workbench.confirmAssets([id])}
                  onCorrect={workbench.openCorrection}
                  onWithdraw={workbench.withdrawAsset}
                  onRevoke={workbench.revokeAsset}
                  onHistory={workbench.openHistory}
                  onRemove={workbench.removeAsset}
                />
              </Tabs>

              <footer className="received-table-footer">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>已选 {workbench.selectedIds.length}</span>
                  <span className="text-border">|</span>
                  <span>已确认文档 {workbench.summary.confirmedDocumentCount}</span>
                  {workbench.isSearchActive ? (
                    <>
                      <span className="text-border">|</span>
                      <span aria-live="polite">匹配 {workbench.visibleAssetCount} 项</span>
                    </>
                  ) : null}
                </div>
                <ButtonWithReason
                  type="button"
                  variant="ghost"
                  size="sm"
                  reason="还没有已确认文档，暂时无法进入需求解析"
                  disabled={!workbench.summary.confirmedDocumentCount}
                  onClick={() => navigate(`/projects/${project.id}/workspace/requirements`)}
                >
                  进入需求解析
                  <ArrowRight data-icon="inline-end" aria-hidden />
                </ButtonWithReason>
              </footer>
            </section>
          </div>

          {workbench.manualOpen ? (
            <ManualWorkObjectDialog
              open={workbench.manualOpen}
              submitting={workbench.isCreatingManual}
              defaults={workbench.defaults}
              onOpenChange={workbench.setManualOpen}
              onSubmit={workbench.submitManual}
            />
          ) : null}

          <AlertDialog
            open={workbench.pendingDelete !== null}
            onOpenChange={(open) => {
              if (!open) workbench.setPendingDelete(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除待确认登记？</AlertDialogTitle>
                <AlertDialogDescription>
                  将删除 {workbench.pendingDelete?.objectName || "未命名对象"}{" "}
                  {workbench.pendingDelete?.version ?? ""}
                  的数据库记录，并同步删除对应接收文件。此操作不可撤销；已确认的工作对象版本不会出现本入口。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={(event) => {
                    event.preventDefault();
                    if (workbench.pendingDelete) workbench.submitDelete(workbench.pendingDelete.id);
                  }}
                >
                  {workbench.isDeleting ? "删除中..." : "确认删除"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {workbench.pendingLifecycle ? (
            <WorkObjectReasonDialog
              action={workbench.pendingLifecycle.action}
              asset={workbench.pendingLifecycle.asset}
              submitting={
                workbench.pendingLifecycle.action === "withdraw"
                  ? workbench.isWithdrawing
                  : workbench.isRevoking
              }
              onOpenChange={(open) => {
                if (!open) workbench.setPendingLifecycle(null);
              }}
              onSubmit={workbench.submitLifecycle}
            />
          ) : null}

          {pendingCorrection ? (
            <WorkObjectCorrectionDialog
              asset={pendingCorrection.asset}
              values={pendingCorrection}
              submitting={workbench.isCorrecting}
              onOpenChange={(open) => {
                if (!open) workbench.setPendingCorrection(null);
              }}
              onChange={(values) =>
                workbench.setPendingCorrection((previous) =>
                  previous ? { ...previous, ...values } : previous,
                )
              }
              onSubmit={workbench.submitCorrection}
            />
          ) : null}

          {workbench.historyID ? (
            <WorkObjectHistoryDialog
              asset={
                workbench.assets.find((asset) => asset.id === workbench.historyID) ??
                workbench.assets[0]
              }
              events={workbench.lifecycleQuery.data ?? []}
              loading={workbench.lifecycleQuery.isPending}
              onOpenChange={(open) => {
                if (!open) workbench.setHistoryID("");
              }}
            />
          ) : null}

          {workbench.uploadLoading ? (
            <UploadProgressOverlay
              state={workbench.uploadLoading}
              onClose={workbench.closeUploadProgress}
            />
          ) : null}
        </>
      ) : (
        <div className={styles.bodySkeleton} aria-hidden="true">
          <div className={styles.bodySkeletonSidebar}>
            <Skeleton className={styles.bodySkeletonDropzone} />
            <Skeleton className={styles.bodySkeletonInfo} />
          </div>
          <div className={styles.bodySkeletonMain}>
            <Skeleton className={styles.bodySkeletonToolbar} />
            <Skeleton className={styles.bodySkeletonTable} />
          </div>
        </div>
      )}
    </section>
  );
}

function ButtonWithReason({
  reason,
  disabled,
  className,
  ...buttonProps
}: ComponentProps<typeof Button> & { reason: string }) {
  if (!disabled) {
    return <Button {...buttonProps} className={className} />;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          {...buttonProps}
          className={[className, styles.disabledButton].filter(Boolean).join(" ")}
          aria-disabled="true"
          onClick={(event) => event.preventDefault()}
        />
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "warning" | "primary" | "info" | "neutral";
}) {
  return (
    <div className={styles.summaryItem} data-summary-tone={tone}>
      <dt>{label}</dt>
      <dd className="font-mono">
        {value}
        <small>项</small>
      </dd>
    </div>
  );
}
