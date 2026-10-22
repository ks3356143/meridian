import * as React from "react";
import { CheckIcon } from "lucide-react";
import * as CheckboxPrimitive from "radix-ui/checkbox";
import { cn } from "cn";

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "input-elevated size-4 shrink-0 rounded-[3px] border border-input bg-card/85 transition-[color,border-color,background-color,box-shadow,transform] duration-200 ease-[var(--ease-out-strong)] outline-none hover:border-primary/40 hover:bg-card hover:shadow-[0_2px_8px_-4px_color-mix(in_oklch,var(--primary)_55%,transparent)] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground active:scale-95 dark:bg-input/40 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:text-primary-foreground",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex animate-in items-center justify-center text-current fade-in-0 zoom-in-75 duration-150 motion-reduce:animate-none"
      >
        <CheckIcon className="size-3 stroke-[3]" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
