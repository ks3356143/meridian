import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import * as TabsPrimitive from "@animate-ui/react/primitives/radix-ui/tabs";
import styles from "./tabs.module.css";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      data-horizontal={orientation === "horizontal" ? true : undefined}
      data-vertical={orientation === "vertical" ? true : undefined}
      className={cn(
        "group/tabs flex gap-2",
        orientation === "horizontal" ? "flex-col" : "flex-row",
        className,
      )}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center-safe text-muted-foreground group-data-horizontal/tabs:h-10 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "border-border/85 bg-card/75 elevation-1 gap-1 rounded-sm border p-1",
        line: "bg-card/55 w-full gap-0 rounded-none p-0",
        hud: "w-full gap-0 rounded-none p-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(
        tabsListVariants({ variant }),
        variant === "line" && styles.lineList,
        variant === "hud" && styles.hudList,
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-full flex-1 items-center justify-center gap-1.5 rounded-sm border border-transparent px-3 text-sm font-medium whitespace-nowrap text-foreground/70 transition-[color,background-color,border-color,box-shadow] duration-200 ease-[var(--ease-out-strong)] hover:border-transparent hover:bg-[var(--interactive-surface)] hover:text-primary focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 dark:text-muted-foreground dark:hover:text-primary [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=default]/tabs-list:data-[state=active]:border-transparent group-data-[variant=default]/tabs-list:data-[state=active]:bg-[var(--interactive-surface-strong)] group-data-[variant=default]/tabs-list:data-[state=active]:text-primary-ink",
        "group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:border-transparent group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-[var(--interactive-surface)] group-data-[variant=line]/tabs-list:data-[state=active]:text-primary-ink",
        "after:absolute after:hidden after:bg-primary after:opacity-0 after:transform-gpu after:transition-[opacity,transform] after:duration-200 after:ease-[var(--ease-out-strong)] group-data-[variant=line]/tabs-list:after:block group-data-[variant=default]/tabs-list:after:block group-data-[variant=default]/tabs-list:after:inset-x-0 group-data-[variant=default]/tabs-list:after:bottom-0 group-data-[variant=default]/tabs-list:after:h-[2px] group-data-[variant=default]/tabs-list:after:origin-center group-data-[variant=default]/tabs-list:after:scale-x-0 group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-0 group-data-horizontal/tabs:after:h-[2px] group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:right-0 group-data-vertical/tabs:after:w-[2px] group-data-[variant=line]/tabs-list:after:scale-x-0 group-data-[variant=line]/tabs-list:data-[state=active]:after:scale-x-100 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100 group-data-[variant=default]/tabs-list:data-[state=active]:after:scale-x-100 group-data-[variant=default]/tabs-list:data-[state=active]:after:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(styles.content, "flex-1 text-sm outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
