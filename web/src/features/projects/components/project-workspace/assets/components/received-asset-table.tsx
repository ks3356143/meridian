import { useVirtualizer } from "@tanstack/react-virtual";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Ban,
  Check,
  History,
  Inbox,
  PencilLine,
  RotateCcw,
  SearchX,
  Trash2,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { TruncatedText } from "@/components/shared/truncated-text";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./received-asset-table.module.css";
import {
  formatFileSize,
  getParseState,
  getWorkObjectStatusMeta,
  workObjectKindOptions,
  type ReceivedWorkObject,
  type WorkObjectKind,
} from "../received-asset-model";

const parseVariants = {
  ready: "default",
  convert: "warning",
  code: "secondary",
  table: "outline",
  register: "outline",
} as const;

const staticFieldClass =
  "h-7 cursor-not-allowed rounded-sm border border-input bg-input/50 px-2 text-xs leading-7 opacity-70 dark:bg-input/80";
const ASSET_ROW_ESTIMATE = 76;
const ASSET_ROW_OVERSCAN = 1;
const ASSET_INITIAL_RENDERED_ROWS = 1;
const ASSET_RENDERED_ROW_CHUNK = 1;

type ReceivedAssetRowProps = {
  asset: ReceivedWorkObject;
  draftPatch?: Partial<ReceivedWorkObject>;
  selected: boolean;
  rowIndex: number;
  rowRef: (node: HTMLTableRowElement | null) => void;
  onToggle: (id: string, checked: boolean) => void;
  onEdit: (id: string, patch: Partial<ReceivedWorkObject>) => void;
  onUpdate: (id: string, patch: Partial<ReceivedWorkObject>) => void;
  onConfirm: (id: string) => void;
  onCorrect: (id: string) => void;
  onWithdraw: (id: string) => void;
  onRevoke: (id: string) => void;
  onHistory: (id: string) => void;
  onRemove: (id: string) => void;
};

const ReceivedAssetRow = memo(function ReceivedAssetRow({
  asset,
  draftPatch,
  selected,
  rowIndex,
  rowRef,
  onToggle,
  onEdit,
  onUpdate,
  onConfirm,
  onCorrect,
  onWithdraw,
  onRevoke,
  onHistory,
  onRemove,
}: ReceivedAssetRowProps) {
  const value: ReceivedWorkObject = {
    ...asset,
    objectKind: draftPatch?.objectKind ?? asset.objectKind,
    objectName: draftPatch?.objectName ?? asset.objectName,
    version: draftPatch?.version ?? asset.version,
    source: draftPatch?.source ?? asset.source,
  };
  const parseState = getParseState(value);
  const statusMeta = getWorkObjectStatusMeta(asset.status);
  const confirmable = canConfirmAsset(value);
  const editable = asset.status === "draft";
  const objectKindLabel =
    workObjectKindOptions.find((option) => option.value === value.objectKind)?.label ??
    value.objectKind;
  return (
    <TableRow
      ref={rowRef}
      data-index={rowIndex}
      aria-rowindex={rowIndex + 2}
      data-state={selected ? "selected" : undefined}
    >
      <TableCell className="p-0 text-center">
        <Checkbox
          aria-label={`选择 ${value.objectName || "未命名对象"}`}
          checked={selected}
          disabled={!editable}
          onCheckedChange={(checked) => onToggle(asset.id, checked === true)}
        />
      </TableCell>
      <TableCell className="min-w-[16rem]">
        <div className="grid gap-1.5">
          {editable ? (
            <Input
              value={value.objectName}
              placeholder="输入对象名称"
              aria-label="对象名称"
              className="h-7 bg-card/70 text-xs"
              onChange={(event) => onEdit(asset.id, { objectName: event.target.value })}
              onBlur={(event) => onUpdate(asset.id, { objectName: event.target.value.trim() })}
            />
          ) : (
            <TruncatedText value={value.objectName} className={staticFieldClass} />
          )}
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <TruncatedText
              value={asset.originalName || "未绑定电子文件"}
              className="max-w-[12rem] font-mono"
            />
            <span className="text-border">|</span>
            <span className="font-mono">{formatFileSize(asset.fileSize, asset.hasLocalFile)}</span>
            {asset.hasLocalFile ? (
              <>
                <span className="text-border">|</span>
                <span className="font-mono uppercase">{asset.fileType || "未知"}</span>
              </>
            ) : null}
          </div>
        </div>
      </TableCell>
      <TableCell>
        {editable ? (
          <Select
            value={value.objectKind}
            onValueChange={(nextValue) =>
              onUpdate(asset.id, { objectKind: nextValue as WorkObjectKind })
            }
          >
            <SelectTrigger size="sm" aria-label={`${value.objectName || "对象"}类型`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {workObjectKindOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <TruncatedText value={objectKindLabel} className={staticFieldClass} />
        )}
      </TableCell>
      <TableCell>
        {editable ? (
          <Input
            value={value.version}
            aria-label={`${value.objectName || "对象"}版本`}
            className="h-7 bg-card/70 px-2 text-center font-mono text-xs"
            onChange={(event) => onEdit(asset.id, { version: event.target.value })}
            onBlur={(event) => onUpdate(asset.id, { version: event.target.value.trim() })}
          />
        ) : (
          <TruncatedText
            value={value.version}
            className={`${staticFieldClass} text-center font-mono`}
          />
        )}
      </TableCell>
      <TableCell className="text-center">
        {editable ? (
          <Input
            value={value.source}
            aria-label={`${value.objectName || "对象"}提供方`}
            className="h-7 bg-card/70 text-center text-xs"
            onChange={(event) => onEdit(asset.id, { source: event.target.value })}
            onBlur={(event) => onUpdate(asset.id, { source: event.target.value.trim() })}
          />
        ) : (
          <TruncatedText value={value.source} className={`${staticFieldClass} text-center`} />
        )}
      </TableCell>
      <TableCell className="text-center">
        <Badge variant={parseVariants[parseState.tone]} className="h-5 px-1.5 text-[10px]">
          {parseState.label}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant={statusMeta.badgeVariant} className="h-5 px-1.5 text-[10px]">
          {statusMeta.label}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex justify-center gap-1">
          <ReceivedAssetActionButton
            icon={Check}
            action={
              confirmable
                ? "确认登记"
                : asset.status === "draft"
                  ? "请补齐名称、版本和提供方后再确认"
                  : "当前状态不可确认"
            }
            label={`确认 ${value.objectName || "未命名对象"}`}
            disabled={!confirmable}
            onClick={() => onConfirm(asset.id)}
          />
          {asset.status === "confirmed" ? (
            <>
              <ReceivedAssetActionButton
                icon={PencilLine}
                action="登记纠错"
                label={`登记纠错 ${value.objectName || "未命名对象"}`}
                onClick={() => onCorrect(asset.id)}
              />
              <ReceivedAssetActionButton
                icon={Undo2}
                action="撤回确认"
                label={`撤回确认 ${value.objectName || "未命名对象"}`}
                onClick={() => onWithdraw(asset.id)}
              />
              <ReceivedAssetActionButton
                icon={Ban}
                action="作废版本"
                label={`作废 ${value.objectName || "未命名对象"}`}
                destructive
                onClick={() => onRevoke(asset.id)}
              />
            </>
          ) : null}
          <ReceivedAssetActionButton
            icon={History}
            action="生命周期"
            label={`查看生命周期 ${value.objectName || "未命名对象"}`}
            onClick={() => onHistory(asset.id)}
          />
          <ReceivedAssetActionButton
            icon={Trash2}
            action={editable ? "删除待确认登记" : "已确认对象不可直接删除"}
            label={`删除 ${value.objectName || "未命名对象"}`}
            destructive
            disabled={!editable}
            onClick={() => onRemove(asset.id)}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}, areReceivedAssetRowPropsEqual);

function ReceivedAssetActionButton({
  icon: Icon,
  action,
  label,
  destructive = false,
  disabled = false,
  onClick,
}: {
  icon: LucideIcon;
  action: string;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const buttonClassName = [
    destructive
      ? "text-destructive hover:border-destructive/40 hover:bg-destructive/8 hover:text-destructive"
      : undefined,
    disabled ? styles.disabledButton : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  const button = (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className={buttonClassName}
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
    >
      <Icon aria-hidden />
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{action}</TooltipContent>
    </Tooltip>
  );
}

function areReceivedAssetRowPropsEqual(
  previous: ReceivedAssetRowProps,
  next: ReceivedAssetRowProps,
) {
  const previousValue = {
    ...previous.asset,
    ...previous.draftPatch,
  };
  const nextValue = {
    ...next.asset,
    ...next.draftPatch,
  };

  return (
    previous.selected === next.selected &&
    previous.rowIndex === next.rowIndex &&
    previous.rowRef === next.rowRef &&
    previous.asset.status === next.asset.status &&
    previousValue.objectKind === nextValue.objectKind &&
    previousValue.objectName === nextValue.objectName &&
    previousValue.version === nextValue.version &&
    previousValue.source === nextValue.source &&
    previous.asset.originalName === next.asset.originalName &&
    previous.asset.fileSize === next.asset.fileSize &&
    previous.asset.fileType === next.asset.fileType &&
    previous.asset.hasLocalFile === next.asset.hasLocalFile
  );
}

function ReceivedAssetTableImpl({
  assets,
  draftPatches,
  selectedIds,
  loading = false,
  error,
  onRetry,
  emptyTitle = "当前队列为空",
  emptyDescription = "上传接收文件或手工登记资料",
  searchActive = false,
  onClearSearch,
  onToggle,
  onToggleAll,
  onEdit,
  onUpdate,
  onConfirm,
  onCorrect,
  onWithdraw,
  onRevoke,
  onHistory,
  onRemove,
}: {
  assets: ReceivedWorkObject[];
  draftPatches: Record<string, Partial<ReceivedWorkObject>>;
  selectedIds: string[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  searchActive?: boolean;
  onClearSearch?: () => void;
  onToggle: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onEdit: (id: string, patch: Partial<ReceivedWorkObject>) => void;
  onUpdate: (id: string, patch: Partial<ReceivedWorkObject>) => void;
  onConfirm: (id: string) => void;
  onCorrect: (id: string) => void;
  onWithdraw: (id: string) => void;
  onRevoke: (id: string) => void;
  onHistory: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [renderBudget, setRenderBudget] = useState(ASSET_INITIAL_RENDERED_ROWS);
  // TanStack Virtual 返回的对象不适合 React Compiler 记忆化，官方用法要求绕过该规则。
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useVirtualizer({
    count: assets.length,
    getScrollElement: () => tableRef.current?.closest<HTMLElement>("main.workspace-route") ?? null,
    estimateSize: () => ASSET_ROW_ESTIMATE,
    overscan: ASSET_ROW_OVERSCAN,
    scrollMargin,
    getItemKey: (index) => assets[index]?.id ?? index,
    enabled: !loading && !error && assets.length > 0,
  });

  const measureScrollMargin = useCallback(() => {
    const table = tableRef.current;
    const scrollElement = table?.closest<HTMLElement>("main.workspace-route");
    if (!table || !scrollElement) return;
    const nextScrollMargin =
      table.getBoundingClientRect().top -
      scrollElement.getBoundingClientRect().top +
      scrollElement.scrollTop;
    setScrollMargin((current) =>
      Math.abs(current - nextScrollMargin) < 1 ? current : nextScrollMargin,
    );
  }, []);

  useEffect(() => {
    setRenderBudget(ASSET_INITIAL_RENDERED_ROWS);
  }, [assets.length]);

  useLayoutEffect(() => {
    measureScrollMargin();
    const table = tableRef.current;
    const scrollElement = table?.closest<HTMLElement>("main.workspace-route");
    if (!table || !scrollElement) return;
    const observer = new ResizeObserver(measureScrollMargin);
    observer.observe(table);
    observer.observe(scrollElement);
    window.addEventListener("resize", measureScrollMargin);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measureScrollMargin);
    };
  }, [assets.length, measureScrollMargin]);

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    if (renderBudget >= virtualItems.length) return;
    const frame = window.requestAnimationFrame(() => {
      setRenderBudget((current) =>
        Math.min(virtualItems.length, current + ASSET_RENDERED_ROW_CHUNK),
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [renderBudget, virtualItems.length]);

  if (loading) {
    return <ReceivedAssetTableLoading />;
  }

  if (error) {
    return (
      <ReceivedAssetTableState
        tone="error"
        icon={AlertTriangle}
        title="工作对象加载失败"
        description={error}
        action={
          onRetry ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              <RotateCcw data-icon="inline-start" aria-hidden />
              重新加载
            </Button>
          ) : undefined
        }
      />
    );
  }

  if (!assets.length) {
    return (
      <ReceivedAssetTableState
        tone={searchActive ? "search" : "empty"}
        icon={searchActive ? SearchX : Inbox}
        title={emptyTitle}
        description={emptyDescription}
        action={
          searchActive && onClearSearch ? (
            <Button type="button" variant="outline" size="sm" onClick={onClearSearch}>
              清除搜索
            </Button>
          ) : undefined
        }
      />
    );
  }

  const selectableAssets = assets.filter((asset) => asset.status === "draft");
  const allSelected =
    selectableAssets.length > 0 &&
    selectableAssets.every((asset) => selectedIds.includes(asset.id));
  const someSelected = selectableAssets.some((asset) => selectedIds.includes(asset.id));
  const renderedVirtualItems = virtualItems.slice(0, renderBudget);
  const firstVirtualItem = renderedVirtualItems[0];
  const lastVirtualItem = renderedVirtualItems[renderedVirtualItems.length - 1];
  const topSpacer = firstVirtualItem ? Math.max(0, firstVirtualItem.start - scrollMargin) : 0;
  const bottomSpacer = lastVirtualItem
    ? Math.max(
        0,
        virtualizer.getTotalSize() - (lastVirtualItem.start + lastVirtualItem.size - scrollMargin),
      )
    : 0;

  return (
    <div ref={tableRef} className="min-w-0">
      <Table className="received-asset-table" aria-rowcount={assets.length + 1}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                aria-label="选择当前列表全部待确认对象"
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                disabled={!selectableAssets.length}
                onCheckedChange={(checked) => onToggleAll(checked === true)}
              />
            </TableHead>
            <TableHead className="w-[19rem] min-w-[16rem]">工作对象 / 原始文件</TableHead>
            <TableHead className="w-[10.5rem]">对象类型</TableHead>
            <TableHead className="w-[6.5rem]">版本</TableHead>
            <TableHead className="w-[8.5rem]">提供方</TableHead>
            <TableHead className="w-[6.5rem]">解析</TableHead>
            <TableHead className="w-[6.5rem]">状态</TableHead>
            <TableHead className="w-[12.5rem]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {topSpacer > 0 ? (
            <TableRow aria-hidden className={styles.virtualSpacer}>
              <TableCell colSpan={8} style={{ height: topSpacer }} />
            </TableRow>
          ) : null}
          {renderedVirtualItems.map((virtualItem) => {
            const asset = assets[virtualItem.index];
            if (!asset) return null;
            return (
              <ReceivedAssetRow
                key={asset.id}
                asset={asset}
                draftPatch={draftPatches[asset.id]}
                selected={selectedIds.includes(asset.id)}
                rowIndex={virtualItem.index}
                rowRef={virtualizer.measureElement}
                onToggle={onToggle}
                onEdit={onEdit}
                onUpdate={onUpdate}
                onConfirm={onConfirm}
                onCorrect={onCorrect}
                onWithdraw={onWithdraw}
                onRevoke={onRevoke}
                onHistory={onHistory}
                onRemove={onRemove}
              />
            );
          })}
          {bottomSpacer > 0 ? (
            <TableRow aria-hidden className={styles.virtualSpacer}>
              <TableCell colSpan={8} style={{ height: bottomSpacer }} />
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

function ReceivedAssetTableLoading() {
  return (
    <div className={styles.stateShell} aria-busy="true" aria-live="polite">
      <span className="sr-only">正在加载工作对象</span>
      <div className={styles.skeletonRows} aria-hidden>
        {[0, 1, 2].map((row) => (
          <div key={row} className={styles.skeletonRow}>
            <Skeleton className={styles.skeletonPrimary} />
            <Skeleton className={styles.skeletonCell} />
            <Skeleton className={styles.skeletonCell} />
            <Skeleton className={styles.skeletonCell} />
            <Skeleton className={styles.skeletonCell} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReceivedAssetTableState({
  tone,
  icon: Icon,
  title,
  description,
  action,
}: {
  tone: "empty" | "search" | "error";
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={styles.stateShell}
      data-tone={tone}
      role={tone === "error" ? "alert" : "status"}
    >
      <div className={styles.stateContent}>
        <span className={styles.stateIcon} aria-hidden>
          <Icon />
        </span>
        <div className={styles.stateCopy}>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        {action ? <div className={styles.stateAction}>{action}</div> : null}
      </div>
    </div>
  );
}

function canConfirmAsset(asset: ReceivedWorkObject): boolean {
  return (
    asset.status === "draft" &&
    Boolean(asset.objectName.trim()) &&
    Boolean(asset.version.trim()) &&
    Boolean(asset.source.trim())
  );
}
// 行/表比较器只比较渲染输出字段；所有传入回调必须保持稳定引用（当前均来自 useCallback 或稳定 mutation 方法）。
function areReceivedAssetTablePropsEqual(
  previous: Parameters<typeof ReceivedAssetTableImpl>[0],
  next: Parameters<typeof ReceivedAssetTableImpl>[0],
) {
  return (
    previous.assets === next.assets &&
    previous.draftPatches === next.draftPatches &&
    previous.selectedIds === next.selectedIds &&
    previous.loading === next.loading &&
    previous.error === next.error &&
    previous.emptyTitle === next.emptyTitle &&
    previous.emptyDescription === next.emptyDescription &&
    previous.searchActive === next.searchActive
  );
}

export const ReceivedAssetTable = memo(ReceivedAssetTableImpl, areReceivedAssetTablePropsEqual);
