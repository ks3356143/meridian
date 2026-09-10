import * as React from "react";
import { cn } from "cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "input-elevated h-8 w-full min-w-0 rounded-sm border border-input bg-card/80 px-2.5 py-1 text-base font-medium text-foreground transition-[border-color,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:font-normal placeholder:text-placeholder hover:border-primary/30 focus-visible:border-ring focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring/55 focus-visible:shadow-[0_0_18px_-5px_var(--ring)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/25 aria-invalid:shadow-[0_0_18px_-6px_var(--destructive)] focus-visible:aria-invalid:border-destructive focus-visible:aria-invalid:ring-destructive/30 focus-visible:aria-invalid:shadow-[0_0_20px_-6px_var(--destructive)] md:text-sm dark:bg-input/40 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
