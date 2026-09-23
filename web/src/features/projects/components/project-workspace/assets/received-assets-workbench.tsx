import { ArrowRight, Boxes, CircleCheck, FilePlus2, Loader2, ShieldCheck } from "lucide-react";
import { useRef } from "react";
import { useNavigate } from "react-router";
import { gsap, useGSAP } from "@/lib/gsap";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export function ReceivedAssetsWorkbench({ project }: { project: Project }) {
  const navigate = useNavigate();
  const workbench = useReceivedAssetsWorkbench(project);
  const pendingCorrection = workbench.pendingCorrection;
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.fromTo(
        "[data-assets-panel]",
        { opacity: 0 },
        { opacity: 1, duration: 0.32, ease: "power3.out", stagger: 0.05 },
      );
    },
    { scope: containerRef },
  );

  return (
    <section
      ref={containerRef}
      className="received-assets-workbench"
      aria-labelledby="received-assets-title"
    >
      <header className="received-header" data-assets-panel>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="h-6 px-2">
              <Boxes data-icon="inline-start" aria-hidden />
              资料与对象
            </Badge>
            <Badge
              variant={workbench.workObjectsQuery.isError ? "destructive" : "outline"}
              className="h-6 px-2"
            >
              {workbench.workObjectsQuery.isError ? "加载失败" : "真实数据"}
            </Badge>
          </div>
          <h2 id="received-assets-title" className="mt-3 text-xl font-semibold tracking-tight">
            接收文件录入
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            把客户交付资料登记为工作对象，再进入需求解析和版本比对。
          </p>
        </div>
        <dl className="received-summary">
          <SummaryTile label="待确认" value={workbench.summary.draftCount} tone="warning" />
          <SummaryTile label="已确认" value={workbench.summary.confirmedCount} tone="primary" />
          <SummaryTile label="历史版本" value={workbench.summary.historicalCount} tone="info" />
          <SummaryTile label="代码包" value={workbench.summary.codePackageCount} tone="neutral" />
        </dl>
      </header>

      <div className="received-assets-grid">
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
              <Button
                type="button"
                size="sm"
                disabled={!workbench.summary.draftCount || workbench.isApplyingDefaults}
                onClick={workbench.applyDefaults}
              >
                {workbench.isApplyingDefaults ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
                ) : (
                  <CircleCheck data-icon="inline-start" aria-hidden />
                )}
                应用到待确认
              </Button>
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
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={!workbench.selectedIds.length || workbench.isConfirming}
                onClick={() => workbench.confirmAssets(workbench.selectedIds)}
              >
                {workbench.isConfirming ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
                ) : null}
                确认选中
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
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
              </Button>
            </div>
          </div>

          <Tabs
            value={workbench.queueFilter}
            onValueChange={workbench.changeQueueFilter}
            className="gap-3"
          >
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="draft" className="px-3 text-xs">
                待确认 {workbench.summary.draftCount}
              </TabsTrigger>
              <TabsTrigger value="confirmed" className="px-3 text-xs">
                已确认 {workbench.summary.confirmedCount}
              </TabsTrigger>
              <TabsTrigger value="superseded" className="px-3 text-xs">
                已替代 {workbench.assets.filter((asset) => asset.status === "superseded").length}
              </TabsTrigger>
              <TabsTrigger value="revoked" className="px-3 text-xs">
                已作废 {workbench.assets.filter((asset) => asset.status === "revoked").length}
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
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!workbench.summary.confirmedDocumentCount}
              onClick={() => navigate(`/projects/${project.id}/workspace/requirements`)}
            >
              进入需求解析
              <ArrowRight data-icon="inline-end" aria-hidden />
            </Button>
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
    </section>
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
    <div data-summary-tone={tone}>
      <dt>{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
