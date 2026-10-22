import { useRef, useState } from "react";
import { BookMarked, Building2, FileCog, SlidersHorizontal } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { DictionaryManagementTab } from "./dictionary-management-tab";
import { StandardManagementTab } from "./standard-management-tab";
import { RelatedPartyManagementTab } from "./related-party-management-tab";
import { useSubtleReveal } from "@/hooks/use-subtle-reveal";

export function DictionaryManagementPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"dictionaries" | "standards" | "parties">(
    "dictionaries",
  );

  useSubtleReveal(containerRef, ".dictionary-reveal");

  return (
    <div ref={containerRef} className="flex flex-col gap-6">
      <PageHeader
        className="dictionary-reveal"
        icon={SlidersHorizontal}
        title="字典配置"
        description="维护项目创建选项、依据文件与相关方元数据；停用不会影响历史项目。"
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList
          variant="line"
          className="dictionary-reveal w-full max-w-3xl justify-start overflow-x-auto"
        >
          <TabsTrigger value="dictionaries">
            <BookMarked aria-hidden />
            技术字典
          </TabsTrigger>
          <TabsTrigger value="standards">
            <FileCog aria-hidden />
            依据标准
          </TabsTrigger>
          <TabsTrigger value="parties">
            <Building2 aria-hidden />
            相关方
          </TabsTrigger>
        </TabsList>
        <TabsContent value="dictionaries">
          <DictionaryManagementTab />
        </TabsContent>
        <TabsContent value="standards">
          <StandardManagementTab />
        </TabsContent>
        <TabsContent value="parties">
          <RelatedPartyManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
