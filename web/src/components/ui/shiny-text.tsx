import type { CSSProperties } from "react";
import { cn } from "cn";

interface ShinyTextProps {
  text: string;
  speed?: number;
  className?: string;
}

export function ShinyText({ text, speed = 2, className }: ShinyTextProps) {
  const style: CSSProperties = { animationDuration: `${Math.max(0.1, speed)}s` };

  return (
    <span className={cn("shiny-text", className)} style={style} aria-label={text}>
      {text}
    </span>
  );
}

export default ShinyText;
