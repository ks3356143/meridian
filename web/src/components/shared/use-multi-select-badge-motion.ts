import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
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

  useGSAP(
    () => {
      if (!triggerRef.current) return;
      const previousAnimatedValue = animatedValueRef.current;
      animatedValueRef.current = value;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        if (exitingSelected.size > 0) setExitingValues([]);
        return;
      }

      const badges = triggerRef.current.querySelectorAll<HTMLElement>("[data-selected-value]");
      const enteredValues = previousAnimatedValue
        ? new Set(value.filter((item) => !previousAnimatedValue.includes(item)))
        : new Set<string>();
      const enterTargets = Array.from(badges).filter(
        (badge) =>
          enteredValues.has(badge.dataset.selectedValue ?? "") &&
          !exitingSelected.has(badge.dataset.selectedValue ?? ""),
      );
      const exitTargets = Array.from(badges).filter((badge) =>
        exitingSelected.has(badge.dataset.selectedValue ?? ""),
      );

      if (enterTargets.length > 0) {
        gsap.from(enterTargets, {
          autoAlpha: 0,
          scale: 0.84,
          x: -6,
          duration: 0.22,
          ease: "back.out(1.8)",
          clearProps: "all",
          overwrite: "auto",
        });
      }
      if (exitTargets.length > 0) {
        gsap.to(exitTargets, {
          autoAlpha: 0,
          scale: 0.82,
          x: -8,
          duration: 0.16,
          ease: "power2.in",
          overwrite: "auto",
          onComplete: () => {
            setExitingValues((current) =>
              current.filter(
                (item) => !exitTargets.some((badge) => badge.dataset.selectedValue === item),
              ),
            );
          },
        });
      }
    },
    { dependencies: [selectedKey, exitingKey], scope: triggerRef },
  );

  return { visibleOptions, exitingSelected };
}
