import { GitBranch } from "lucide-react";
import { WorkspaceModulePlaceholder } from "../workspace-module-placeholder";

export function RequirementsModule() {
  return (
    <WorkspaceModulePlaceholder
      icon={GitBranch}
      title="需求追溯"
      description="工作对象、软件需求、测试项与用例的全链路追溯。"
      tone="success"
      blocks={[
        {
          label: "工作对象",
          content: "研制任务书、需求规格说明、技术要求与代码包版本。",
          status: "待录入",
        },
        {
          label: "需求树",
          content: "章节号、名称、描述、类型、平台与版本归属。",
          status: "待建模",
        },
        { label: "测试项映射", content: "需求与测试项的多对多关系。", status: "待建模" },
        { label: "追溯矩阵", content: "需求、测试项、用例与问题的双向追踪。", status: "待建模" },
      ]}
    />
  );
}
