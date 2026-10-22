import type { RefObject } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

export function useSubtleReveal(
  scopeRef: RefObject<HTMLElement | null>,
  selector: string,
  enabled = true,
) {
  useGSAP(
    () => {
      if (!enabled || !scopeRef.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.fromTo(
        selector,
        { opacity: 0.88 },
        {
          opacity: 1,
          duration: 0.2,
          stagger: 0.03,
          ease: "power2.out",
          clearProps: "opacity",
        },
      );
    },
    { scope: scopeRef, dependencies: [enabled, selector] },
  );
}
