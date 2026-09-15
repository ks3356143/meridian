import { useSyncExternalStore } from "react";

const wideLayoutQuery = "(min-width: 1101px)";
const wideLayoutMedia = window.matchMedia(wideLayoutQuery);

export function useResizableRequirementsLayout() {
  return useSyncExternalStore(
    (onStoreChange) => {
      wideLayoutMedia.addEventListener("change", onStoreChange);
      return () => wideLayoutMedia.removeEventListener("change", onStoreChange);
    },
    () => wideLayoutMedia.matches,
    () => false,
  );
}
