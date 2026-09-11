import { useRef, useState } from "react";
import { cn } from "cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function TruncatedText({
  value,
  placeholder = "--",
  className,
}: {
  value: string;
  placeholder?: string;
  className?: string;
}) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const text = value.length > 0 ? value : placeholder;

  return (
    <Tooltip
      open={open}
      onOpenChange={(nextOpen) => {
        const element = textRef.current;
        setOpen(nextOpen && Boolean(element && element.scrollWidth > element.clientWidth));
      }}
    >
      <TooltipTrigger asChild>
        <span
          ref={textRef}
          className={cn("block max-w-full truncate", className)}
          aria-label={text}
        >
          {text}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-72 break-all">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
