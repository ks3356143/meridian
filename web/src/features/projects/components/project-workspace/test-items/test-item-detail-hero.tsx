import { AlertTriangle, CheckCircle2, FileCheck2, Info, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SpotlightSurface } from "@/components/shared/spotlight-surface";
import type {
  TestCaseSearchHit,
  TestItemDetail,
  TestItemType,
  TestRoundRecord,
} from "@/features/test-items/types";
import { CaseSearch } from "./case-search";
import { DETAIL_INFO, DETAIL_STATIC } from "./test-item-detail-config";
import styles from "./test-item-detail.module.css";

type Completeness = {
  done: number;
  total: number;
  missing: string[];
};

export function TestItemDetailHero({
  item,
  type,
  round,
  folderName,
  tone,
  completeness,
  isStatic,
  onRequestDelete,
  onOpenSearchHit,
}: {
  item: TestItemDetail["item"];
  type: TestItemType | undefined;
  round: TestRoundRecord;
  folderName: string;
  tone: string;
  completeness: Completeness | null;
  isStatic: boolean;
  onRequestDelete: () => void;
  onOpenSearchHit?: (hit: TestCaseSearchHit) => void;
}) {
  const complete = completeness !== null && completeness.done === completeness.total;
  return (
    <SpotlightSurface as="header" className={styles.hero}>
      <div className={styles.heroMain}>
        <div className={styles.heroMetaLine}>
          <span className={styles.heroKind}>TEST ITEM</span>
          <span className={styles.heroIdent}>{item.identifier}</span>
        </div>
        <div className={styles.heroTitleRow}>
          <span className={styles.titleBar} data-tone={tone} aria-hidden />
          <h2 className={styles.heroTitle}>{item.name}</h2>
        </div>
        <div className={styles.heroTags}>
          <Badge variant="primary" className={styles.typeBadge} data-tone={tone}>
            {type ? `${type.code} ${type.name}` : item.typeCode}
          </Badge>
          <Badge variant="outline" className={styles.priorityBadge} data-priority={item.priority}>
            {item.priority}
          </Badge>
          {folderName ? <span className={styles.heroTag}>文件夹：{folderName}</span> : null}
          <span className={styles.heroTag}>{round.name}</span>
        </div>
      </div>
      <div className={styles.heroSide}>
        <CaseSearch testItemId={item.id} onOpenHit={(hit) => onOpenSearchHit?.(hit)} />
        <Button
          type="button"
          variant="outline"
          size="xs"
          className={styles.deleteButton}
          onClick={onRequestDelete}
        >
          <Trash2 aria-hidden />
          删除
        </Button>
        <div
          className={styles.heroCompleteness}
          data-state={completeness === null ? "static" : complete ? "done" : "incomplete"}
        >
          {completeness ? (
            <>
              <div className={styles.completenessTop}>
                <span>{complete ? "已完善" : "未完善"}</span>
                <strong>
                  {completeness.done}/{completeness.total}
                </strong>
              </div>
              <Progress
                value={Math.round((completeness.done / Math.max(completeness.total, 1)) * 100)}
                className={styles.completenessBar}
                data-tone={complete ? "full" : "warn"}
              />
              {item.implicitRequirement ? (
                <span className={styles.implicitNote}>
                  <span className={styles.btnDot} data-tone="amber" aria-hidden />
                  按隐含需求处理（无关联需求）
                </span>
              ) : completeness.missing.length > 0 ? (
                <div className={styles.missingChips}>
                  {completeness.missing.map((label) => (
                    <span key={label} className={styles.missingChip}>
                      <AlertTriangle aria-hidden />缺 {label}
                    </span>
                  ))}
                </div>
              ) : (
                <span className={styles.completenessDone}>
                  <CheckCircle2 aria-hidden />
                  全部齐全，可进入执行
                </span>
              )}
            </>
          ) : (
            <span className={styles.staticNote}>
              <Info aria-hidden />
              静态测试项进度见静态流程
            </span>
          )}
        </div>
      </div>
      {isStatic ? (
        <TabsList variant="line" className={styles.heroDetailTabs} aria-label="测试项详情视图">
          <TabsTrigger value={DETAIL_INFO} className={styles.heroDetailTabTrigger}>
            测试项信息
          </TabsTrigger>
          <TabsTrigger value={DETAIL_STATIC} className={styles.heroDetailTabTrigger}>
            <FileCheck2 aria-hidden />
            静态测试
          </TabsTrigger>
        </TabsList>
      ) : null}
    </SpotlightSurface>
  );
}
