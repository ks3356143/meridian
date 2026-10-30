import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "./truncated-text.module.css";

export function TruncatedText({
  value,
  placeholder = "--",
  className,
  tooltipValue,
}: {
  value: string;
  placeholder?: string;
  className?: string;
  /** 悬浮提示内容；缺省与列表显示内容一致（例如列表只显示摘要、悬浮看全文）。 */
  tooltipValue?: string;
}) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const text = value.length > 0 ? value : placeholder;
  const tooltipText = tooltipValue && tooltipValue.length > 0 ? tooltipValue : text;

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    },
    [],
  );

  const showIfTruncated = () => {
    const element = textRef.current;
    if (!element) return;

    // 首次挂载不扫描整页文本。只有用户真正指向或聚焦某个单元格时才读取一次，
    // 避免树和表格同时出现几十上百个截断文本时形成强制布局长任务。
    const nextTruncated = element.scrollWidth > element.clientWidth + 2;
    if (!nextTruncated) {
      setTruncated(false);
      return;
    }

    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setTruncated(true);
    setOpen(true);
  };

  const hideTooltip = () => {
    setOpen(false);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setTruncated(false);
      closeTimerRef.current = null;
    }, 140);
  };

  const label = (
    <span
      ref={textRef}
      className={cn("block max-w-full truncate", className)}
      aria-label={tooltipText}
      title={truncated ? undefined : tooltipText}
      onPointerEnter={showIfTruncated}
      onPointerLeave={hideTooltip}
      onFocus={showIfTruncated}
      onBlur={hideTooltip}
    >
      {text}
    </span>
  );

  if (!truncated) return label;

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>{label}</TooltipTrigger>
      <TooltipContent side="top" className={styles.compactTooltip}>
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}
