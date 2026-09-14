export const workObjectKindOptions = [
  { value: "srs", label: "软件需求规格说明" },
  { value: "system_spec", label: "系统规格说明" },
  { value: "development_requirement", label: "研制总要求" },
  { value: "task_book", label: "软件研制任务书" },
  { value: "technical_requirement", label: "技术要求" },
  { value: "user_manual", label: "用户手册" },
  { value: "code_package", label: "代码包" },
  { value: "other_reference", label: "其他依据资料" },
] as const;

export const assetPlatformOptions = [
  { value: "common", label: "公共" },
  { value: "cpu", label: "CPU/其他" },
  { value: "fpga", label: "FPGA" },
] as const;

export const receiveModeOptions = [
  { value: "email", label: "电子邮件" },
  { value: "onsite", label: "现场拷贝" },
  { value: "platform", label: "协同平台" },
  { value: "other", label: "其他方式" },
] as const;

export type WorkObjectKind = (typeof workObjectKindOptions)[number]["value"];
export type AssetPlatform = (typeof assetPlatformOptions)[number]["value"];
export type ReceiveMode = (typeof receiveModeOptions)[number]["value"];
export type WorkObjectStatus = "draft" | "confirmed" | "superseded" | "revoked";

export interface ReceivedWorkObject {
  id: string;
  projectId: string;
  workObjectId: string;
  objectKind: WorkObjectKind;
  objectName: string;
  originalName: string;
  version: string;
  platform: AssetPlatform;
  status: WorkObjectStatus;
  supersededBy: string;
  source: string;
  receivedAt: string;
  receiveMode: ReceiveMode;
  fileSize: number;
  fileType: string;
  mimeType: string;
  sha256: string;
  assetId: string;
  hasLocalFile: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReceivedAssetDefaults {
  source: string;
  receivedAt: string;
  receiveMode: ReceiveMode;
}

const tableExtensions = new Set(["xls", "xlsx", "csv"]);
const codePackageExtensions = new Set(["zip", "rar", "7z", "tar", "gz"]);

export function createDefaults(): ReceivedAssetDefaults {
  return {
    source: "客户提供",
    receivedAt: new Date().toISOString().slice(0, 10),
    receiveMode: "email",
  };
}

export function getWorkObjectKindLabel(value: WorkObjectKind): string {
  return workObjectKindOptions.find((option) => option.value === value)?.label ?? "其他依据资料";
}

export function getReceiveModeLabel(value: ReceiveMode): string {
  return receiveModeOptions.find((option) => option.value === value)?.label ?? "其他方式";
}

export function getWorkObjectStatusMeta(status: WorkObjectStatus): {
  label: string;
  badgeVariant: "warning" | "default" | "secondary" | "destructive";
} {
  if (status === "confirmed") return { label: "已确认", badgeVariant: "default" };
  if (status === "superseded") return { label: "已被替代", badgeVariant: "secondary" };
  if (status === "revoked") return { label: "已作废", badgeVariant: "destructive" };
  return { label: "待确认", badgeVariant: "warning" };
}

export function getParseState(asset: ReceivedWorkObject): {
  label: string;
  tone: "ready" | "convert" | "code" | "table" | "register";
} {
  const extension =
    asset.fileType ||
    String(asset.originalName ?? "")
      .split(".")
      .pop()
      ?.toLowerCase() ||
    "";

  if (asset.objectKind === "code_package" || codePackageExtensions.has(extension)) {
    return { label: "版本登记", tone: "code" };
  }
  if (asset.objectKind === "user_manual") return { label: "仅登记", tone: "register" };
  if (extension === "docx" || extension === "pdf") return { label: "可解析", tone: "ready" };
  if (extension === "doc") return { label: "需转DOCX", tone: "convert" };
  if (tableExtensions.has(extension)) return { label: "表格解析", tone: "table" };
  return { label: "仅登记", tone: "register" };
}

export function formatFileSize(size: number, hasFile: boolean): string {
  if (!hasFile) return "手工登记";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
