import { FileText } from "lucide-react";
import { WorkspaceModulePlaceholder } from "../workspace-module-placeholder";

export function DocumentsModule() {
  return (
    <WorkspaceModulePlaceholder
      icon={FileText}
      title="文档产出"
      description="文档实例、时间口径试算、版本记录与交付导出。"
      tone="chart"
      blocks={[
        { label: "文档清单", content: "大纲、说明、记录、报告与问题单合集。", status: "待生成" },
        { label: "生成预检", content: "缺失数据、阻断项、警告与跳转。", status: "待建模" },
        {
          label: "时间口径",
          content: "锚点试算、差异预览、人工锁定与全量自洽校验。",
          status: "待建模",
        },
        {
          label: "版本记录",
          content: "模板快照、数据快照、时间口径与修改章节。",
          status: "待建模",
        },
        { label: "交付导出", content: "单份下载与全量文档打包。", status: "待生成" },
      ]}
    />
  );
}
