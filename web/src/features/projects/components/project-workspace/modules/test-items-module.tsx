import { ListChecks } from "lucide-react";
import { WorkspaceModulePlaceholder } from "../workspace-module-placeholder";

export function TestItemsModule() {
  return (
    <WorkspaceModulePlaceholder
      icon={ListChecks}
      title="测试设计"
      description="测试项逻辑树、测试方法、子项与用例设计。"
      blocks={[
        {
          label: "类型字典",
          content: "静态与动态测试类型的顺序、标识与适用平台。",
          status: "待建模",
        },
        { label: "文件夹树", content: "测试项与文件夹的同容器混合排序。", status: "待建模" },
        { label: "测试项", content: "追踪关系、方法、充分性要求与通过准则。", status: "待录入" },
        { label: "测试子项", content: "方法项、描述、操作与预期要点。", status: "待录入" },
        {
          label: "测试用例",
          content: "初始化、前提、步骤、终止条件与设计人员。",
          status: "待录入",
        },
      ]}
    />
  );
}
