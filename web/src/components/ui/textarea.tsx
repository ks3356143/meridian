import * as React from "react";
import { cn } from "cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "input-elevated border-input bg-card/80 text-foreground placeholder:text-placeholder focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/55 focus-visible:shadow-[0_0_18px_-5px_var(--ring)] dark:bg-input/40 min-h-20 w-full rounded-sm border px-2.5 py-2 text-sm font-medium outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/25",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
