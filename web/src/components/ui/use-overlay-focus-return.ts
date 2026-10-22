import { useRef } from "react";

/** 受控浮层常没有 Trigger，关闭后需要把焦点还给打开前的元素。 */
export function useOverlayFocusReturn(
  onOpenAutoFocus?: (event: Event) => void,
  onCloseAutoFocus?: (event: Event) => void,
) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  return {
    onOpenAutoFocus: (event: Event) => {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event);
      if (event.defaultPrevented) return;
      const previous = previousFocusRef.current;
      if (previous?.isConnected) {
        event.preventDefault();
        previous.focus();
      }
    },
  };
}
