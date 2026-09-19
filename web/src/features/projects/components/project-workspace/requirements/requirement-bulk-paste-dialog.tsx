import {
  AlertTriangle,
  ClipboardPaste,
  FolderTree,
  Info,
  Loader2,
  TableProperties,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import type {
  BulkCreateRequirementPayload,
  RequirementRecord,
  RequirementSource,
} from "@/features/requirements/types";
import { requirementKindOptions, requirementSourceLabel } from "./requirement-form";
import {
  buildBulkPasteDirectory,
  getBulkPasteErrors,
  parseBulkPasteText,
  type BulkPasteDirectoryNode,
  type BulkPasteRow,
} from "./requirement-bulk-paste";
import styles from "./requirement-bulk-paste-dialog.module.css";

export function RequirementBulkPasteDialog({
  open,
  sources,
  requirements,
  defaultSourceId,
  submitting,
  error,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  sources: RequirementSource[];
  requirements: RequirementRecord[];
  defaultSourceId: string;
  submitting: boolean;
  error: Error | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: BulkCreateRequirementPayload) => Promise<void>;
}) {
  const [sourceId, setSourceId] = useState(
    () => sources.find((source) => source.id === defaultSourceId)?.id ?? sources[0]?.id ?? "",
  );
  const [pasteText, setPasteText] = useState("");
  const [rows, setRows] = useState<BulkPasteRow[]>([]);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (!open || wasOpen) return;

    setSourceId(
      sources.find((source) => source.id === defaultSourceId)?.id ?? sources[0]?.id ?? "",
    );
    setPasteText("");
    setRows([]);
  }, [defaultSourceId, open, sources]);

  const errors = useMemo(
    () => getBulkPasteErrors(rows, requirements, sourceId),
    [rows, requirements, sourceId],
  );
  const directory = useMemo(() => buildBulkPasteDirectory(rows), [rows]);
  const selectedRows = rows.filter(
    (row) => row.included && (errors.get(row.id) ?? []).length === 0,
  );
  const skippedCount = rows.length - selectedRows.length;
  const canSubmit = sourceId !== "" && !submitting && selectedRows.length > 0;

  function parse() {
    setRows(parseBulkPasteText(pasteText));
  }

  function updateRow(rowId: string, patch: Partial<BulkPasteRow>) {
    setRows((previous) => previous.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  async function submit() {
    if (!canSubmit) return;
    try {
      await onSubmit({
        sourceVersionId: sourceId,
        items: selectedRows.flatMap((row) => {
          const primaryKind = requirementKindOptions.find(
            (option) => option.value === row.primaryKind,
          )?.value;
          if (!primaryKind) return [];

          return [
            {
              nodeType: "requirement" as const,
              chapterNumber: row.chapterNumber.trim(),
              name: row.name.trim(),
              primaryKind,
            },
          ];
        }),
      });
    } catch {
      // 保持弹窗和修正内容，由错误区域与全局提示展示失败原因。
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialog} showCloseButton={!submitting}>
        <DialogHeader>
          <DialogTitle>批量粘贴建树</DialogTitle>
          <DialogDescription>
            按“章节号 | 名称 | 主类型”粘贴；也支持 Excel 或 Word 表格复制出的 Tab 分隔内容。
          </DialogDescription>
        </DialogHeader>

        <div className={styles.sourceBar}>
          <Field>
            <FieldLabel htmlFor="bulk-paste-source">来源文档</FieldLabel>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger id="bulk-paste-source" className="h-8">
                <SelectValue placeholder="选择来源文档" />
              </SelectTrigger>
              <SelectContent>
                {sources.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    {requirementSourceLabel(source)}
                    {source.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button
            type="button"
            className={styles.parseButton}
            disabled={!pasteText.trim()}
            onClick={parse}
          >
            <TableProperties data-icon="inline-start" aria-hidden />
            解析预览
          </Button>
        </div>

        <Field>
          <div className={styles.labelRow}>
            <FieldLabel htmlFor="bulk-paste-text">粘贴内容</FieldLabel>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className={styles.labelHelp} aria-label="粘贴格式说明">
                  <Info aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">空行和疑似表头行会自动忽略。</TooltipContent>
            </Tooltip>
          </div>
          <Textarea
            id="bulk-paste-text"
            value={pasteText}
            minRows={4}
            maxRows={8}
            placeholder={"4.1 | 指令响应功能 | 功能\n4.2 | 指令准确率 | 性能"}
            onChange={(event) => setPasteText(event.target.value)}
          />
        </Field>

        <section className={styles.preview} aria-label="批量粘贴预览">
          <header className={styles.previewHeader}>
            <h4>
              <TableProperties aria-hidden />
              解析预览
            </h4>
            <span>
              将入库 {selectedRows.length} 条，跳过 {skippedCount} 条
            </span>
          </header>

          {rows.length === 0 ? (
            <p className={styles.empty}>粘贴后点击“解析预览”，确认有效行后再入库。</p>
          ) : (
            <div className={styles.previewGrid}>
              <div className={styles.tablePanel}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={styles.checkboxHead}>入库</TableHead>
                      <TableHead className={styles.lineHead}>行</TableHead>
                      <TableHead>章节号</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>主类型</TableHead>
                      <TableHead className={styles.statusHead}>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const rowErrors = errors.get(row.id) ?? [];
                      return (
                        <TableRow
                          key={row.id}
                          data-invalid={rowErrors.length > 0 ? "true" : undefined}
                        >
                          <TableCell>
                            <Checkbox
                              className={styles.rowCheck}
                              checked={row.included}
                              disabled={submitting}
                              aria-label={`将第 ${row.line} 行加入批量入库`}
                              onCheckedChange={(checked) =>
                                updateRow(row.id, { included: checked === true })
                              }
                            />
                          </TableCell>
                          <TableCell className={styles.mono}>{row.line}</TableCell>
                          <TableCell>
                            <Input
                              value={row.chapterNumber}
                              className={styles.chapterInput}
                              autoComplete="off"
                              aria-invalid={rowErrors.some((message) => message.includes("章节号"))}
                              aria-label={`第 ${row.line} 行章节号`}
                              onChange={(event) =>
                                updateRow(row.id, { chapterNumber: event.target.value })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.name}
                              className={styles.nameInput}
                              autoComplete="off"
                              aria-invalid={rowErrors.some((message) => message.includes("名称"))}
                              aria-label={`第 ${row.line} 行需求名称`}
                              onChange={(event) => updateRow(row.id, { name: event.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={row.primaryKind || undefined}
                              onValueChange={(value) =>
                                updateRow(row.id, {
                                  primaryKind: value as RequirementRecord["primaryKind"],
                                })
                              }
                            >
                              <SelectTrigger
                                className="h-8"
                                aria-label={`第 ${row.line} 行需求主类型`}
                                aria-invalid={rowErrors.some((message) =>
                                  message.includes("主类型"),
                                )}
                              >
                                <SelectValue placeholder="选择类型" />
                              </SelectTrigger>
                              <SelectContent>
                                {requirementKindOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className={styles.statusCell}>
                            {rowErrors.length > 0 ? (
                              <div className={styles.errorList}>
                                {rowErrors.map((message) => (
                                  <span key={message} className={styles.error}>
                                    {message}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <Badge variant="warning" className={styles.incompleteBadge}>
                                待补描述
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className={styles.directoryPanel}>
                <header>
                  <h4>
                    <FolderTree aria-hidden />
                    树状目录提示
                  </h4>
                  <p>提示节点不入库，也不会自动补齐整本 SRS 目录。</p>
                </header>
                <div className={styles.directoryBody}>
                  {directory.root.map((node) => (
                    <DirectoryNodeItem key={node.key} node={node} level={0} errors={errors} />
                  ))}
                  {directory.unplacedRows.map((row) => (
                    <div
                      key={`unplaced-${row.id}`}
                      className={styles.directoryRow}
                      data-invalid="true"
                    >
                      <AlertTriangle aria-hidden />
                      <span className={styles.directoryTitle}>第 {row.line} 行无法定位章节</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <p className={styles.incompleteNotice} role="note">
            批量粘贴需求全部为骨架：入库后标记“待补描述”，补全描述前不能关联测试项。
          </p>
        </section>

        {error ? (
          <div role="alert" className={styles.errorSummary}>
            批量入库失败：{error.message}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={submit}>
            {submitting ? (
              <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
            ) : (
              <ClipboardPaste data-icon="inline-start" aria-hidden />
            )}
            入库 {selectedRows.length} 条
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DirectoryNodeItem({
  node,
  level,
  errors,
}: {
  node: BulkPasteDirectoryNode;
  level: number;
  errors: Map<string, string[]>;
}) {
  const row = node.rows[0];
  const hasError = row ? (errors.get(row.id) ?? []).length > 0 : false;

  return (
    <>
      <div
        className={styles.directoryRow}
        data-level={level}
        data-kind={row ? "requirement" : "hint"}
        data-invalid={hasError ? "true" : undefined}
      >
        {row ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={styles.incompleteMarker}
                aria-label="待补描述；补全后才能关联测试项"
              >
                <AlertTriangle aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className={styles.warningTooltip}>
              待补描述；补全后才能关联测试项。
            </TooltipContent>
          </Tooltip>
        ) : (
          <FolderTree aria-hidden />
        )}
        <span className={styles.directoryChapter}>§{node.chapter}</span>
        {row ? (
          <span className={styles.directoryTitle}>{row.name}</span>
        ) : (
          <span className={styles.directoryHint}>目录提示，不入库</span>
        )}
        {node.rows.length > 1 ? (
          <Badge variant="outline" className={styles.directoryBadge}>
            +{node.rows.length - 1}
          </Badge>
        ) : null}
      </div>
      {node.children.map((child) => (
        <DirectoryNodeItem key={child.key} node={child} level={level + 1} errors={errors} />
      ))}
    </>
  );
}
