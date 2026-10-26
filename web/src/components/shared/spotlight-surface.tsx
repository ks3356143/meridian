import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "cn";
import styles from "./spotlight-surface.module.css";

interface SpotlightSurfaceProps<T extends ElementType> {
  as?: T;
  children: ReactNode;
  className?: string;
}

export function SpotlightSurface<T extends ElementType = "div">({
  as,
  children,
  className,
  ...props
}: SpotlightSurfaceProps<T> & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">) {
  const Comp = (as ?? "div") as ElementType;

  return (
    <Comp {...props} className={cn(styles.surface, className)} data-spotlight="">
      {children}
      <span className={styles.glow} aria-hidden />
      <span className={styles.sheen} aria-hidden />
    </Comp>
  );
}
