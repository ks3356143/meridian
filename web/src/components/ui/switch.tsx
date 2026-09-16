import * as React from "react";
import * as SwitchPrimitive from "radix-ui/switch";
import { cn } from "cn";

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-sm border border-input bg-input/70 transition-[color,background-color,border-color,box-shadow] duration-200 outline-none hover:border-primary/35 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/55 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary/45 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted dark:data-[state=unchecked]:bg-input/70",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-3.5 translate-x-0.5 rounded-[1px] bg-background shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=checked]:translate-x-[1.125rem] data-[state=checked]:bg-primary-foreground",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
