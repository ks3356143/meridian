import { useNavigate } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { totalOpenIssues, type Project } from "../../types";
import { OverviewDetailTab } from "./overview-detail-tab";
import { ProfileDetailTab } from "./profile-detail-tab";
import { Checklist, MetricTile, StateChip, StatusPanel } from "./status-panel";
import { workspacePath, type DetailTabValue } from "./status-model";
import { DETAIL_TABS } from "./tab-meta";

export function ProjectDetailTabs({
  project,
  activeTab,
  onTabChange,
}: {
  project: Project;
  activeTab: DetailTabValue;
  onTabChange: (tab: DetailTabValue) => void;
}) {
  const navigate = useNavigate();
  const openWorkspace = (tab: DetailTabValue = "overview") =>
    navigate(workspacePath(project.id, tab));

  return (
    <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as DetailTabValue)}>
      <TabsList variant="line" className="w-full overflow-x-auto">
        {DETAIL_TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="min-w-24 shrink-0 px-3">
            <tab.icon aria-hidden />
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview" className="project-detail-tab mt-5">
        <OverviewDetailTab project={project} onEnterWorkspace={() => openWorkspace()} />
      </TabsContent>

      <TabsContent value="profile" className="project-detail-tab mt-5">
        <ProfileDetailTab project={project} onOpenWorkspace={() => openWorkspace("profile")} />
      </TabsContent>

      <DetailStatusTab value="dut" title="被测对象状态" action="处理被测对象">
        <Checklist
          items={[
            { label: "软件概述", state: "pending", detail: "富文本与模块组成待录入" },
            { label: "接口说明", state: "pending", detail: "接口示意图与接口表待录入" },
            { label: "静态测试环境", state: "pending", detail: "软件、硬件与固件配置待录入" },
            { label: "版本基线", state: "pending", detail: "软件版本与技术文档版本待锁定" },
          ]}
        />
      </DetailStatusTab>

      <DetailStatusTab value="requirements" title="需求追溯状态" action="处理需求追溯">
        <Checklist
          items={[
            { label: "来源文档", state: "pending", detail: "需求规格与研制方交付文档待登记" },
            { label: "需求树", state: "pending", detail: "章节、需求标识和需求性质待建模" },
            { label: "测试项关联", state: "pending", detail: "需求到测试项的覆盖关系待生成" },
            { label: "追溯矩阵", state: "pending", detail: "需求、测试项、用例与问题关系待汇总" },
          ]}
        />
      </DetailStatusTab>

      <DetailStatusTab value="test-items" title="测试设计状态" action="处理测试设计">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricTile label="测试用例" value={project.casesTotal} />
          <MetricTile label="已形成执行记录" value={project.casesExecuted} />
          <MetricTile label="类型覆盖" value="待统计" />
        </div>
        <Checklist
          items={[
            { label: "静态测试项", state: "pending", detail: "按平台自动创建规则待接入" },
            { label: "动态测试项", state: "pending", detail: "需求关联创建流程待接入" },
            {
              label: "测试用例",
              state: project.casesTotal > 0 ? "partial" : "pending",
              detail: `${project.casesTotal} 条`,
            },
          ]}
        />
      </DetailStatusTab>

      <DetailStatusTab value="rounds" title="轮次执行状态" action="处理轮次">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricTile label="当前阶段" value={project.status} />
          <MetricTile label="执行记录" value={project.casesExecuted} />
          <MetricTile
            label="执行率"
            value={`${Math.round((project.casesExecuted / Math.max(project.casesTotal, 1)) * 100)}%`}
          />
        </div>
        <Checklist
          items={[
            { label: "全局轮次", state: "pending", detail: "第 1 轮待创建" },
            { label: "动态测试环境", state: "pending", detail: "按轮次维护版本与设备配置" },
            { label: "轮次范围", state: "pending", detail: "本轮测试项与用例范围待确认" },
          ]}
        />
      </DetailStatusTab>

      <DetailStatusTab value="issues" title="问题状态" action="处理问题单">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="重大" value={project.openIssues.critical} tone="danger" />
          <MetricTile label="严重" value={project.openIssues.serious} tone="danger" />
          <MetricTile label="一般" value={project.openIssues.normal} tone="warning" />
          <MetricTile label="建议改进" value={project.openIssues.suggestion} tone="info" />
        </div>
        <Checklist
          items={[
            {
              label: "未闭环合计",
              state: totalOpenIssues(project.openIssues) > 0 ? "partial" : "pending",
              detail: `${totalOpenIssues(project.openIssues)} 个`,
            },
            { label: "问题报告单", state: "pending", detail: "对外报告单载体待建模" },
            { label: "回归验证", state: "pending", detail: "问题影响域与回归结果待关联" },
          ]}
        />
      </DetailStatusTab>

      <DetailStatusTab value="documents" title="文档产出状态" action="处理文档">
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {DETAIL_DOCUMENTS.map((documentName) => (
            <div
              key={documentName}
              className="bg-muted/25 border-border flex items-center justify-between gap-3 rounded-sm border px-3 py-2.5"
            >
              <span className="min-w-0 truncate text-xs font-medium">{documentName}</span>
              <StateChip state="pending">待生成</StateChip>
            </div>
          ))}
        </div>
      </DetailStatusTab>
    </Tabs>
  );

  function DetailStatusTab({
    value,
    title,
    action,
    children,
  }: {
    value: DetailTabValue;
    title: string;
    action: string;
    children: React.ReactNode;
  }) {
    return (
      <TabsContent value={value} className="project-detail-tab mt-5">
        <StatusPanel title={title} action={action} onAction={() => openWorkspace(value)}>
          {children}
        </StatusPanel>
      </TabsContent>
    );
  }
}

const DETAIL_DOCUMENTS = [
  "测评大纲",
  "测试说明",
  "回归测试说明",
  "测试记录",
  "回归测试记录",
  "测评报告",
  "问题单合集",
];
