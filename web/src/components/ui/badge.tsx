import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-2 py-0 text-xs font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        primary: "border-primary/30 bg-primary/12 text-primary [a]:hover:bg-primary/18",
        secondary: "border-border bg-muted/60 text-muted-foreground [a]:hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground [a]:hover:bg-destructive/90",
        danger:
          "border-destructive/35 bg-destructive/12 text-destructive [a]:hover:bg-destructive/18",
        success: "border-success/35 bg-success/14 text-success [a]:hover:bg-success/20",
        warning: "border-warning/40 bg-warning/16 text-warning [a]:hover:bg-warning/22",
        info: "border-info/35 bg-info/14 text-info [a]:hover:bg-info/20",
        outline: "border-border bg-muted/45 text-muted-foreground [a]:hover:bg-muted",
        ghost: "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
