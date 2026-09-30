let installed = false;

export function installBackgroundAnimationPause() {
  if (installed || typeof document === "undefined") return;
  installed = true;

  const root = document.documentElement;
  const sync = () => {
    const shouldPause = document.hidden || !document.hasFocus();
    if (shouldPause) {
      root.dataset.backgroundAnimationPaused = "true";
    } else {
      delete root.dataset.backgroundAnimationPaused;
    }
  };

  document.addEventListener("visibilitychange", sync);
  window.addEventListener("blur", sync);
  window.addEventListener("focus", sync);
  sync();
}
