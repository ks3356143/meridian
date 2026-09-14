import { ArrowRight, Boxes, CircleCheck, FilePlus2, Loader2, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { toast } from "sonner";
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
import { workObjectsApi } from "@/features/assets/api";
import type { Project } from "../../../types";
import {
  createDefaults,
  getParseState,
  receiveModeOptions,
  type ReceiveMode,
  type ReceivedAssetDefaults,
  type ReceivedWorkObject,
  type WorkObjectStatus,
} from "./received-asset-model";
import { ReceivedAssetDropzone } from "./components/received-asset-dropzone";
import { ReceivedAssetTable } from "./components/received-asset-table";
import { ManualWorkObjectDialog } from "./components/manual-work-object-dialog";
import {
  WorkObjectReasonDialog,
  type WorkObjectLifecycleAction,
} from "./components/work-object-reason-dialog";
import { WorkObjectHistoryDialog } from "./components/work-object-history-dialog";

type QueueFilter = WorkObjectStatus | "all";

export function ReceivedAssetsWorkbench({ project }: { project: Project }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [defaults, setDefaults] = useState<ReceivedAssetDefaults>(() => createDefaults());
  const [draftPatches, setDraftPatches] = useState<Record<string, Partial<ReceivedWorkObject>>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("draft");
  const [manualOpen, setManualOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ReceivedWorkObject | null>(null);
  const [pendingLifecycle, setPendingLifecycle] = useState<{
    action: WorkObjectLifecycleAction;
    asset: ReceivedWorkObject;
  } | null>(null);
  const [historyID, setHistoryID] = useState("");

  const workObjectsQuery = useQuery({
    queryKey: ["projects", project.id, "work-objects"],
    queryFn: () => workObjectsApi.list(project.id),
  });

  const lifecycleQuery = useQuery({
    queryKey: ["work-object-lifecycle", historyID],
    queryFn: () => workObjectsApi.lifecycle(historyID),
    enabled: Boolean(historyID),
  });

  const assets = useMemo(() => {
    const serverAssets = workObjectsQuery.data ?? [];
    return serverAssets.map((asset) => ({ ...asset, ...draftPatches[asset.id] }));
  }, [draftPatches, workObjectsQuery.data]);

  const invalidateWorkObjects = () =>
    queryClient.invalidateQueries({ queryKey: ["projects", project.id, "work-objects"] });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) =>
      workObjectsApi.upload(project.id, {
        files,
        source: defaults.source,
        receivedAt: defaults.receivedAt,
        receiveMode: defaults.receiveMode,
      }),
    onSuccess: (items) => {
      setSelectedIds(items.filter((item) => item.status === "draft").map((item) => item.id));
      setQueueFilter("draft");
      toast.success(`已保存 ${items.length} 个接收文件`);
      return invalidateWorkObjects();
    },
  });

  const manualMutation = useMutation({
    mutationFn: (payload: Parameters<typeof workObjectsApi.createManual>[1]) =>
      workObjectsApi.createManual(project.id, payload),
    onSuccess: () => {
      setManualOpen(false);
      setQueueFilter("draft");
      toast.success("已保存手工登记对象");
      return invalidateWorkObjects();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ReceivedWorkObject> }) => {
      const current = assets.find((asset) => asset.id === id);
      if (!current) throw new Error("工作对象不存在");
      const next = { ...current, ...patch };
      return workObjectsApi.update(id, {
        objectKind: next.objectKind,
        objectName: next.objectName,
        version: next.version,
        platform: next.platform,
        source: next.source,
        receivedAt: next.receivedAt,
        receiveMode: next.receiveMode,
      });
    },
    onSuccess: () => invalidateWorkObjects(),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => workObjectsApi.confirm(id),
    onSuccess: () => invalidateWorkObjects(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workObjectsApi.remove(id),
    onSuccess: (_result, deletedId) => {
      setSelectedIds((previous) => previous.filter((assetId) => assetId !== deletedId));
      setPendingDelete(null);
      return invalidateWorkObjects();
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      workObjectsApi.withdraw(id, reason),
    onSuccess: () => {
      setPendingLifecycle(null);
      toast.success("已撤回确认");
      return invalidateWorkObjects();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      workObjectsApi.revoke(id, reason),
    onSuccess: () => {
      setPendingLifecycle(null);
      toast.success("已作废工作对象版本");
      return invalidateWorkObjects();
    },
  });

  const visibleAssets = useMemo(() => {
    if (queueFilter === "all") return assets;
    return assets.filter((asset) => asset.status === queueFilter);
  }, [assets, queueFilter]);

  const summary = useMemo(() => {
    const draftAssets = assets.filter((asset) => asset.status === "draft");
    const confirmedAssets = assets.filter((asset) => asset.status === "confirmed");
    const historicalAssets = assets.filter(
      (asset) => asset.status === "superseded" || asset.status === "revoked",
    );
    const parseableAssets = assets.filter((asset) => getParseState(asset).tone === "ready");
    const codePackages = assets.filter((asset) => asset.objectKind === "code_package");

    return {
      draftCount: draftAssets.length,
      confirmedCount: confirmedAssets.length,
      historicalCount: historicalAssets.length,
      parseableCount: parseableAssets.length,
      codePackageCount: codePackages.length,
      confirmedDocumentCount: confirmedAssets.filter((asset) => asset.objectKind !== "code_package")
        .length,
    };
  }, [assets]);

  const addFiles = (files: File[]) => {
    if (!files.length) return;
    uploadMutation.mutate(files);
  };

  const editAsset = (id: string, patch: Partial<ReceivedWorkObject>) => {
    setDraftPatches((previous) => ({ ...previous, [id]: { ...previous[id], ...patch } }));
  };

  const updateAsset = (id: string, patch: Partial<ReceivedWorkObject>) => {
    editAsset(id, patch);
    updateMutation.mutate({ id, patch });
  };

  const toggleAsset = (id: string, checked: boolean) => {
    setSelectedIds((previous) =>
      checked ? [...new Set([...previous, id])] : previous.filter((assetId) => assetId !== id),
    );
  };

  const toggleVisibleAssets = (checked: boolean) => {
    const visibleDraftIds = visibleAssets
      .filter((asset) => asset.status === "draft")
      .map((asset) => asset.id);
    const visibleIdSet = new Set(visibleDraftIds);

    setSelectedIds((previous) => {
      if (!checked) return previous.filter((assetId) => !visibleIdSet.has(assetId));
      return [...new Set([...previous, ...visibleDraftIds])];
    });
  };

  const confirmAssets = async (ids: string[]) => {
    const targets = assets.filter(
      (asset) =>
        ids.includes(asset.id) &&
        asset.status === "draft" &&
        asset.objectName.trim() &&
        asset.version.trim() &&
        asset.source.trim(),
    );
    if (!targets.length) {
      toast.error("没有可确认的对象，请补齐名称、版本和提供方");
      return;
    }

    try {
      await Promise.all(targets.map((asset) => confirmMutation.mutateAsync(asset.id)));
      setSelectedIds((previous) => previous.filter((assetId) => !ids.includes(assetId)));
      toast.success(`已确认 ${targets.length} 个工作对象`);
    } catch {
      toast.error("确认工作对象失败");
    }
  };

  const applyDefaults = async () => {
    const draftAssets = assets.filter((asset) => asset.status === "draft");
    if (!draftAssets.length) return;

    try {
      await Promise.all(
        draftAssets.map((asset) =>
          workObjectsApi.update(asset.id, {
            objectKind: asset.objectKind,
            objectName: asset.objectName,
            version: asset.version,
            platform: asset.platform,
            source: defaults.source,
            receivedAt: defaults.receivedAt,
            receiveMode: defaults.receiveMode,
          }),
        ),
      );
      await invalidateWorkObjects();
      toast.success("接收信息已应用到待确认队列");
    } catch {
      toast.error("应用接收信息失败");
    }
  };

  const removeAsset = (id: string) => {
    setPendingDelete(assets.find((asset) => asset.id === id) ?? null);
  };

  const submitLifecycle = (reason: string) => {
    if (!pendingLifecycle) return;
    if (pendingLifecycle.action === "withdraw") {
      withdrawMutation.mutate({ id: pendingLifecycle.asset.id, reason });
    } else {
      revokeMutation.mutate({ id: pendingLifecycle.asset.id, reason });
    }
  };

  return (
    <section
      className="workspace-route received-assets-workbench"
      aria-labelledby="received-assets-title"
    >
      <header className="received-header">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="h-6 px-2">
              <Boxes data-icon="inline-start" aria-hidden />
              资料与对象
            </Badge>
            <Badge
              variant={workObjectsQuery.isError ? "destructive" : "outline"}
              className="h-6 px-2"
            >
              {workObjectsQuery.isError ? "加载失败" : "真实数据"}
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
          <SummaryTile label="待确认" value={summary.draftCount} tone="warning" />
          <SummaryTile label="已确认" value={summary.confirmedCount} tone="primary" />
          <SummaryTile label="历史版本" value={summary.historicalCount} tone="info" />
          <SummaryTile label="代码包" value={summary.codePackageCount} tone="neutral" />
        </dl>
      </header>

      <div className="received-assets-grid">
        <div className="received-assets-sidebar">
          <ReceivedAssetDropzone onFiles={addFiles} />

          <section className="received-panel" aria-labelledby="received-batch-title">
            <header className="received-panel-header">
              <span className="received-panel-icon">
                {uploadMutation.isPending ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <ShieldCheck aria-hidden />
                )}
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
                  value={defaults.receivedAt}
                  onChange={(event) =>
                    setDefaults((previous) => ({ ...previous, receivedAt: event.target.value }))
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="received-source">提供方</FieldLabel>
                <Input
                  id="received-source"
                  value={defaults.source}
                  onChange={(event) =>
                    setDefaults((previous) => ({ ...previous, source: event.target.value }))
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="received-mode">接收方式</FieldLabel>
                <Select
                  value={defaults.receiveMode}
                  onValueChange={(value) =>
                    setDefaults((previous) => ({
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
                disabled={!summary.draftCount || updateMutation.isPending}
                onClick={applyDefaults}
              >
                {updateMutation.isPending ? (
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
                disabled={manualMutation.isPending}
                onClick={() => setManualOpen(true)}
              >
                <FilePlus2 data-icon="inline-start" aria-hidden />
                手工登记
              </Button>
            </div>
          </section>
        </div>

        <section
          className="received-panel received-table-panel"
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
                disabled={!selectedIds.length || confirmMutation.isPending}
                onClick={() => confirmAssets(selectedIds)}
              >
                {confirmMutation.isPending ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
                ) : null}
                确认选中
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!summary.draftCount || confirmMutation.isPending}
                onClick={() =>
                  confirmAssets(
                    assets.filter((asset) => asset.status === "draft").map((asset) => asset.id),
                  )
                }
              >
                确认全部
              </Button>
            </div>
          </div>

          <Tabs
            value={queueFilter}
            onValueChange={(value) => {
              const nextFilter = value as QueueFilter;
              setQueueFilter(nextFilter);
              setSelectedIds((previous) =>
                previous.filter((assetId) =>
                  assets.some(
                    (asset) =>
                      asset.id === assetId &&
                      asset.status === "draft" &&
                      (nextFilter === "all" || asset.status === nextFilter),
                  ),
                ),
              );
            }}
            className="gap-3"
          >
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="draft" className="px-3 text-xs">
                待确认 {summary.draftCount}
              </TabsTrigger>
              <TabsTrigger value="confirmed" className="px-3 text-xs">
                已确认 {summary.confirmedCount}
              </TabsTrigger>
              <TabsTrigger value="superseded" className="px-3 text-xs">
                已替代 {assets.filter((asset) => asset.status === "superseded").length}
              </TabsTrigger>
              <TabsTrigger value="revoked" className="px-3 text-xs">
                已作废 {assets.filter((asset) => asset.status === "revoked").length}
              </TabsTrigger>
              <TabsTrigger value="all" className="px-3 text-xs">
                全部 {assets.length}
              </TabsTrigger>
            </TabsList>
            <ReceivedAssetTable
              assets={visibleAssets}
              selectedIds={selectedIds}
              loading={workObjectsQuery.isPending}
              onToggle={toggleAsset}
              onToggleAll={toggleVisibleAssets}
              onEdit={editAsset}
              onUpdate={updateAsset}
              onConfirm={(id) => confirmAssets([id])}
              onWithdraw={(id) =>
                setPendingLifecycle({
                  action: "withdraw",
                  asset: assets.find((asset) => asset.id === id) ?? assets[0],
                })
              }
              onRevoke={(id) =>
                setPendingLifecycle({
                  action: "revoke",
                  asset: assets.find((asset) => asset.id === id) ?? assets[0],
                })
              }
              onHistory={(id) => setHistoryID(id)}
              onRemove={removeAsset}
            />
          </Tabs>

          <footer className="received-table-footer">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>已选 {selectedIds.length}</span>
              <span className="text-border">|</span>
              <span>已确认文档 {summary.confirmedDocumentCount}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!summary.confirmedDocumentCount}
              onClick={() => navigate(`/projects/${project.id}/workspace/requirements`)}
            >
              进入需求解析
              <ArrowRight data-icon="inline-end" aria-hidden />
            </Button>
          </footer>
        </section>
      </div>

      {manualOpen ? (
        <ManualWorkObjectDialog
          open={manualOpen}
          submitting={manualMutation.isPending}
          defaults={defaults}
          onOpenChange={setManualOpen}
          onSubmit={(values) => manualMutation.mutate(values)}
        />
      ) : null}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除待确认登记？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除 {pendingDelete?.objectName || "未命名对象"} V{pendingDelete?.version ?? ""}
              的数据库记录，并同步删除对应接收文件。此操作不可撤销；已确认的工作对象版本不会出现本入口。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
              }}
            >
              {deleteMutation.isPending ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pendingLifecycle ? (
        <WorkObjectReasonDialog
          action={pendingLifecycle.action}
          asset={pendingLifecycle.asset}
          submitting={
            pendingLifecycle.action === "withdraw"
              ? withdrawMutation.isPending
              : revokeMutation.isPending
          }
          onOpenChange={(open) => {
            if (!open) setPendingLifecycle(null);
          }}
          onSubmit={submitLifecycle}
        />
      ) : null}

      {historyID ? (
        <WorkObjectHistoryDialog
          asset={assets.find((asset) => asset.id === historyID) ?? assets[0]}
          events={lifecycleQuery.data ?? []}
          loading={lifecycleQuery.isPending}
          onOpenChange={(open) => {
            if (!open) setHistoryID("");
          }}
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
