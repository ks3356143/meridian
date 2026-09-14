import { ListChecks } from "lucide-react";
import { WorkspaceModulePlaceholder } from "../workspace-module-placeholder";

export function TestItemsModule() {
  return (
    <WorkspaceModulePlaceholder
      icon={ListChecks}
      title="测试设计"
      description="测试项组织树、静态流程、子项与用例设计。"
      blocks={[
        {
          label: "类型字典",
          content: "静态与动态测试类型的顺序、标识与适用平台。",
          status: "待建模",
        },
        {
          label: "组织树",
          content: "分系统、配置项、功能域等文件夹由用户自建。",
          status: "待建模",
        },
        { label: "测试项", content: "追踪关系、方法、充分性要求与通过准则。", status: "待录入" },
        { label: "测试子项", content: "方法项、描述、操作与预期要点。", status: "待录入" },
        {
          label: "测试用例",
          content: "默认由子项生成，可合并、拆分和手工创建。",
          status: "待录入",
        },
      ]}
    />
  );
}
