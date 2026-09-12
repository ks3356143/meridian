import { Settings2 } from "lucide-react";
import { WorkspaceModulePlaceholder } from "../workspace-module-placeholder";

export function ProfileModule() {
  return (
    <WorkspaceModulePlaceholder
      icon={Settings2}
      title="项目资料"
      description="项目级基准数据，全轮次共享并进入封面、依据文件与组织分工。"
      blocks={[
        {
          label: "基本信息",
          content: "项目标识、测评性质、平台、密级与安全等级快照。",
          status: "待建模",
        },
        { label: "相关方", content: "委托方、研制方与测评中心的联系信息。", status: "待录入" },
        { label: "人员角色", content: "负责人、成员、测试人员与监测人员。", status: "待建模" },
        { label: "依据文件", content: "标准文件、顶层技术文件与被测软件文档。", status: "待录入" },
        {
          label: "时间锚点",
          content: "资料接收、大纲评审、测试开始与结束时间。",
          status: "待录入",
        },
      ]}
    />
  );
}
