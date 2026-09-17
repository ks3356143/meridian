import { Keyboard } from "lucide-react";
import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import styles from "./requirement-shortcuts-dialog.module.css";

type ShortcutRow = {
  keys: string[];
  scope: string;
  description: string;
};

type FunctionRow = {
  name: string;
  description: string;
};

const shortcutRows: ShortcutRow[] = [
  {
    keys: ["Ctrl / Meta", "Enter"],
    scope: "新增需求弹窗",
    description: "保存当前需求并继续录入，保留来源、章节号和需求类型。",
  },
  {
    keys: ["Esc"],
    scope: "新增需求弹窗",
    description: "关闭弹窗并清空本次未保存内容。",
  },
  {
    keys: ["Tab"],
    scope: "表单",
    description: "焦点进入下一个字段。",
  },
  {
    keys: ["Shift", "Tab"],
    scope: "表单",
    description: "焦点回到上一个字段。",
  },
  {
    keys: ["↑ / ↓"],
    scope: "需求树",
    description: "上下移动节点焦点；聚焦需求后右侧详情同步切换。",
  },
  {
    keys: ["→ / ←"],
    scope: "需求树",
    description: "展开或收起来源分组。",
  },
  {
    keys: ["Enter"],
    scope: "需求树",
    description: "激活当前节点；需求节点进入右侧详情。",
  },
];

const functionRows: FunctionRow[] = [
  {
    name: "保存并继续",
    description:
      "保存后不关闭弹窗，保留来源文档、章节号和需求类型，清空标识、名称和描述，并把焦点移回名称。",
  },
  {
    name: "保存",
    description: "校验通过后写入正式需求基线并关闭弹窗。",
  },
  {
    name: "失焦自动保存",
    description: "详情字段校验通过且失焦后立即保存；输入过程不发起请求。",
  },
  {
    name: "树焦点联动",
    description: "键盘或鼠标聚焦需求节点时，右侧详情同步切换。",
  },
  {
    name: "标识自动生成",
    description: "标识留空时按名称拼音首字母生成四位；同版本内非空标识不重复。",
  },
  {
    name: "副类型",
    description: "可选多选；不能与主类型相同，保存并继续时随主类型一起保留。",
  },
  {
    name: "章节挂接",
    description: "章节号只挂接或创建当前需求对应章节，不自动补齐无关父章节。",
  },
  {
    name: "错误提示",
    description: "必填和格式错误即时提示；修正后错误平滑收起。",
  },
];

export function RequirementShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className={styles.title}>
            <Keyboard aria-hidden />
            快捷键与功能说明
          </DialogTitle>
          <DialogDescription>查看需求工作台当前可用的键盘操作和连续录入行为。</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="shortcuts" className={styles.tabs}>
          <TabsList variant="line" className={styles.tabsList}>
            <TabsTrigger value="shortcuts">
              快捷键
              <Badge variant="outline" className={styles.count}>
                {shortcutRows.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="functions">
              功能说明
              <Badge variant="outline" className={styles.count}>
                {functionRows.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="shortcuts" className={styles.content}>
            <Table className={styles.table}>
              <TableHeader>
                <TableRow>
                  <TableHead>按键</TableHead>
                  <TableHead>范围</TableHead>
                  <TableHead>结果</TableHead>
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
          </TabsContent>

          <TabsContent value="functions" className={styles.content}>
            <Table className={styles.table}>
              <TableHeader>
                <TableRow>
                  <TableHead>功能</TableHead>
                  <TableHead>说明</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {functionRows.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className={styles.scope}>{row.name}</TableCell>
                    <TableCell className={styles.description}>{row.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            知道了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
