import { GitBranch, Highlighter, ListChecks, Rows3, X } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TestItemsView } from "./test-items-view";
import styles from "./test-items-view-bar.module.css";

type TestItemsViewBarProps = {
  view: TestItemsView;
  typeFilter: string;
  allRounds: boolean;
  roundName: string;
  itemCount: number;
  caseCount: number;
  onViewChange: (view: string) => void;
  onClearTypeFilter: () => void;
};

/** 测试与执行的四个分析视图入口；统计与类型筛选和页签共用一行。 */
export function TestItemsViewBar({
  view,
  typeFilter,
  allRounds,
  roundName,
  itemCount,
  caseCount,
  onViewChange,
  onClearTypeFilter,
}: TestItemsViewBarProps) {
  return (
    <div className={styles.viewBar}>
      <Tabs value={view} onValueChange={onViewChange} className={styles.viewTabsRoot}>
        <TabsList variant="line" className={styles.viewTabs} aria-label="测试项视图">
          <TabsTrigger value="tree">
            <Rows3 aria-hidden />
            树视图
          </TabsTrigger>
          <TabsTrigger value="coverage">
            <ListChecks aria-hidden />
            类型覆盖
          </TabsTrigger>
          <TabsTrigger value="trace">
            <GitBranch aria-hidden />
            追溯矩阵
          </TabsTrigger>
          <TabsTrigger value="annotations">
            <Highlighter aria-hidden />
            标注总览
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {view === "tree" && typeFilter !== "" ? (
        <button type="button" className={styles.typeFilterChip} onClick={onClearTypeFilter}>
          类型 {typeFilter}
          <X aria-hidden />
        </button>
      ) : null}
      <div className={styles.viewMeta} aria-label="当前视图统计">
        <span className={styles.viewMetaScope}>{allRounds ? "跨轮只读" : roundName}</span>
        <span className={styles.viewMetaCount}>
          <strong>{itemCount}</strong> 项
        </span>
        <span className={styles.viewMetaCount}>
          <strong>{caseCount}</strong> 用例
        </span>
      </div>
    </div>
  );
}
