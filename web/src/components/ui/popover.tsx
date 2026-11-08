"use client";

import * as React from "react";
import * as PopoverPrimitive from "@animate-ui/react/primitives/radix-ui/popover";
import { cn } from "cn";

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "panel-surface border-border text-popover-foreground z-50 flex w-72 origin-(--radix-popover-content-transform-origin) flex-col gap-3 rounded-sm border p-3.5 text-sm shadow-[0_16px_38px_-28px_rgb(20_42_30_/_0.46)] outline-none transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out-strong)]",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

function PopoverAnchor({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
