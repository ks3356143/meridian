import { AlertTriangle, FileCheck2, FileText, Plus, X } from "lucide-react";
import { Fade } from "@animate-ui/react/primitives/effects/fade";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import type { StaticState } from "@/features/test-items/types";
import { ConfirmAction } from "./static-shared";
import styles from "./static-workbench.module.css";
import dcStyles from "./static-dc.module.css";

export function DcDocsTab({
  state,
  missingDocs,
  addDocuments,
  update,
}: {
  state: StaticState;
  missingDocs: string[];
  addDocuments: (names: string[]) => void;
  update: (recipe: (draft: StaticState) => void) => void;
}) {
  return (
    <TabsContent value="docs" className={dcStyles.dcTabPanel}>
      {missingDocs.length > 0 ? (
        <Fade asChild initialOpacity={0.75}>
          <div className={dcStyles.dcBanner} data-tone="warn">
            <AlertTriangle aria-hidden />
            <span>当前平台推荐文档还差 {missingDocs.length} 项</span>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => addDocuments(missingDocs)}
            >
              补齐推荐文档
            </Button>
          </div>
        </Fade>
      ) : (
        <Fade asChild initialOpacity={0.75}>
          <div className={dcStyles.dcBanner} data-tone="ok">
            <FileCheck2 aria-hidden />
            <span>受审文档清单已补齐。</span>
          </div>
        </Fade>
      )}
      <div className={dcStyles.dcDocTableWrap}>
        <table className={dcStyles.dcDocTable}>
          <thead>
            <tr>
              <th>#</th>
              <th>文档名称</th>
              <th>版本</th>
              <th>类别</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {state.documents.map((doc, index) => (
              <Fade
                key={doc.id}
                asChild
                delay={index * 24}
                initialOpacity={0}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              >
                <tr className={dcStyles.dcDocTableRow}>
                  <td className={dcStyles.dcDocSeq}>{String(index + 1).padStart(2, "0")}</td>
                  <td>
                    <div className={dcStyles.dcDocName}>
                      <FileText aria-hidden />
                      <Input
                        value={doc.name}
                        aria-label="受审文档名称"
                        className={dcStyles.dcDocNameInput}
                        onChange={(event) =>
                          update((next) => {
                            const target = next.documents.find((item) => item.id === doc.id);
                            if (target) target.name = event.target.value;
                          })
                        }
                      />
                    </div>
                  </td>
                  <td>
                    <Input
                      value={doc.version}
                      placeholder="版本"
                      aria-label="受审文档版本"
                      className={dcStyles.dcDocVersionInput}
                      onChange={(event) =>
                        update((next) => {
                          const target = next.documents.find((item) => item.id === doc.id);
                          if (target) target.version = event.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <span className={dcStyles.dcDocCategory}>{doc.category || "未分类"}</span>
                  </td>
                  <td>
                    <ConfirmAction
                      title="删除受审文档"
                      description={`确认从清单中移除“${doc.name || "未命名文档"}”？`}
                      onConfirm={() =>
                        update((next) => {
                          next.documents = next.documents.filter((item) => item.id !== doc.id);
                        })
                      }
                    >
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        aria-label="删除受审文档"
                      >
                        <X aria-hidden />
                      </Button>
                    </ConfirmAction>
                  </td>
                </tr>
              </Fade>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.inlineActions}>
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() =>
            update((next) => {
              next.documents.push({
                id: crypto.randomUUID(),
                name: "自定义文档",
                version: "",
                category: "自定义",
                seq: next.documents.length + 1,
              });
            })
          }
        >
          <Plus aria-hidden />
          自定义文档
        </Button>
      </div>
    </TabsContent>
  );
}
