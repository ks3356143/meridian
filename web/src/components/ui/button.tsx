import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

const buttonVariants = cva(
  "group/button relative isolate inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap outline-none select-none transition-[color,background-color,border-color,box-shadow,transform,filter] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "button-primary-elevated bg-primary text-primary-foreground hover:bg-primary/90 hover:brightness-105",
        outline:
          "button-elevated border-border bg-card text-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary dark:border-input dark:bg-input/40 dark:hover:bg-primary/10",
        secondary:
          "button-elevated bg-secondary text-secondary-foreground hover:border-primary/25 hover:bg-[color-mix(in_oklch,var(--secondary),var(--primary)_10%)]",
        ghost: "hover:bg-primary/8 hover:text-primary dark:hover:bg-primary/12",
        destructive:
          "button-elevated border-destructive/25 bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:brightness-105",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 px-2 text-xs in-data-[slot=button-group]:rounded-sm has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-sm has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 in-data-[slot=button-group]:rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 in-data-[slot=button-group]:rounded-sm",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  children,
  onPointerDown,
  disabled,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";
  const [ripples, setRipples] = React.useState<Ripple[]>([]);
  const rippleIdRef = React.useRef(0);

  const removeRipple = React.useCallback((id: number) => {
    setRipples((previous) => previous.filter((ripple) => ripple.id !== id));
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    onPointerDown?.(event as React.PointerEvent<HTMLButtonElement>);
    if (disabled || variant === "link" || event.button !== 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const rippleSize = Math.max(rect.width, rect.height) * 2.4;
    const id = ++rippleIdRef.current;
    setRipples((previous) => [
      ...previous,
      {
        id,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        size: rippleSize,
      },
    ]);
    window.setTimeout(() => removeRipple(id), 520);
  };

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      onPointerDown={handlePointerDown}
      {...props}
    >
      {asChild ? <Slot.Slottable>{children}</Slot.Slottable> : children}
      {variant === "link" || ripples.length === 0 ? null : (
        <span
          className="button-ripple-clip"
          style={{ viewTransitionName: "button-ripple" }}
          aria-hidden
        >
          {ripples.map((ripple) => (
            <span
              key={ripple.id}
              className="button-ripple"
              style={{
                left: ripple.x,
                top: ripple.y,
                width: ripple.size,
                height: ripple.size,
              }}
            />
          ))}
        </span>
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
