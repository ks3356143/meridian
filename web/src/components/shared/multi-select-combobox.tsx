import { Check, ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { MultiSelectOption } from "./multi-select-types";
import { useMultiSelectBadgeMotion } from "./use-multi-select-badge-motion";
import styles from "./multi-select-combobox.module.css";

export function MultiSelectCombobox({
  id,
  ariaLabel,
  options,
  value,
  onChange,
  placeholder = "请选择",
  searchPlaceholder = "搜索选项",
  emptyText = "没有匹配选项",
  invalid,
  className,
}: {
  id: string;
  ariaLabel: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  invalid?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { visibleOptions, exitingSelected } = useMultiSelectBadgeMotion({
    options,
    value,
    triggerRef,
  });
  const popoverId = `${id}-popover`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={popoverId}
          aria-invalid={invalid ? true : undefined}
          aria-label={ariaLabel}
          data-slot="multi-select-trigger"
          data-empty={visibleOptions.length === 0 || undefined}
          className={cn(styles.trigger, className)}
        >
          <span className={styles.content}>
            {visibleOptions.length === 0
              ? placeholder
              : visibleOptions.map((option) => (
                  <Badge
                    key={option.value}
                    variant="primary"
                    className="max-w-full"
                    data-selected-value={option.value}
                    aria-hidden={exitingSelected.has(option.value) ? true : undefined}
                  >
                    <span className="truncate">{option.label}</span>
                  </Badge>
                ))}
          </span>
          <ChevronDown className={styles.chevron} aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        id={popoverId}
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const checked = value.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={[
                      option.label,
                      option.description ?? "",
                      ...(option.keywords ?? []),
                    ].join(" ")}
                    disabled={option.disabled}
                    onSelect={() => {
                      onChange(
                        checked
                          ? value.filter((item) => item !== option.value)
                          : [...value, option.value],
                      );
                    }}
                  >
                    <span
                      className={cn(
                        "border-border flex size-4 shrink-0 items-center justify-center border",
                        checked && "border-primary bg-primary text-primary-foreground",
                      )}
                      aria-hidden
                    >
                      {checked ? <Check className="size-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{option.label}</span>
                      {option.description ? (
                        <span className="text-muted-foreground block truncate text-xs">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    {checked ? <span className="sr-only">已选择</span> : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
