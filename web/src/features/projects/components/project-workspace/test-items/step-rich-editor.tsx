import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  Bold as BoldIcon,
  Highlighter as HighlightIcon,
  ImagePlus,
  ListChecks,
  Redo2,
  Table2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { Gapcursor, UndoRedo } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { InlineLoading } from "@/components/shared/inline-loading";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { requirementsApi } from "@/features/requirements/api";
import { testItemsApi } from "@/features/test-items/api";
import type { StaticReviewCheck, StaticReviewSheet } from "@/features/test-items/types";
import type { RequirementBlockNode } from "@/features/requirements/types";
import { insertAfterNodeSelection } from "../requirements/body/requirement-body-editor-utils";
import {
  Bold,
  Document,
  ListItem,
  ListKeymap,
  RequirementHighlight,
  RequirementOrderedList,
  RequirementParagraph,
  RequirementPasteCleanup,
  RequirementTable,
  RequirementTableCell,
  RequirementTableHeader,
  TableRow,
  Text,
  shapePastedSlice,
} from "../requirements/body/requirement-tiptap-extensions";
import { AssetImage } from "../requirements/body/requirement-tiptap-image";
import contentStyles from "../requirements/body/requirement-body-content.module.css";
import styles from "./step-rich-cell.module.css";

const EMPTY_DOC: RequirementBlockNode = { type: "doc", content: [{ type: "paragraph" }] };

type StepRichEditorProps = {
  doc: RequirementBlockNode | null;
  /** op = 输入及操作；act = 实测结果；两者都支持表格。 */
  projectCode: string;
  /** 从展示态点击进入时的视口坐标；键盘激活时为空，光标落末尾。 */
  initialPoint?: { x: number; y: number } | null;
  /** 从展示态拖选进入时的首尾视口坐标；普通点击为空。 */
  initialRange?: {
    anchor: { x: number; y: number };
    head: { x: number; y: number };
  } | null;
  /** 工具栏退出动画期间保持编辑器挂载，动画结束后再卸载。 */
  closing?: boolean;
  /** DC 壳用例的实测结果：提供时工具栏出现「同步审查单」按钮。 */
  syncStaticItemId?: string;
  onDone: (doc: RequirementBlockNode, changed: boolean) => Promise<boolean> | boolean;
  onCancel: () => void;
};

/** 步骤单元格内联编辑器：复用需求正文的扩展集，编辑时顶部出现迷你工具栏。 */
export function StepRichEditor({
  doc,
  projectCode,
  initialPoint,
  initialRange,
  closing = false,
  syncStaticItemId,
  onDone,
  onCancel,
}: StepRichEditorProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);
  const baselineRef = useRef<string | null>(null);
  const onDoneRef = useRef(onDone);
  const onCancelRef = useRef(onCancel);
  const [syncOpen, setSyncOpen] = useState(false);
  const syncOpenRef = useRef(false);
  const [syncFails, setSyncFails] = useState<Array<{ sheet: string; check: StaticReviewCheck }>>(
    [],
  );
  const [syncSelected, setSyncSelected] = useState<Set<string>>(new Set());
  const [syncLoading, setSyncLoading] = useState(false);
  useEffect(() => {
    onDoneRef.current = onDone;
    onCancelRef.current = onCancel;
  });

  const editor = useEditor(
    {
      extensions: [
        Document,
        Text,
        RequirementParagraph,
        Bold,
        RequirementHighlight,
        UndoRedo,
        // 表格/图片独占单元格时靠 GapCursor 把光标落到块外。
        Gapcursor,
        RequirementOrderedList,
        ListItem,
        ListKeymap.configure({
          listTypes: [{ itemName: "listItem", wrapperNames: ["orderedList"] }],
        }),
        RequirementTable.configure({ resizable: false }),
        TableRow,
        RequirementTableHeader,
        RequirementTableCell,
        AssetImage.configure({
          projectCode,
          upload: (file: File) => requirementsApi.uploadAsset(projectCode, file),
        }),
        RequirementPasteCleanup,
      ],
      content: doc && (doc.content?.length ?? 0) > 0 ? doc : EMPTY_DOC,
      autofocus: false,
      editorProps: {
        attributes: {
          class: `${styles.proseMirror} ${contentStyles.surface}`,
          spellcheck: "false",
        },
        transformPasted: shapePastedSlice,
        handleKeyDown: (_view, event) => {
          if (event.key === "Escape") {
            committedRef.current = true;
            onCancelRef.current();
            return true;
          }
          return false;
        },
      },
    },
    [projectCode],
  );

  // Tiptap 的 autofocus 会调用浏览器默认聚焦并滚动外层容器；
  // 手动 focus + preventScroll，避免点开步骤时整张表突然上跳。
  // 用 layout effect 在首帧绘制前落下选区，避免展示态选区卸载后先闪一帧再恢复。
  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return;
    // 记下 Tiptap 规范化后的初始文档；仅打开/关闭不产生保存请求。
    baselineRef.current = JSON.stringify(editor.getJSON());
    // 先 focus 再写选区：反过来 focus 会把浏览器默认光标重置，出现一帧无选区。
    editor.view.dom.focus({ preventScroll: true });
    const anchor = initialRange
      ? editor.view.posAtCoords({ left: initialRange.anchor.x, top: initialRange.anchor.y })
      : null;
    const head = initialRange
      ? editor.view.posAtCoords({ left: initialRange.head.x, top: initialRange.head.y })
      : null;
    if (anchor && head) {
      editor.commands.setTextSelection({
        from: Math.min(anchor.pos, head.pos),
        to: Math.max(anchor.pos, head.pos),
      });
    } else {
      const clicked = initialPoint
        ? editor.view.posAtCoords({ left: initialPoint.x, top: initialPoint.y })
        : null;
      editor.commands.setTextSelection(clicked?.pos ?? editor.state.doc.content.size);
    }
  }, [editor, initialPoint, initialRange]);

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      highlight: current.isActive("highlight"),

      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });

  const commit = async () => {
    if (!editor || editor.isDestroyed || committedRef.current) return;
    committedRef.current = true;
    const doc = editor.getJSON() as RequirementBlockNode;
    const changed = baselineRef.current !== JSON.stringify(doc);
    const closed = await onDoneRef.current(doc, changed);
    if (!closed) committedRef.current = false;
  };

  // 焦点移出编辑器+工具栏整体才算完成（工具栏按钮用 mousedown preventDefault 不夺焦，这里是兜底）。
  // 提交延迟到 click 派发之后：blur 会立刻把上一格从编辑态切回展示态（行高微变），
  // 若同步重排，本次点击的 mouseup 可能落空、邻格要点两次才进编辑。
  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    // 「同步审查单」对话框打开期间保持编辑器挂载，否则对话框会随编辑器一起卸载。
    if (syncOpenRef.current) return;
    const next = event.relatedTarget as Node | null;
    if (next && wrapRef.current?.contains(next)) return;
    window.setTimeout(() => void commit(), 0);
  };

  const handleImageChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !editor || editor.isDestroyed) return;
    try {
      const asset = await requirementsApi.uploadAsset(projectCode, file);
      if (editor.isDestroyed) return;
      insertAfterNodeSelection(editor)
        .insertContent({
          type: "assetImage",
          attrs: {
            assetId: asset.id,
            alt: null,
            width: `${asset.width}px`,
            height: `${asset.height}px`,
          },
        })
        .run();
    } catch {
      toast.error("图片上传失败，请重试");
    }
  };

  return (
    <div
      ref={wrapRef}
      className={styles.editorWrap}
      data-closing={closing ? "true" : undefined}
      onBlur={handleBlur}
    >
      <div
        className={styles.toolbar}
        data-closing={closing ? "true" : undefined}
        role="toolbar"
        aria-label="步骤格式工具栏"
      >
        <ToolButton
          label="撤销"
          disabled={!state?.canUndo}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 aria-hidden />
        </ToolButton>
        <ToolButton
          label="重做"
          disabled={!state?.canRedo}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 aria-hidden />
        </ToolButton>
        <span className={styles.toolDivider} aria-hidden />
        <ToolButton
          label="粗体"
          active={state?.bold}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <BoldIcon aria-hidden />
        </ToolButton>
        <ToolButton
          label="高亮"
          active={state?.highlight}
          onClick={() => editor?.chain().focus().toggleHighlight().run()}
        >
          <HighlightIcon aria-hidden />
        </ToolButton>

        {syncStaticItemId ? (
          <ToolButton
            label="同步审查单"
            onClick={() => {
              syncOpenRef.current = true;
              setSyncOpen(true);
              setSyncLoading(true);
              void testItemsApi
                .staticWorkbench(syncStaticItemId)
                .then((workbench) => {
                  const fails: Array<{ sheet: string; check: StaticReviewCheck }> = [];
                  for (const sheet of workbench.state.reviewSheets as StaticReviewSheet[]) {
                    for (const check of sheet.checks) {
                      if (check.result === "failed") fails.push({ sheet: sheet.name, check });
                    }
                  }
                  setSyncFails(fails);
                  setSyncSelected(new Set(fails.map((item) => item.check.id)));
                })
                .catch(() => toast.error("读取审查单失败"))
                .finally(() => setSyncLoading(false));
            }}
          >
            <ListChecks aria-hidden />
          </ToolButton>
        ) : null}
        <ToolButton label="插入图片" onClick={() => imageInputRef.current?.click()}>
          <ImagePlus aria-hidden />
        </ToolButton>
        <ToolButton
          label="插入表格"
          onClick={() =>
            editor?.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()
          }
        >
          <Table2 aria-hidden />
        </ToolButton>
      </div>
      <EditorContent editor={editor} className={styles.editorContent} />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => void handleImageChosen(event)}
      />
      <Dialog
        open={syncOpen}
        onOpenChange={(open) => {
          setSyncOpen(open);
          if (!open) syncOpenRef.current = false;
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>同步审查单不通过项</DialogTitle>
            <DialogDescription>
              选择要带入当前步骤的检查项，文字与截图会插入实际结果。
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {syncLoading ? <InlineLoading className="text-xs" label="正在读取审查单" /> : null}
            {!syncLoading && syncFails.length === 0 ? (
              <p className="text-muted-foreground text-xs">当前没有不通过项。</p>
            ) : null}
            {syncFails.map(({ sheet, check }) => (
              <label
                key={check.id}
                className="hover:bg-muted/50 flex items-start gap-2 rounded-sm px-1 py-1 text-xs"
              >
                <Checkbox
                  checked={syncSelected.has(check.id)}
                  onCheckedChange={(value) =>
                    setSyncSelected((current) => {
                      const next = new Set(current);
                      if (value === true) next.add(check.id);
                      else next.delete(check.id);
                      return next;
                    })
                  }
                />
                <span className="min-w-0">
                  <strong className="block truncate">{check.title}</strong>
                  <span className="text-muted-foreground block truncate">
                    {sheet} · {check.notes || check.previousNote || "未填写错误描述"}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                syncOpenRef.current = false;
                setSyncOpen(false);
              }}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={!syncSelected.size}
              onClick={() => {
                const nodes = syncFails
                  .filter(({ check }) => syncSelected.has(check.id))
                  .flatMap(({ sheet, check }) => {
                    const text = `【${sheet}】${check.title}：${check.notes || check.previousNote || "未通过"}`;
                    const blocks: unknown[] = [
                      { type: "paragraph", content: [{ type: "text", text }] },
                    ];
                    for (const assetId of check.images ?? []) {
                      blocks.push({ type: "assetImage", attrs: { assetId, alt: "审查截图" } });
                    }
                    return blocks;
                  });
                editor
                  ?.chain()
                  .focus()
                  .insertContent(nodes as never)
                  .run();
                syncOpenRef.current = false;
                setSyncOpen(false);
              }}
            >
              带入选中项
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={styles.toolButtonWrap}>
          <button
            type="button"
            className={styles.toolButton}
            data-active={active ? "true" : undefined}
            disabled={disabled}
            aria-label={label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
          >
            {children}
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
