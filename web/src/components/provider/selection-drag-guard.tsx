import { useEffect } from "react";

const editableSelector =
  "input, textarea, select, [contenteditable='true'], [contenteditable=''], [data-draggable='true']";

export function SelectionDragGuard() {
  useEffect(() => {
    const handleDragStart = (event: DragEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || target.closest(editableSelector)) return;

      // Edge/Chrome will start a native drag-copy session when a text selection
      // is dragged. That ghost drag can freeze complex app surfaces, so static
      // text should be copied with Ctrl+C instead.
      if (!window.getSelection()?.isCollapsed) {
        event.preventDefault();
      }
    };

    document.addEventListener("dragstart", handleDragStart, true);
    return () => document.removeEventListener("dragstart", handleDragStart, true);
  }, []);

  return null;
}
