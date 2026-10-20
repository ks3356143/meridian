import { useState } from "react";
import { ClipboardList, FilePlus2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StaticCodeFile, StaticState } from "@/features/test-items/types";
import { ConfirmAction } from "./static-shared";
import { uid, type StaticUpdater } from "./static-model";
import styles from "./static-workbench.module.css";

export function CwWorkbench({ state, update }: { state: StaticState; update: StaticUpdater }) {
  const [bulk, setBulk] = useState("");
  const totalLines = state.codeFiles.reduce((sum, file) => sum + (file.lines ?? 0), 0);
  const addFile = () =>
    update((next) => {
      next.codeFiles.push({ id: uid(), name: "", lines: null });
    });
  const importFiles = () => {
    const rows: StaticCodeFile[] = bulk
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[\t,]/).map((part) => part.trim());
        const last = parts.at(-1);
        const lines = last && /^\d+$/.test(last) ? Number(last) : null;
        return { id: uid(), name: lines === null ? line : parts.slice(0, -1).join(" "), lines };
      });
    if (rows.length === 0) return;
    update((next) => {
      next.codeFiles.push(...rows);
    });
    setBulk("");
    toast.success(`已导入 ${rows.length} 个文件`);
  };
  return (
    <div className={styles.cwWrap}>
      <div className={styles.summaryStrip}>
        <div className={styles.summaryItem}>
          <span>源代码文件</span>
          <strong>{state.codeFiles.length}</strong>
        </div>
        <div className={styles.summaryItem}>
          <span>总行数</span>
          <strong>{totalLines}</strong>
        </div>
      </div>
      <div className={styles.cwToolbar}>
        <Button type="button" size="sm" onClick={addFile}>
          <FilePlus2 aria-hidden />
          新增文件行
        </Button>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.fileTable}>
          <thead>
            <tr>
              <th>序号</th>
              <th>文件</th>
              <th>行数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {state.codeFiles.map((file, index) => (
              <tr key={file.id}>
                <td>{index + 1}</td>
                <td>
                  <Input
                    value={file.name}
                    placeholder="例如 src/main.c"
                    aria-label={`第 ${index + 1} 个文件`}
                    onChange={(event) =>
                      update((next) => {
                        const target = next.codeFiles.find((item) => item.id === file.id);
                        if (target) target.name = event.target.value;
                      })
                    }
                  />
                </td>
                <td>
                  <Input
                    type="number"
                    min="0"
                    value={file.lines ?? ""}
                    aria-label={`第 ${index + 1} 个文件行数`}
                    onChange={(event) =>
                      update((next) => {
                        const target = next.codeFiles.find((item) => item.id === file.id);
                        if (target)
                          target.lines =
                            event.target.value === "" ? null : Number(event.target.value);
                      })
                    }
                  />
                </td>
                <td>
                  <ConfirmAction
                    title="删除文件行"
                    description={`确认移除“${file.name || "未命名文件"}”？`}
                    onConfirm={() =>
                      update((next) => {
                        next.codeFiles = next.codeFiles.filter((item) => item.id !== file.id);
                      })
                    }
                  >
                    <Button type="button" size="icon-xs" variant="ghost" aria-label="删除文件行">
                      <Trash2 aria-hidden />
                    </Button>
                  </ConfirmAction>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Accordion type="single" collapsible className={styles.bulkAccordion}>
        <AccordionItem value="bulk">
          <AccordionTrigger>批量粘贴文件清单</AccordionTrigger>
          <AccordionContent>
            <p className={styles.hint}>
              每行一个文件，支持“文件路径,行数”或“文件路径 + Tab + 行数”。
            </p>
            <Textarea
              value={bulk}
              minRows={4}
              placeholder={"src/main.c,1200\nsrc/init.c,480"}
              aria-label="批量粘贴文件清单"
              onChange={(event) => setBulk(event.target.value)}
            />
            <div className={styles.inlineActions}>
              <Button type="button" size="sm" disabled={!bulk.trim()} onClick={importFiles}>
                <ClipboardList aria-hidden />
                导入清单
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
