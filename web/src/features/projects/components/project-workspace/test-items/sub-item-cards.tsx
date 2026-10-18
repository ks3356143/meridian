import { memo, useCallback, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy, CopyPlus, GripVertical, ListOrdered, ListPlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyHint } from "@/components/shared/empty-hint";
import type { UpdateSubItemPayload } from "@/features/test-items/api";
import type { TestSubItemRecord } from "@/features/test-items/types";
import { EditableCell, type EditableCellHandle } from "./editable-cell";
import styles from "./sub-item-cards.module.css";

const BAR_TONES = ["green", "blue", "amber", "violet", "cyan"] as const;

function subItemIdentifier(itemIdentifier: string, seq: number) {
  return `${itemIdentifier}_${String(seq).padStart(3, "0")}`;
}

/** 测试方法（子项卡片）：拖拽排序、行内编辑、复制/删除、1:1 生成用例。 */
export const SubItemCards = memo(function SubItemCardsImpl({
  itemIdentifier,
  subItems,
  onCreate,
  onUpdate,
  onDelete,
  onDuplicate,
  onMove,
  onGenerateCase,
  onPhase,
}: {
  itemIdentifier: string;
  subItems: TestSubItemRecord[];
  onCreate: (name: string) => Promise<unknown>;
  onUpdate: (id: string, payload: UpdateSubItemPayload) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onDuplicate: (id: string) => Promise<unknown>;
  onMove: (id: string, targetIndex: number) => Promise<unknown>;
  onGenerateCase: (name: string) => Promise<unknown>;
  /** 上报子项编辑/保存相位，供详情右上角自动保存状态芯片显示。 */
  onPhase?: (phase: "editing-start" | "editing-end" | "saving" | "saved" | "error") => void;
}) {
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const from = subItems.findIndex((sub) => sub.id === active.id);
      const to = subItems.findIndex((sub) => sub.id === over.id);
      if (from < 0 || to < 0) return;
      const nextOrder = arrayMove(subItems, from, to);
      const targetIndex = nextOrder.findIndex((sub) => sub.id === active.id);
      void onMove(String(active.id), targetIndex);
    },
    [onMove, subItems],
  );

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      // 空名新建：卡片直接进入待填状态（红色脉冲），由用户当场命名。
      await onCreate("");
    } finally {
      setCreating(false);
    }
  }, [onCreate]);

  const handleGenerate = useCallback(
    async (sub: TestSubItemRecord) => {
      if (sub.name.trim() === "") {
        toast.error("请先填写子项名称，再生成用例");
        return;
      }
      setPendingId(sub.id);
      try {
        await onGenerateCase(sub.name.trim());
      } finally {
        setPendingId("");
      }
    },
    [onGenerateCase],
  );

  return (
    <div className={styles.wrap}>
      {subItems.length === 0 ? (
        <EmptyHint
          tone="amber"
          action={
            <Button type="button" size="xs" onClick={() => void handleCreate()} disabled={creating}>
              <Plus aria-hidden />
              新增子项
            </Button>
          }
        >
          还没有子项。测试方法按子项拆分录入，子项可 1:1 生成用例。
        </EmptyHint>
      ) : (
        <>
          <div className={styles.toolbar}>
            <span className={styles.count}>{`共 ${subItems.length} 个子项`}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className={styles.toolButton}
                  onClick={() => {
                    const last = subItems[subItems.length - 1];
                    if (last) void onDuplicate(last.id);
                  }}
                >
                  <CopyPlus aria-hidden />
                  从上个复制
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">复制最后一个子项为新卡片，再改内容</TooltipContent>
            </Tooltip>
            <Button type="button" size="xs" onClick={() => void handleCreate()} disabled={creating}>
              <Plus aria-hidden />
              新增子项
            </Button>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={subItems.map((sub) => sub.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className={styles.list}>
                {subItems.map((sub, index) => (
                  <SortableCard
                    key={sub.id}
                    id={sub.id}
                    index={index}
                    identifier={subItemIdentifier(itemIdentifier, sub.seq)}
                    sub={sub}
                    generating={pendingId === sub.id}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    onGenerate={handleGenerate}
                    onPhase={onPhase}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
});

const SortableCard = memo(function SortableCardImpl({
  id,
  index,
  identifier,
  sub,
  generating,
  onUpdate,
  onDelete,
  onDuplicate,
  onGenerate,
  onPhase,
}: {
  id: string;
  index: number;
  identifier: string;
  sub: TestSubItemRecord;
  generating: boolean;
  onUpdate: (id: string, payload: UpdateSubItemPayload) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onDuplicate: (id: string) => Promise<unknown>;
  onGenerate: (sub: TestSubItemRecord) => void;
  onPhase?: (phase: "editing-start" | "editing-end" | "saving" | "saved" | "error") => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const opsCellRef = useRef<EditableCellHandle>(null);
  const expectedCellRef = useRef<EditableCellHandle>(null);

  return (
    <div
      ref={setNodeRef}
      className={styles.card}
      data-tone={BAR_TONES[index % BAR_TONES.length]}
      data-dragging={isDragging ? "true" : undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <span className={styles.bar} aria-hidden />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={styles.handle}
            aria-label="拖动排序（空格拿起，方向键移动）"
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">拖动排序（空格拿起，方向键移动）</TooltipContent>
      </Tooltip>

      <div className={styles.body}>
        <div className={styles.head}>
          <span className={styles.ident}>{identifier}</span>
          <div className={styles.nameCell}>
            <EditableCell
              value={sub.name}
              label="子项名称"
              placeholder="点击填写子项名称"
              bordered
              missing={sub.name.trim() === ""}
              onSave={(next) => onUpdate(id, { name: next })}
              onPhase={onPhase}
            />
          </div>
          <div className={styles.actions}>
            <Button
              type="button"
              size="xs"
              variant="outline"
              className={styles.generateButton}
              disabled={generating}
              onClick={() => void onGenerate(sub)}
            >
              <ListPlus aria-hidden />
              生成用例
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className={styles.iconButton}
                  aria-label="复制子项"
                  onClick={() => void onDuplicate(id)}
                >
                  <Copy aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">复制为新的子项</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className={styles.iconButton}
                  data-variant="danger"
                  aria-label="删除子项"
                  onClick={() => void onDelete(id)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">删除子项</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className={styles.descCol}>
          <span className={styles.fieldLabel}>测试子项描述</span>
          <EditableCell
            value={sub.description}
            label="子项描述"
            placeholder="点击填写子项描述（可留空）"
            bordered
            multiline
            onSave={(next) => onUpdate(id, { description: next })}
            onPhase={onPhase}
          />
        </div>
        <div className={styles.stepsRow}>
          <div className={styles.stepsCol}>
            <div className={styles.fieldLabelRow}>
              <span className={styles.fieldLabel}>操作步骤</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={styles.numberButton}
                    aria-label="操作步骤自动编号"
                    onMouseDown={(event) => {
                      // mousedown 阶段拦截：不让编辑框失焦，避免和失焦保存竞态。
                      event.preventDefault();
                      opsCellRef.current?.applyNumbering();
                    }}
                    onClick={(event) => {
                      if (event.detail === 0) opsCellRef.current?.applyNumbering();
                    }}
                  >
                    <ListOrdered aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">自动编号</TooltipContent>
              </Tooltip>
            </div>
            <EditableCell
              ref={opsCellRef}
              value={sub.ops}
              label="操作步骤"
              placeholder="1、请在此录入..."
              bordered
              multiline
              missing={sub.ops.trim() === ""}
              onSave={(next) => onUpdate(id, { ops: next })}
              onPhase={onPhase}
            />
          </div>
          <div className={styles.stepsCol}>
            <div className={styles.fieldLabelRow}>
              <span className={styles.fieldLabel}>通过准则</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={styles.numberButton}
                    aria-label="通过准则自动编号"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      expectedCellRef.current?.applyNumbering();
                    }}
                    onClick={(event) => {
                      if (event.detail === 0) expectedCellRef.current?.applyNumbering();
                    }}
                  >
                    <ListOrdered aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">自动编号</TooltipContent>
              </Tooltip>
            </div>
            <EditableCell
              ref={expectedCellRef}
              value={sub.expected}
              label="通过准则"
              placeholder="1、预期结果..."
              bordered
              multiline
              missing={sub.expected.trim() === ""}
              onSave={(next) => onUpdate(id, { expected: next })}
              onPhase={onPhase}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
