import type { ReactElement, ReactNode } from "react";
import type { HTMLMotionProps } from "motion/react";
import { cn } from "cn";
import { RippleButton, RippleButtonRipples } from "@animate-ui/react/primitives/buttons/ripple";
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
  sheen?: boolean;
}

export function buttonVariants({
  variant = "default",
  size = "default",
  className,
  sheen = false,
}: ButtonVariantOptions = {}) {
  return cn(
    styles.button,
    variant ? buttonVariantClasses[variant] : undefined,
    size ? buttonSizeClasses[size] : undefined,
    sheen || variant === "default" ? styles.sheen : undefined,
    className,
  );
}

type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  children?: ReactNode;
} & ButtonVariantOptions & {
    asChild?: boolean;
    disableRipple?: boolean;
  };

function Button({
  className,
  variant = "default",
  size = "default",
  sheen = false,
  asChild = false,
  disableRipple = false,
  children,
  ...props
}: ButtonProps) {
  const shared = {
    "data-slot": "button",
    "data-variant": variant,
    "data-size": size,
    className: buttonVariants({ variant, size, className, sheen }),
    hoverScale: 1,
    tapScale: 0.98,
  } as const;

  if (asChild) {
    return (
      <RippleButton {...shared} asChild {...props}>
        {children as ReactElement}
      </RippleButton>
    );
  }

  return (
    <RippleButton {...shared} {...props}>
      {children}
      {variant === "link" || disableRipple ? null : (
        <RippleButtonRipples color="color-mix(in srgb, currentColor 45%, transparent)" scale={9} />
      )}
    </RippleButton>
  );
}

export { Button };
