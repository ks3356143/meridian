import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { testItemsApi } from "@/features/test-items/api";
import styles from "./summary-backfill-picker.module.css";

/** 综述回填：列出测试项/子项描述，选一条整段写入用例综述。 */
export function SummaryBackfillPicker({
  itemId,
  onPick,
}: {
  itemId: string;
  /** 返回 false 表示没写入（保存中或内容相同），由本组件提示。 */
  onPick: (text: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  // 点开才拉详情；与工作台同 key，同一测试项直接命中缓存。
  const detailQuery = useQuery({
    queryKey: ["test-items", "detail", itemId],
    queryFn: () => testItemsApi.detail(itemId),
    enabled: open,
    staleTime: 30_000,
  });

  const options = useMemo(() => {
    const detail = detailQuery.data;
    if (!detail) return [];
    return [
      { key: "item", label: "总体测试项描述", text: detail.item.description },
      ...detail.subItems.map((sub) => ({
        key: sub.id,
        label: `子项${sub.seq}描述`,
        text: sub.description,
      })),
    ].filter((option) => option.text.trim() !== "");
  }, [detailQuery.data]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button type="button" className={styles.trigger} aria-label="从描述回填用例综述">
              <ClipboardPaste aria-hidden />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">从描述回填</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className={styles.content}>
        <Command>
          {detailQuery.isPending ? (
            <span className={styles.muted}>加载描述…</span>
          ) : detailQuery.isError ? (
            <span className={styles.muted}>描述加载失败，请重试</span>
          ) : (
            <>
              <CommandInput placeholder="搜索描述" />
              <CommandList className={styles.list}>
                <CommandEmpty>
                  {options.length === 0 ? "暂无选项请填写测试项描述" : "没有匹配的描述"}
                </CommandEmpty>
                <CommandGroup heading="从描述回填">
                  {options.map((option) => (
                    <CommandItem
                      key={option.key}
                      value={`${option.label} ${option.text}`}
                      className={styles.option}
                      onSelect={() => {
                        if (!onPick(option.text)) {
                          toast.error("综述未更新：内容与当前一致，或正在保存");
                          return;
                        }
                        setOpen(false);
                      }}
                    >
                      <span className={styles.optionLabel}>{option.label}</span>
                      <span className={styles.optionText}>{option.text.trim()}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
