import {
  Circle,
  CheckCircle2,
  CloudUpload,
  Database,
  FolderInput,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatFileSize } from "../received-asset-model";

export type UploadLoadingPhase = "uploading" | "saving" | "refreshing" | "done";

export interface UploadLoadingState {
  phase: UploadLoadingPhase;
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  fileCount: number;
}

const statusText: Record<UploadLoadingPhase, string> = {
  uploading: "正在传输接收文件",
  saving: "服务端正在落盘并写入数据库",
  refreshing: "正在刷新工作对象队列",
  done: "接收文件已保存",
};

const statusDescription: Record<UploadLoadingPhase, string> = {
  uploading: "文件正从浏览器发送到本地服务，大小文件都可能出现等待。",
  saving: "服务端正在保存资产目录、校验文件并写入 SQLite 数据库。",
  refreshing: "数据库已保存，正在重新读取工作对象队列。",
  done: "全部接收文件已完成保存，可查看队列后手动关闭。",
};

export function UploadProgressOverlay({
  state,
  onClose,
}: {
  state: UploadLoadingState;
  onClose: () => void;
}) {
  const canClose = state.phase === "done";
  const steps = [
    { label: "上传请求", icon: CloudUpload, state: stepState(state, "uploading") },
    { label: "落盘与入库", icon: Database, state: stepState(state, "saving") },
    { label: "列表刷新", icon: RefreshCw, state: stepState(state, "refreshing") },
  ];
  const percent = Math.min(100, Math.max(0, Math.round(state.progress)));

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        className="upload-progress-dialog"
        aria-busy={!canClose}
        onEscapeKeyDown={(event) => {
          if (!canClose) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (!canClose) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (!canClose) event.preventDefault();
        }}
      >
        <div className="upload-progress-grid" aria-hidden />

        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="upload-progress-icon" data-phase={state.phase}>
              {state.phase === "done" ? (
                <CheckCircle2 aria-hidden />
              ) : (
                <Loader2 className="animate-spin" aria-hidden />
              )}
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-bold tracking-tight">
                {canClose ? "接收文件保存完成" : "接收文件正在保存"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {state.fileCount} 个文件 · {formatFileSize(state.totalBytes, true)} · 请等待本轮完成
              </DialogDescription>
            </div>
          </div>
          <p aria-live="assertive" className="sr-only">
            {statusText[state.phase]}
          </p>
        </div>

        <div className="relative grid gap-3">
          <div className="flex items-end justify-between gap-4">
            <p className="upload-progress-status">{statusText[state.phase]}</p>
            <p className="upload-progress-percent font-mono">{percent}%</p>
          </div>
          <Progress data-phase={state.phase} value={percent} className="h-2" />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="font-mono">
              {formatFileSize(state.uploadedBytes, true)} / {formatFileSize(state.totalBytes, true)}
            </span>
            <span>{statusDescription[state.phase]}</span>
          </div>
        </div>

        <ol className="upload-progress-steps relative">
          {steps.map(({ label, icon: Icon, state: step }) => (
            <li key={label} data-state={step}>
              <span className="upload-step-icon">
                <Icon aria-hidden />
              </span>
              <span className="min-w-0">{label}</span>
              {step === "active" ? (
                <Loader2 className="upload-step-spinner animate-spin" aria-hidden />
              ) : step === "complete" ? (
                <CheckCircle2 className="upload-step-check" aria-hidden />
              ) : (
                <Circle className="upload-step-pending" aria-hidden />
              )}
            </li>
          ))}
        </ol>

        <div className="upload-progress-footnote relative">
          <FolderInput aria-hidden />
          <span>大文件会按真实传输进度反馈；完成后保留结果，由你手动关闭。</span>
        </div>

        {canClose ? (
          <div className="upload-progress-actions relative">
            <Button type="button" onClick={onClose}>
              关闭
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function stepState(state: UploadLoadingState, phase: Exclude<UploadLoadingPhase, "done">) {
  const order = ["uploading", "saving", "refreshing"];
  if (state.phase === "done") return "complete";
  const current = order.indexOf(state.phase);
  const target = order.indexOf(phase);

  if (current > target) return "complete";
  if (current < target) return "pending";
  return "active";
}
