import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
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
import type { TestItemType } from "@/features/test-items/types";
import { categoryTone, groupTypesByCategory, typeSearchText } from "./test-items-design";
import styles from "./test-item-type-picker.module.css";

/** 测试项类型选择器（两列 + 拼音/代号模糊搜索），新增与改类型共用。 */
export function TypePicker({
  id,
  types,
  value,
  placeholder = "选择测试项类型",
  invalid = false,
  disabled = false,
  onChange,
}: {
  id?: string;
  types: TestItemType[];
  value: string;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = types.find((type) => type.code === value);
  const groups = useMemo(() => groupTypesByCategory(types), [types]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={styles.trigger}
          data-placeholder={selected ? undefined : "true"}
          aria-invalid={invalid ? true : undefined}
          aria-expanded={open}
          disabled={disabled}
        >
          {selected ? (
            <span className={styles.triggerValue}>
              <span className={styles.optionCode}>{selected.code}</span>
              {selected.name}
            </span>
          ) : (
            placeholder
          )}
          <ChevronDown className={styles.triggerIcon} aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={styles.popover}>
        <Command>
          <CommandInput placeholder="搜索：名称 / 拼音首字母 / 代号（如 DC、gncs）" />
          <CommandList className={styles.list}>
            <CommandEmpty>没有匹配的类型</CommandEmpty>
            {groups.map(([category, list]) => (
              <CommandGroup key={category} heading={category}>
                <div className={styles.grid}>
                  {list.map((type) => (
                    <CommandItem
                      key={type.code}
                      value={typeSearchText(type)}
                      className={styles.option}
                      onSelect={() => {
                        onChange(type.code);
                        setOpen(false);
                      }}
                    >
                      <span className={styles.optionCode}>{type.code}</span>
                      <span className={styles.optionName}>{type.name}</span>
                      <span
                        className={styles.optionTone}
                        data-tone={categoryTone(type.category)}
                        aria-hidden
                      />
                    </CommandItem>
                  ))}
                </div>
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
