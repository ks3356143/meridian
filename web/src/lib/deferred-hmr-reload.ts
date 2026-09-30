export function installDeferredHmrReload() {
  if (!import.meta.hot) return;

  let pending = false;
  const hasOpenDialog = () => Boolean(document.querySelector("dialog[open]"));
  const tryReload = () => {
    if (!pending || hasOpenDialog()) return;
    pending = false;
    window.location.reload();
  };

  import.meta.hot.on("chenmeridian:reload-after-dialog", () => {
    pending = true;
    tryReload();
  });

  document.addEventListener("close", tryReload, true);
  window.addEventListener("focus", tryReload);
}
