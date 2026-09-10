import { useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <div ref={containerRef} className="flex flex-col gap-4">
      <header className="dictionary-reveal flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-sm">
            <SlidersHorizontal className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">字典配置</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              维护项目创建选项、依据文件与相关方元数据，停用不会影响历史项目。
            </p>
          </div>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList className="dictionary-reveal grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="dictionaries">技术字典</TabsTrigger>
          <TabsTrigger value="standards">依据标准</TabsTrigger>
          <TabsTrigger value="parties">相关方字典</TabsTrigger>
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
