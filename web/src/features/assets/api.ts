import { request } from "@/api/client";
import type {
  ReceiveMode,
  ReceivedAssetDefaults,
  ReceivedWorkObject,
  WorkObjectStatus,
  WorkObjectKind,
} from "./types";

export interface WorkObjectLifecycleEvent {
  id: string;
  workObjectVersionId: string;
  action: "confirm" | "supersede" | "withdraw" | "restore" | "revoke";
  fromStatus: WorkObjectStatus;
  toStatus: WorkObjectStatus;
  replacementVersionId: string;
  reason: string;
  operatedBy: string;
  operatedAt: string;
}

export interface UploadWorkObjectsPayload extends ReceivedAssetDefaults {
  files: File[];
}

export interface SaveWorkObjectPayload {
  objectKind: WorkObjectKind;
  objectName: string;
  version: string;
  source: string;
  receivedAt: string;
  receiveMode: ReceiveMode;
  platform?: string;
}

function toFormData(payload: UploadWorkObjectsPayload): FormData {
  const formData = new FormData();
  for (const file of payload.files) {
    formData.append("files", file);
  }
  formData.append("source", payload.source);
  formData.append("receivedAt", payload.receivedAt);
  formData.append("receiveMode", payload.receiveMode);
  return formData;
}

export const workObjectsApi = {
  list: (projectId: string) =>
    request<ReceivedWorkObject[]>("GET", `/api/v1/projects/${projectId}/work-objects`),
  upload: (projectId: string, payload: UploadWorkObjectsPayload) =>
    request<ReceivedWorkObject[]>(
      "POST",
      `/api/v1/projects/${projectId}/work-objects/upload`,
      {},
      toFormData(payload),
    ),
  createManual: (projectId: string, payload: SaveWorkObjectPayload & { platform: string }) =>
    request<ReceivedWorkObject>(
      "POST",
      `/api/v1/projects/${projectId}/work-objects/manual`,
      {},
      payload,
    ),
  update: (id: string, payload: SaveWorkObjectPayload) =>
    request<ReceivedWorkObject>("PUT", `/api/v1/work-object-versions/${id}`, {}, payload),
  confirm: (id: string) =>
    request<ReceivedWorkObject>("POST", `/api/v1/work-object-versions/${id}/confirm`),
  withdraw: (id: string, reason: string) =>
    request<ReceivedWorkObject>(
      "POST",
      `/api/v1/work-object-versions/${id}/withdraw`,
      {},
      { reason },
    ),
  revoke: (id: string, reason: string) =>
    request<ReceivedWorkObject>(
      "POST",
      `/api/v1/work-object-versions/${id}/revoke`,
      {},
      { reason },
    ),
  lifecycle: (id: string) =>
    request<WorkObjectLifecycleEvent[]>("GET", `/api/v1/work-object-versions/${id}/lifecycle`),
  remove: (id: string) => request<void>("DELETE", `/api/v1/work-object-versions/${id}`),
};
