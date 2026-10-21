import * as React from "react";
import { cn } from "cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "input-elevated h-9 w-full min-w-0 rounded-sm border border-input bg-card/85 px-3 py-1.5 text-sm font-medium text-foreground transition-[border-color,box-shadow,background-color] duration-200 ease-[var(--ease-out-strong)] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:font-normal placeholder:text-placeholder hover:border-primary/35 focus-visible:border-ring focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:shadow-[0_0_16px_-7px_var(--ring)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/25 aria-invalid:shadow-[0_0_16px_-7px_var(--destructive)] focus-visible:aria-invalid:border-destructive focus-visible:aria-invalid:ring-destructive/30 focus-visible:aria-invalid:shadow-[0_0_18px_-7px_var(--destructive)] dark:bg-input/40 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
