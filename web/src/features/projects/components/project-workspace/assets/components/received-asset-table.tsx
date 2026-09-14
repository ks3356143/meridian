import { Ban, Check, History, Trash2, Undo2 } from "lucide-react";
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
import {
  assetPlatformOptions,
  formatFileSize,
  getParseState,
  getWorkObjectStatusMeta,
  workObjectKindOptions,
  type AssetPlatform,
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

export function ReceivedAssetTable({
  assets,
  selectedIds,
  loading = false,
  onToggle,
  onToggleAll,
  onEdit,
  onUpdate,
  onConfirm,
  onWithdraw,
  onRevoke,
  onHistory,
  onRemove,
}: {
  assets: ReceivedWorkObject[];
  selectedIds: string[];
  loading?: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onEdit: (id: string, patch: Partial<ReceivedWorkObject>) => void;
  onUpdate: (id: string, patch: Partial<ReceivedWorkObject>) => void;
  onConfirm: (id: string) => void;
  onWithdraw: (id: string) => void;
  onRevoke: (id: string) => void;
  onHistory: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const selectableAssets = assets.filter((asset) => asset.status === "draft");
  const allSelected =
    selectableAssets.length > 0 &&
    selectableAssets.every((asset) => selectedIds.includes(asset.id));
  const someSelected = selectableAssets.some((asset) => selectedIds.includes(asset.id));

  return (
    <div className="min-w-0">
      <Table className="received-asset-table">
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
            <TableHead className="w-[19rem] min-w-[16rem] text-left">工作对象 / 原始文件</TableHead>
            <TableHead className="w-[10.5rem]">对象类型</TableHead>
            <TableHead className="w-[6.5rem]">版本</TableHead>
            <TableHead className="w-[6.5rem]">平台</TableHead>
            <TableHead className="w-[8.5rem]">提供方</TableHead>
            <TableHead className="w-[6.5rem]">解析</TableHead>
            <TableHead className="w-[6.5rem]">状态</TableHead>
            <TableHead className="w-[8.5rem]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={9} className="h-32 text-center">
                <span className="text-sm font-semibold">正在加载工作对象</span>
              </TableCell>
            </TableRow>
          ) : assets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-32 text-center">
                <div className="grid justify-center gap-1">
                  <span className="text-sm font-semibold">当前队列为空</span>
                  <span className="text-xs text-muted-foreground">上传接收文件或手工登记资料</span>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            assets.map((asset) => {
              const parseState = getParseState(asset);
              const statusMeta = getWorkObjectStatusMeta(asset.status);
              const selected = selectedIds.includes(asset.id);
              const confirmable = canConfirmAsset(asset);
              const editable = asset.status === "draft";

              return (
                <TableRow key={asset.id} data-state={selected ? "selected" : undefined}>
                  <TableCell className="p-0 text-center">
                    <Checkbox
                      aria-label={`选择 ${asset.objectName || "未命名对象"}`}
                      checked={selected}
                      disabled={asset.status !== "draft"}
                      onCheckedChange={(checked) => onToggle(asset.id, checked === true)}
                    />
                  </TableCell>
                  <TableCell className="min-w-[16rem]">
                    <div className="grid gap-1.5">
                      <Input
                        value={asset.objectName}
                        placeholder="输入对象名称"
                        aria-label="对象名称"
                        className="h-7 bg-card/70 text-xs"
                        disabled={!editable}
                        onChange={(event) => onEdit(asset.id, { objectName: event.target.value })}
                        onBlur={(event) =>
                          editable
                            ? onUpdate(asset.id, { objectName: event.target.value.trim() })
                            : undefined
                        }
                      />
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="max-w-[12rem] truncate font-mono">
                          {asset.originalName || "未绑定电子文件"}
                        </span>
                        <span className="text-border">|</span>
                        <span className="font-mono">
                          {formatFileSize(asset.fileSize, asset.hasLocalFile)}
                        </span>
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
                    <Select
                      value={asset.objectKind}
                      disabled={!editable}
                      onValueChange={(value) =>
                        onUpdate(asset.id, { objectKind: value as WorkObjectKind })
                      }
                    >
                      <SelectTrigger size="sm" aria-label={`${asset.objectName || "对象"}类型`}>
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
                  </TableCell>
                  <TableCell>
                    <Input
                      value={asset.version}
                      aria-label={`${asset.objectName || "对象"}版本`}
                      className="h-7 bg-card/70 px-2 text-center font-mono text-xs"
                      disabled={!editable}
                      onChange={(event) => onEdit(asset.id, { version: event.target.value })}
                      onBlur={(event) =>
                        editable
                          ? onUpdate(asset.id, { version: event.target.value.trim() })
                          : undefined
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Select
                      value={asset.platform}
                      disabled={!editable}
                      onValueChange={(value) =>
                        onUpdate(asset.id, { platform: value as AssetPlatform })
                      }
                    >
                      <SelectTrigger size="sm" aria-label={`${asset.objectName || "对象"}平台`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assetPlatformOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      value={asset.source}
                      aria-label={`${asset.objectName || "对象"}提供方`}
                      className="h-7 bg-card/70 text-center text-xs"
                      disabled={!editable}
                      onChange={(event) => onEdit(asset.id, { source: event.target.value })}
                      onBlur={(event) =>
                        editable
                          ? onUpdate(asset.id, { source: event.target.value.trim() })
                          : undefined
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={parseVariants[parseState.tone]}
                      className="h-5 px-1.5 text-[10px]"
                    >
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`确认 ${asset.objectName || "未命名对象"}`}
                            disabled={!confirmable}
                            onClick={() => onConfirm(asset.id)}
                          >
                            <Check aria-hidden />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>确认登记</TooltipContent>
                      </Tooltip>
                      {asset.status === "confirmed" ? (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`撤回确认 ${asset.objectName || "未命名对象"}`}
                                onClick={() => onWithdraw(asset.id)}
                              >
                                <Undo2 aria-hidden />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>撤回确认</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground hover:text-destructive"
                                aria-label={`作废 ${asset.objectName || "未命名对象"}`}
                                onClick={() => onRevoke(asset.id)}
                              >
                                <Ban aria-hidden />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>作废版本</TooltipContent>
                          </Tooltip>
                        </>
                      ) : null}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`查看生命周期 ${asset.objectName || "未命名对象"}`}
                            onClick={() => onHistory(asset.id)}
                          >
                            <History aria-hidden />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>生命周期</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`删除 ${asset.objectName || "未命名对象"}`}
                            disabled={asset.status !== "draft"}
                            onClick={() => onRemove(asset.id)}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {asset.status === "draft" ? "删除待确认登记" : "已确认对象不可直接删除"}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
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
