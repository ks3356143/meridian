import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "./truncated-text.module.css";

export function TruncatedText({
  value,
  placeholder = "--",
  className,
  wideTooltip,
  tooltipValue,
}: {
  value: string;
  placeholder?: string;
  className?: string;
  wideTooltip?: boolean;
  /** 悬浮提示内容；缺省与列表显示内容一致（例如列表只显示摘要、悬浮看全文）。 */
  tooltipValue?: string;
}) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
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

  const handleOpenChange = (nextOpen: boolean) => {
    const element = textRef.current;
    const shouldOpen = nextOpen && Boolean(element && element.scrollWidth > element.clientWidth);
    setOpen(shouldOpen);

    if (shouldOpen) {
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

  return (
    <Tooltip open={open} onOpenChange={handleOpenChange}>
      <TooltipTrigger asChild>
        <span
          ref={textRef}
          className={cn("block max-w-full truncate", className)}
          aria-label={tooltipText}
        >
          {text}
        </span>
      </TooltipTrigger>
      {mounted ? (
        <TooltipContent
          side="top"
          className={wideTooltip ? styles.wideTooltip : styles.compactTooltip}
        >
          {tooltipText}
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}
