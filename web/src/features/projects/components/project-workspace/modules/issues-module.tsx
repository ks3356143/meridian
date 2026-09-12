import { ShieldAlert } from "lucide-react";
import { WorkspaceModulePlaceholder } from "../workspace-module-placeholder";

export function IssuesModule() {
  return (
    <WorkspaceModulePlaceholder
      icon={ShieldAlert}
      title="问题单"
      description="缺陷实体、对外报告单、处理意见与回归验证链。"
      tone="danger"
      blocks={[
        { label: "缺陷列表", content: "问题类型、等级、状态与关联用例。", status: "待建模" },
        { label: "报告单", content: "对外问题载体与多缺陷聚合关系。", status: "待建模" },
        { label: "研制方反馈", content: "原因分析、改正措施与影响域。", status: "待录入" },
        { label: "回归验证", content: "闭环版本、验证结果、人员与日期。", status: "待录入" },
      ]}
    />
  );
}
