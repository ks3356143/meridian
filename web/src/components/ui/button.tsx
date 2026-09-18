import * as React from "react";
import type { CSSProperties } from "react";
import { cn } from "cn";
import { Slot, Slottable } from "radix-ui/slot";
import styles from "./Button.module.css";

export type ButtonVariant = keyof typeof buttonVariantClasses;
export type ButtonSize = keyof typeof buttonSizeClasses;

const buttonVariantClasses = {
  default: styles.primary,
  outline: styles.outline,
  secondary: styles.secondary,
  ghost: styles.ghost,
  destructive: styles.destructive,
  link: styles.link,
} as const;

const buttonSizeClasses = {
  default: styles.sizeDefault,
  xs: styles.sizeXs,
  sm: styles.sizeSm,
  lg: styles.sizeLg,
  icon: styles.sizeIcon,
  "icon-xs": styles.sizeIconXs,
  "icon-sm": styles.sizeIconSm,
  "icon-lg": styles.sizeIconLg,
} as const;

export interface ButtonVariantOptions {
  variant?: ButtonVariant | null;
  size?: ButtonSize | null;
  className?: string;
}

export function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: ButtonVariantOptions = {}) {
  return cn(
    styles.button,
    variant ? buttonVariantClasses[variant] : undefined,
    size ? buttonSizeClasses[size] : undefined,
    className,
  );
}

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
  disableRipple = false,
  children,
  onPointerDown,
  disabled,
  ...props
}: React.ComponentProps<"button"> &
  ButtonVariantOptions & {
    asChild?: boolean;
    disableRipple?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  const [ripples, setRipples] = React.useState<Ripple[]>([]);
  const rippleIdRef = React.useRef(0);

  const removeRipple = React.useCallback((id: number) => {
    setRipples((previous) => previous.filter((ripple) => ripple.id !== id));
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    onPointerDown?.(event as React.PointerEvent<HTMLButtonElement>);
    if (disabled || disableRipple || variant === "link" || event.button !== 0) return;

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
      className={buttonVariants({ variant, size, className })}
      onPointerDown={handlePointerDown}
      disabled={disabled}
      {...props}
    >
      {asChild ? <Slottable>{children}</Slottable> : children}
      {variant === "link" || disableRipple || ripples.length === 0 ? null : (
        <span className={styles.rippleClip} aria-hidden>
          {ripples.map((ripple) => (
            <span
              key={ripple.id}
              className={styles.ripple}
              style={
                {
                  "--ripple-x": `${ripple.x}px`,
                  "--ripple-y": `${ripple.y}px`,
                  "--ripple-size": `${ripple.size}px`,
                } as CSSProperties
              }
            />
          ))}
        </span>
      )}
    </Comp>
  );
}

export { Button };
