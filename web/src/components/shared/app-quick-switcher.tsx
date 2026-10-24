import { useEffect, useRef, useState } from "react";
import { Check, CornerDownLeft, Search, type LucideIcon } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "./app-quick-switcher.module.css";

export interface AppQuickSwitchItem {
  value: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export function AppQuickSwitcher({
  items,
  activeValue,
  onSelect,
  onPreload,
}: {
  items: AppQuickSwitchItem[];
  activeValue: string;
  onSelect: (value: string) => void;
  onPreload?: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const activeItem = items.find((item) => item.value === activeValue);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || !(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() !== "k") return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("[contenteditable='true'], .ProseMirror")
      ) {
        return;
      }
      if (
        !openRef.current &&
        document.querySelector(
          '[data-slot="dialog-content"][data-state="open"], [data-slot="alert-dialog-content"][data-state="open"], [data-slot="sheet-content"][data-state="open"], [role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]',
        )
      ) {
        return;
      }
      event.preventDefault();
      setOpen((current) => !current);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const choose = (value: string) => {
    setOpen(false);
    onSelect(value);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={styles.trigger}
            aria-label="打开快速切换"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-keyshortcuts="Control+K Meta+K"
            onClick={() => setOpen(true)}
          >
            <Search className={styles.triggerIcon} aria-hidden />
            <span className={styles.triggerLabel}>快速切换</span>
            <kbd className={styles.shortcut}>Ctrl K</kbd>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">快速切换 · Ctrl K</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={styles.dialog} showCloseButton={false}>
          <DialogTitle className="sr-only">快速切换</DialogTitle>
          <DialogDescription className="sr-only">
            搜索并切换应用页面，也可以使用上下方向键和回车键操作。
          </DialogDescription>
          <Command
            loop
            defaultValue={activeItem ? `${activeItem.label} ${activeItem.description}` : undefined}
            className={styles.command}
          >
            <div className={styles.header}>
              <div className={styles.headerCopy}>
                <span className={styles.eyebrow}>QUICK SWITCHER</span>
                <span className={styles.headerTitle}>去哪里？</span>
              </div>
              <kbd className={styles.escape}>Esc</kbd>
            </div>
            <CommandInput
              aria-label="搜索应用页面"
              placeholder="搜索页面或输入关键词…"
              className={styles.input}
            />
            <CommandList className={styles.list}>
              <CommandEmpty className={styles.empty}>没有匹配的应用页面</CommandEmpty>
              <CommandGroup heading="页面导航">
                {items.map((item) => {
                  const Icon = item.icon;
                  const current = item.value === activeValue;
                  return (
                    <CommandItem
                      key={item.value}
                      value={`${item.label} ${item.description}`}
                      className={styles.item}
                      data-current={current ? "true" : undefined}
                      onPointerEnter={() => onPreload?.(item.value)}
                      onSelect={() => choose(item.value)}
                    >
                      <span className={styles.itemIcon} aria-hidden>
                        <Icon />
                      </span>
                      <span className={styles.itemCopy}>
                        <span className={styles.itemLabel}>{item.label}</span>
                        <span className={styles.itemDescription}>{item.description}</span>
                      </span>
                      {current ? (
                        <span className={styles.current}>
                          <Check aria-hidden />
                          当前
                        </span>
                      ) : (
                        <CornerDownLeft className={styles.enter} aria-hidden />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
            <div className={styles.footer}>
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd>
                选择
              </span>
              <span>
                <kbd>↵</kbd>
                打开
              </span>
              <span>
                <kbd>Esc</kbd>
                关闭
              </span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
