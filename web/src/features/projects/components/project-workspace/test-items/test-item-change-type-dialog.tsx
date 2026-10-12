import { useMemo, useState } from "react";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TestItemRecord, TestItemType } from "@/features/test-items/types";
import { categoryTone } from "./test-items-design";
import { TypePicker } from "./test-item-type-picker";
import styles from "./test-item-change-type-dialog.module.css";

/** 修改测试项类型：确认前先展示影响（标识、用例编号、树分组）。 */
export function ChangeItemTypeDialog({
  open,
  item,
  types,
  usedStaticCodes,
  caseCount,
  folderName,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  item: TestItemRecord;
  types: TestItemType[];
  /** 本轮已存在的静态类型：DC/SA/CR/CW 各一个，已建的不再出现在选项里。 */
  usedStaticCodes: string[];
  caseCount: number;
  /** 当前所在文件夹名；文件夹按类型归属，跨类型会自动移出。 */
  folderName: string;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (typeCode: string) => Promise<unknown>;
}) {
  const [nextTypeCode, setNextTypeCode] = useState("");
  // 打开时重置选择：用官方“渲染期调整状态”模式，避免 effect 里同步 setState。
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setNextTypeCode("");
  }

  const usedStatic = useMemo(() => new Set(usedStaticCodes), [usedStaticCodes]);
  const availableTypes = useMemo(
    () =>
      types.filter(
        (type) => type.code !== item.typeCode && (!type.isStatic || !usedStatic.has(type.code)),
      ),
    [item.typeCode, types, usedStatic],
  );

  const currentType = types.find((type) => type.code === item.typeCode);
  const nextType = availableTypes.find((type) => type.code === nextTypeCode);
  const nextIdentifier = nextType ? `XQ_${nextType.code}_${item.suffix}` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle className={styles.title}>修改测试项类型</DialogTitle>
          <DialogDescription>
            <span className={styles.ident}>{item.identifier}</span>
            <span className={styles.descSep}> · </span>
            {item.name}
          </DialogDescription>
        </DialogHeader>

        <div className={styles.body}>
          <div className={styles.switchRow}>
            <span
              className={styles.currentType}
              data-tone={currentType ? categoryTone(currentType.category) : undefined}
            >
              {currentType ? `${currentType.code} ${currentType.name}` : item.typeCode}
            </span>
            <ArrowRight className={styles.arrow} aria-hidden />
            <div className={styles.picker}>
              <TypePicker
                id="change-item-type"
                types={availableTypes}
                value={nextTypeCode}
                placeholder="选择新类型"
                onChange={setNextTypeCode}
              />
            </div>
          </div>

          {nextType ? (
            <div className={styles.preview}>
              <p className={styles.previewTitle}>
                <TriangleAlert aria-hidden />
                确认后以下内容会一起更新
              </p>
              <ul className={styles.previewList}>
                <li>
                  标识：{item.identifier} → <strong>{nextIdentifier}</strong>
                  <span className={styles.previewNote}>（后缀被该类型占用时按名称自动调整）</span>
                </li>
                <li>
                  用例编号：
                  {caseCount > 0
                    ? `${caseCount} 条用例将同步改为 YL_${nextType.code}_…`
                    : "暂无用例"}
                </li>
                <li>树分组：移动到「{nextType.name}」分组下</li>
                <li>套话：充分性要求 / 通过准则未手工改过时，跟随 {nextType.code} 的默认话术</li>
                {folderName ? <li>文件夹：从「{folderName}」移出（文件夹按类型归属）</li> : null}
                {nextType.isStatic ? (
                  <li className={styles.previewWarn}>
                    静态测试项不建立需求关联；若已有关联需求将被拒绝
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={!nextTypeCode || submitting}
            className={styles.submitButton}
            onClick={() => void onSubmit(nextTypeCode)}
          >
            {submitting ? "修改中…" : "确认修改"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
