import { History } from "lucide-react";
import { WorkspaceModulePlaceholder } from "../workspace-module-placeholder";

export function TestRoundsModule() {
  return (
    <WorkspaceModulePlaceholder
      icon={History}
      title="轮次工作区"
      description="本轮范围、环境数据、执行记录、回归链与闭轮检查。"
      tone="warning"
      blocks={[
        { label: "轮次基线", content: "软件版本、技术文档版本与数据集版本。", status: "待建模" },
        { label: "动态环境", content: "环境描述、软件项、硬件项与测评场所。", status: "待录入" },
        { label: "测评数据", content: "数据描述、性质、规格、数量与提供单位。", status: "待录入" },
        { label: "差异分析", content: "真实环境、测试环境与影响分析。", status: "待录入" },
        { label: "回归范围", content: "上轮失败用例、影响域与人工增删。", status: "待建模" },
      ]}
    />
  );
}
