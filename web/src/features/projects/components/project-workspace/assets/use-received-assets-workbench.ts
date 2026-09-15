import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { workObjectsApi } from "@/features/assets/api";
import type { Project } from "../../../types";
import {
  createDefaults,
  getParseState,
  type ReceivedAssetDefaults,
  type ReceivedWorkObject,
  type WorkObjectStatus,
} from "./received-asset-model";
import type { UploadLoadingPhase, UploadLoadingState } from "./components/upload-progress-overlay";
import type { WorkObjectCorrectionValues } from "./components/work-object-correction-dialog";
import type { WorkObjectLifecycleAction } from "./components/work-object-reason-dialog";

type QueueFilter = WorkObjectStatus | "all";

type PendingLifecycle = {
  action: WorkObjectLifecycleAction;
  asset: ReceivedWorkObject;
};

type PendingCorrection = WorkObjectCorrectionValues & { asset: ReceivedWorkObject };

function removeIdenticalDraftPatch(
  previous: Record<string, Partial<ReceivedWorkObject>>,
  id: string,
  patch: Partial<ReceivedWorkObject>,
): Record<string, Partial<ReceivedWorkObject>> {
  const current = previous[id];
  if (!current) return previous;

  const next = { ...current };
  for (const key of Object.keys(patch) as (keyof ReceivedWorkObject)[]) {
    if (next[key] === patch[key]) delete next[key];
  }
  if (!Object.keys(next).length) {
    const { [id]: _removed, ...rest } = previous;
    return rest;
  }
  return { ...previous, [id]: next };
}

export function useReceivedAssetsWorkbench(project: Project) {
  const queryClient = useQueryClient();
  const [defaults, setDefaults] = useState<ReceivedAssetDefaults>(() => createDefaults());
  const [draftPatches, setDraftPatches] = useState<Record<string, Partial<ReceivedWorkObject>>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("draft");
  const [manualOpen, setManualOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ReceivedWorkObject | null>(null);
  const [pendingLifecycle, setPendingLifecycle] = useState<PendingLifecycle | null>(null);
  const [pendingCorrection, setPendingCorrection] = useState<PendingCorrection | null>(null);
  const [historyID, setHistoryID] = useState("");
  const [uploadLoading, setUploadLoading] = useState<UploadLoadingState | null>(null);
  const assetsRef = useRef<ReceivedWorkObject[]>([]);

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

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  const invalidateWorkObjects = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: ["projects", project.id, "work-objects"],
    });
  }, [project.id, queryClient]);

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
      const current = assetsRef.current.find((asset) => asset.id === id);
      if (!current) throw new Error("工作对象不存在");
      const next = { ...current, ...patch };
      return workObjectsApi.update(id, {
        objectKind: next.objectKind,
        objectName: next.objectName,
        version: next.version,
        source: next.source,
        receivedAt: next.receivedAt,
        receiveMode: next.receiveMode,
      });
    },
    onSuccess: async (_result, { id, patch }) => {
      await invalidateWorkObjects();
      setDraftPatches((previous) => removeIdenticalDraftPatch(previous, id, patch));
    },
    onError: (_error, { id, patch }) => {
      setDraftPatches((previous) => removeIdenticalDraftPatch(previous, id, patch));
    },
  });

  const correctionMutation = useMutation({
    mutationFn: ({
      asset,
      objectKind,
      objectName,
      version,
      source,
      reason,
    }: PendingCorrection & { reason: string }) =>
      workObjectsApi.update(asset.id, {
        objectKind,
        objectName,
        version,
        source,
        receivedAt: asset.receivedAt,
        receiveMode: asset.receiveMode,
        correctionReason: reason,
      }),
    onSuccess: () => {
      setPendingCorrection(null);
      toast.success("已保存登记纠错");
      return invalidateWorkObjects();
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => workObjectsApi.confirm(id),
    onSuccess: () => invalidateWorkObjects(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workObjectsApi.remove(id),
    onSuccess: (_result, deletedId) => {
      setSelectedIds((previous) => previous.filter((assetId) => assetId !== deletedId));
      setDraftPatches((previous) => {
        const { [deletedId]: _removed, ...rest } = previous;
        return rest;
      });
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

  const updateMutationRef = useRef(updateMutation);
  const confirmMutationRef = useRef(confirmMutation);

  useEffect(() => {
    updateMutationRef.current = updateMutation;
  }, [updateMutation]);

  useEffect(() => {
    confirmMutationRef.current = confirmMutation;
  }, [confirmMutation]);

  const visibleAssets = useMemo(() => {
    const serverAssets = workObjectsQuery.data ?? [];
    if (queueFilter === "all") return serverAssets;
    return serverAssets.filter((asset) => asset.status === queueFilter);
  }, [queueFilter, workObjectsQuery.data]);

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

  const addFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      setUploadLoading({
        phase: "uploading",
        progress: 3,
        uploadedBytes: 0,
        totalBytes,
        fileCount: files.length,
      });

      try {
        const items = await workObjectsApi.upload(
          project.id,
          {
            files,
            source: defaults.source,
            receivedAt: defaults.receivedAt,
            receiveMode: defaults.receiveMode,
          },
          ({ loaded, total }) => {
            setUploadLoading((previous) => {
              if (!previous) return previous;
              const hasTotal = total !== null;
              const nextPhase: UploadLoadingPhase =
                hasTotal && loaded >= total ? "saving" : "uploading";
              return {
                ...previous,
                phase: nextPhase,
                uploadedBytes: Math.min(previous.totalBytes, loaded),
                progress:
                  hasTotal && total !== null
                    ? Math.min(92, Math.max(previous.progress, (loaded / total) * 92))
                    : previous.progress,
              };
            });
          },
        );

        setSelectedIds(items.filter((item) => item.status === "draft").map((item) => item.id));
        setQueueFilter("draft");
        toast.success(`已保存 ${items.length} 个接收文件`);

        setUploadLoading((previous) =>
          previous
            ? { ...previous, phase: "refreshing", progress: 97, uploadedBytes: previous.totalBytes }
            : previous,
        );
        await invalidateWorkObjects();
        setUploadLoading((previous) =>
          previous
            ? { ...previous, phase: "done", progress: 100, uploadedBytes: previous.totalBytes }
            : previous,
        );
      } catch {
        // uploadRequest already reports the failure through the global toast.
        setUploadLoading(null);
      }
    },
    [defaults, invalidateWorkObjects, project.id],
  );

  const editAsset = useCallback((id: string, patch: Partial<ReceivedWorkObject>) => {
    setDraftPatches((previous) => ({ ...previous, [id]: { ...previous[id], ...patch } }));
  }, []);

  const updateAsset = useCallback(
    (id: string, patch: Partial<ReceivedWorkObject>) => {
      editAsset(id, patch);
      updateMutationRef.current.mutate({ id, patch });
    },
    [editAsset],
  );

  const toggleAsset = useCallback((id: string, checked: boolean) => {
    setSelectedIds((previous) =>
      checked ? [...new Set([...previous, id])] : previous.filter((assetId) => assetId !== id),
    );
  }, []);

  const toggleVisibleAssets = useCallback(
    (checked: boolean) => {
      const visibleDraftIds = visibleAssets
        .filter((asset) => asset.status === "draft")
        .map((asset) => asset.id);
      const visibleIdSet = new Set(visibleDraftIds);

      setSelectedIds((previous) => {
        if (!checked) return previous.filter((assetId) => !visibleIdSet.has(assetId));
        return [...new Set([...previous, ...visibleDraftIds])];
      });
    },
    [visibleAssets],
  );

  const confirmAssets = useCallback(async (ids: string[]) => {
    const requestedAssets = assetsRef.current.filter((asset) => ids.includes(asset.id));
    const targets = requestedAssets.filter(
      (asset) =>
        asset.status === "draft" &&
        asset.objectName.trim() &&
        asset.version.trim() &&
        asset.source.trim(),
    );
    const invalidTargets = requestedAssets.filter(
      (asset) =>
        asset.status === "draft" &&
        (!asset.objectName.trim() || !asset.version.trim() || !asset.source.trim()),
    );
    if (invalidTargets.length) {
      toast.error(`${invalidTargets.length} 个对象缺少名称、版本或提供方，请补齐后再确认`);
    }
    if (!targets.length) {
      return;
    }

    try {
      await Promise.all(targets.map((asset) => confirmMutationRef.current.mutateAsync(asset.id)));
      setSelectedIds((previous) => previous.filter((assetId) => !ids.includes(assetId)));
      toast.success(`已确认 ${targets.length} 个工作对象`);
    } catch {
      toast.error("确认工作对象失败");
    }
  }, []);

  const applyDefaults = useCallback(async () => {
    const draftAssets = assets.filter((asset) => asset.status === "draft");
    if (!draftAssets.length) return;

    try {
      await Promise.all(
        draftAssets.map((asset) =>
          workObjectsApi.update(asset.id, {
            objectKind: asset.objectKind,
            objectName: asset.objectName,
            version: asset.version,
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
  }, [assets, defaults, invalidateWorkObjects]);

  const removeAsset = useCallback((id: string) => {
    setPendingDelete(assetsRef.current.find((asset) => asset.id === id) ?? null);
  }, []);

  const openLifecycle = useCallback((id: string, action: WorkObjectLifecycleAction) => {
    setPendingLifecycle({
      action,
      asset: assetsRef.current.find((asset) => asset.id === id) ?? assetsRef.current[0],
    });
  }, []);

  const withdrawAsset = useCallback((id: string) => openLifecycle(id, "withdraw"), [openLifecycle]);

  const revokeAsset = useCallback((id: string) => openLifecycle(id, "revoke"), [openLifecycle]);

  const openCorrection = useCallback((id: string) => {
    const asset = assetsRef.current.find((item) => item.id === id);
    if (!asset) return;
    setPendingCorrection({
      asset,
      objectKind: asset.objectKind,
      objectName: asset.objectName,
      version: asset.version,
      source: asset.source,
    });
  }, []);

  const openHistory = useCallback((id: string) => setHistoryID(id), []);

  const submitLifecycle = useCallback(
    (reason: string) => {
      if (!pendingLifecycle) return;
      if (pendingLifecycle.action === "withdraw") {
        withdrawMutation.mutate({ id: pendingLifecycle.asset.id, reason });
      } else {
        revokeMutation.mutate({ id: pendingLifecycle.asset.id, reason });
      }
    },
    [pendingLifecycle, revokeMutation, withdrawMutation],
  );

  const submitCorrection = useCallback(
    (reason: string) => {
      if (pendingCorrection) correctionMutation.mutate({ ...pendingCorrection, reason });
    },
    [correctionMutation, pendingCorrection],
  );

  const submitManual = useCallback(
    (values: Parameters<typeof workObjectsApi.createManual>[1]) => {
      manualMutation.mutate(values);
    },
    [manualMutation],
  );

  const submitDelete = useCallback((id: string) => deleteMutation.mutate(id), [deleteMutation]);

  const changeQueueFilter = useCallback(
    (value: string) => {
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
    },
    [assets],
  );

  const closeUploadProgress = useCallback(() => setUploadLoading(null), []);

  return {
    assets,
    draftPatches,
    visibleAssets,
    summary,
    defaults,
    setDefaults,
    selectedIds,
    queueFilter,
    changeQueueFilter,
    workObjectsQuery,
    lifecycleQuery,
    manualOpen,
    setManualOpen,
    pendingDelete,
    setPendingDelete,
    pendingLifecycle,
    setPendingLifecycle,
    pendingCorrection,
    setPendingCorrection,
    historyID,
    setHistoryID,
    uploadLoading,
    closeUploadProgress,
    addFiles,
    editAsset,
    updateAsset,
    toggleAsset,
    toggleVisibleAssets,
    confirmAssets,
    applyDefaults,
    removeAsset,
    withdrawAsset,
    revokeAsset,
    openCorrection,
    openHistory,
    submitLifecycle,
    submitCorrection,
    submitManual,
    submitDelete,
    isApplyingDefaults: updateMutation.isPending,
    isConfirming: confirmMutation.isPending,
    isCreatingManual: manualMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isWithdrawing: withdrawMutation.isPending,
    isRevoking: revokeMutation.isPending,
    isCorrecting: correctionMutation.isPending,
  };
}
