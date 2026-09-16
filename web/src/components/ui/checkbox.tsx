import * as React from "react";
import { CheckIcon } from "lucide-react";
import * as CheckboxPrimitive from "radix-ui/checkbox";
import { cn } from "cn";

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "input-elevated size-4 shrink-0 rounded-[3px] border border-input bg-card/80 transition-[color,border-color,background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] outline-none hover:border-primary/40 hover:bg-card hover:shadow-[0_2px_8px_-4px_color-mix(in_oklch,var(--primary)_55%,transparent)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground active:scale-95 dark:bg-input/40",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-transform duration-150 data-[state=checked]:scale-100"
      >
        <CheckIcon className="size-3 stroke-[3]" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
