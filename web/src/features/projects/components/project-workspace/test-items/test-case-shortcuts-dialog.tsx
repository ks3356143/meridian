import { Fragment } from "react";
import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import styles from "./test-case-shortcuts-dialog.module.css";

type ShortcutRow = {
  keys: string[];
  scope: string;
  description: string;
};

const shortcutRows: ShortcutRow[] = [
  {
    keys: ["Ctrl / Meta", "Z"],
    scope: "用例字段",
    description: "撤销最近一次已保存的改动；编辑框内聚焦时由浏览器原生逐字撤销。",
  },
  {
    keys: ["Ctrl / Meta", "← / →"],
    scope: "用例",
    description: "切换到同测试项内的上一条 / 下一条用例。",
  },
  {
    keys: ["Esc"],
    scope: "编辑框",
    description: "退出当前编辑并恢复本次修改前的值。",
  },
  {
    keys: ["Ctrl / Meta", "Enter"],
    scope: "多行编辑",
    description: "提交并退出当前编辑框；失焦同样会保存。",
  },
  {
    keys: ["Alt", "↑ / ↓"],
    scope: "测试步骤",
    description: "上移 / 下移当前步骤。",
  },
  {
    keys: ["Ctrl / Meta", "D"],
    scope: "测试步骤",
    description: "复制当前步骤到下方。",
  },
  {
    keys: ["Ctrl / Meta", "Shift", "Enter"],
    scope: "测试步骤",
    description: "在当前步骤上方插入一个空步骤。",
  },
  {
    keys: ["Ctrl / Meta", "Backspace"],
    scope: "测试步骤",
    description: "删除当前步骤，并弹出二次确认。",
  },
];

export function TestCaseShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className={styles.title}>
            <Keyboard aria-hidden />
            用例编辑快捷键
          </DialogTitle>
          <DialogDescription>
            编辑用例和步骤时可用；编辑框内 Ctrl+Z 优先做浏览器原生撤销。
          </DialogDescription>
        </DialogHeader>

        <div className={styles.tableWrap}>
          <Table className={styles.table}>
            <TableHeader>
              <TableRow>
                <TableHead>按键</TableHead>
                <TableHead>范围</TableHead>
                <TableHead>作用</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shortcutRows.map((row) => (
                <TableRow key={row.description}>
                  <TableCell>
                    <span className={styles.keys}>
                      {row.keys.map((key, index) => (
                        <Fragment key={`${row.description}-${key}`}>
                          {index > 0 ? <span className={styles.plus}>+</span> : null}
                          <kbd className={styles.key}>{key}</kbd>
                        </Fragment>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell className={styles.scope}>{row.scope}</TableCell>
                  <TableCell className={styles.description}>{row.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            知道了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
