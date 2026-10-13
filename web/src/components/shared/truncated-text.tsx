import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const [mounted, setMounted] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const text = value.length > 0 ? value : placeholder;
  const tooltipText = tooltipValue && tooltipValue.length > 0 ? tooltipValue : text;

  // 只有真实溢出才挂 Tooltip：虚拟列表里每行一个 Radix 根节点是纯开销（32 行 ≈ 一帧 30ms）。
  // 口径来源：frontend srs 07/01「只有真实溢出时用 Radix Tooltip 展示全文」。
  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element) return;
    // 2px 滞回：判断值卡在边界时来回切换会反复重建 DOM 节点，加一点余量把状态钉住。
    const measure = () =>
      setTruncated((previous) =>
        previous
          ? element.scrollWidth > element.clientWidth
          : element.scrollWidth > element.clientWidth + 2,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, truncated, value]);

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    },
    [],
  );

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (nextOpen) {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setMounted(true);
      return;
    }

    if (!mounted) return;
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      closeTimerRef.current = null;
    }, 140);
  };

  const label = (
    <span
      ref={textRef}
      className={cn("block max-w-full truncate", className)}
      aria-label={tooltipText}
    >
      {text}
    </span>
  );

  if (!truncated) return label;

  return (
    <Tooltip open={open} onOpenChange={handleOpenChange}>
      <TooltipTrigger asChild>{label}</TooltipTrigger>
      {mounted ? (
        <TooltipContent side="top" className={styles.compactTooltip}>
          {tooltipText}
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}
