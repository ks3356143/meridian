import * as React from "react";
import TextareaAutosize from "react-textarea-autosize";
import { cn } from "cn";
import styles from "./Textarea.module.css";

function Textarea({
  className,
  minRows = 4,
  maxRows = 10,
  ...props
}: React.ComponentProps<typeof TextareaAutosize>) {
  return (
    <TextareaAutosize
      data-slot="textarea"
      minRows={minRows}
      maxRows={maxRows}
      className={cn(styles.textarea, className)}
      {...props}
    />
  );
}

export { Textarea };
