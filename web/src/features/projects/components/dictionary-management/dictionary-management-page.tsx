import { useRef, useState } from "react";
import { BookMarked, Building2, FileCog, SlidersHorizontal } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { DictionaryManagementTab } from "./dictionary-management-tab";
import { StandardManagementTab } from "./standard-management-tab";
import { RelatedPartyManagementTab } from "./related-party-management-tab";
import { gsap, useGSAP } from "@/lib/gsap";

export function DictionaryManagementPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"dictionaries" | "standards" | "parties">(
    "dictionaries",
  );

  useGSAP(
    () => {
      if (!containerRef.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from(".dictionary-reveal", {
        opacity: 0,
        y: 14,
        duration: 0.4,
        stagger: 0.06,
        ease: "power3.out",
      });
    },
    { scope: containerRef },
  );

  return (
    <div ref={containerRef} className="flex flex-col gap-6">
      <PageHeader
        className="dictionary-reveal"
        icon={SlidersHorizontal}
        title="字典配置"
        description="维护项目创建选项、依据文件与相关方元数据；停用不会影响历史项目。"
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList variant="line" className="dictionary-reveal w-full max-w-3xl justify-start">
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
