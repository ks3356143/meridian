import { Boxes } from "lucide-react";
import { WorkspaceModulePlaceholder } from "../workspace-module-placeholder";

export function DutModule() {
  return (
    <WorkspaceModulePlaceholder
      icon={Boxes}
      title="被测对象"
      description="软件概述、接口说明与静态测试环境，作为项目级章节内容块复用。"
      tone="info"
      blocks={[
        { label: "软件概述", content: "模块组成、功能叙述、组成图与指标覆盖。", status: "待录入" },
        { label: "接口说明", content: "外部接口叙述、示意图与接口信息表。", status: "待录入" },
        { label: "静态环境描述", content: "静态测试环境说明与环境约束。", status: "待录入" },
        { label: "静态软件项", content: "工具、被测软件与提供单位。", status: "待录入" },
        { label: "静态硬件项", content: "设备配置、提供单位与用途。", status: "待录入" },
      ]}
    />
  );
}
