import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { animate } from "@/lib/motion";
import type { MultiSelectOption } from "./multi-select-types";

interface BadgeMotionOptions {
  options: MultiSelectOption[];
  value: string[];
  triggerRef: RefObject<HTMLButtonElement | null>;
}

export function useMultiSelectBadgeMotion({ options, value, triggerRef }: BadgeMotionOptions) {
  const [exitingValues, setExitingValues] = useState<string[]>([]);
  const previousValueRef = useRef<string[] | null>(null);
  const animatedValueRef = useRef<string[] | null>(null);
  const optionMap = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options],
  );

  useLayoutEffect(() => {
    const previousValue = previousValueRef.current;
    previousValueRef.current = value;
    if (!previousValue) return;

    const removed = previousValue.filter((item) => !value.includes(item));
    if (removed.length === 0) return;

    setExitingValues((current) => {
      const merged = [...current];
      for (const item of removed) {
        if (!merged.includes(item) && optionMap.has(item)) merged.push(item);
      }
      return merged;
    });
  }, [optionMap, value]);

  const exitingSelected = new Set(exitingValues.filter((item) => !value.includes(item)));
  const visibleOptions = [
    ...options.filter((option) => value.includes(option.value)),
    ...[...exitingSelected]
      .map((item) => optionMap.get(item))
      .filter((option): option is MultiSelectOption => Boolean(option)),
  ];
  const selectedKey = JSON.stringify(value);
  const exitingKey = JSON.stringify([...exitingSelected].sort());

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const previousAnimatedValue = animatedValueRef.current;
    animatedValueRef.current = value;

    const badges = trigger.querySelectorAll<HTMLElement>("[data-selected-value]");
    const enteredValues = previousAnimatedValue
      ? new Set(value.filter((item) => !previousAnimatedValue.includes(item)))
      : new Set<string>();
    const exiting = new Set(exitingValues.filter((item) => !value.includes(item)));
    const enterTargets = Array.from(badges).filter(
      (badge) =>
        enteredValues.has(badge.dataset.selectedValue ?? "") &&
        !exiting.has(badge.dataset.selectedValue ?? ""),
    );
    const exitTargets = Array.from(badges).filter((badge) =>
      exiting.has(badge.dataset.selectedValue ?? ""),
    );

    const enterControls = enterTargets.map((badge) =>
      animate(
        badge,
        { opacity: [0, 1], scale: [0.84, 1], x: [-6, 0] },
        { duration: 0.22, ease: "backOut" },
      ),
    );
    const exitControls = exitTargets.map((badge) =>
      animate(badge, { opacity: 0, scale: 0.82, x: -8 }, { duration: 0.16, ease: "easeIn" }),
    );
    exitControls.forEach((control) =>
      control.then(
        () => {
          setExitingValues((current) =>
            current.filter(
              (item) => !exitTargets.some((badge) => badge.dataset.selectedValue === item),
            ),
          );
        },
        () => {},
      ),
    );

    return () => {
      enterControls.forEach((control) => control.stop());
      exitControls.forEach((control) => control.stop());
    };
  }, [exitingKey, exitingValues, selectedKey, triggerRef, value]);

  return { visibleOptions, exitingSelected };
}
