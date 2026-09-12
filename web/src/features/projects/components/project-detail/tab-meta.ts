import {
  BookOpen,
  Boxes,
  ClipboardList,
  FileText,
  GitBranch,
  History,
  ListChecks,
  ShieldAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DetailTabValue } from "./status-model";

export type DetailPanelTone = "info" | "primary" | "warning" | "danger" | "chart" | "success";

export const DETAIL_TABS: Array<{
  value: DetailTabValue;
  label: string;
  icon: LucideIcon;
}> = [
  { value: "overview", label: "总览", icon: ClipboardList },
  { value: "profile", label: "项目资料", icon: BookOpen },
  { value: "dut", label: "被测对象", icon: Boxes },
  { value: "requirements", label: "需求追溯", icon: GitBranch },
  { value: "test-items", label: "测试设计", icon: ListChecks },
  { value: "rounds", label: "轮次执行", icon: History },
  { value: "issues", label: "问题单", icon: ShieldAlert },
  { value: "documents", label: "文档产出", icon: FileText },
];

export const MODULE_TONES: Record<DetailTabValue, DetailPanelTone> = {
  overview: "primary",
  profile: "primary",
  dut: "info",
  requirements: "chart",
  "test-items": "warning",
  rounds: "success",
  issues: "danger",
  documents: "chart",
};
