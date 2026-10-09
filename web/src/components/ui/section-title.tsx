import type { ComponentProps } from "react";
import { cn } from "cn";

import styles from "./section-title.module.css";

interface SectionTitleProps extends ComponentProps<"h3"> {
  as?: "h2" | "h3" | "h4" | "h5";
  size?: "sm" | "lg";
}

/** 全站统一的分节标题：主色竖线 + 字重。竖线颜色可用 `--section-tone` 覆盖。 */
function SectionTitle({
  as: Tag = "h3",
  size = "sm",
  className,
  children,
  ...props
}: SectionTitleProps) {
  return (
    <Tag
      data-slot="section-title"
      className={cn(styles.title, size === "lg" && styles.lg, className)}
      {...props}
    >
      {children}
    </Tag>
  );
}

export { SectionTitle };
