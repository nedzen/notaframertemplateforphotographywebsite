// About/Contact sheets: open over the current page, close back to it.
// The factory knows nothing about hashes or the page machine: callers
// supply the sheets, run layout before an open, and listen to changes.

import { durations } from "../core/config.js";

export function createSheets({
  items,
  closeDelay = durations.fade,
  onBeforeOpen = () => {},
  onLayers = () => {},
  onChange = () => {},
  afterClose = () => {},
}) {
  const sheets = items;
  sheets.forEach((sheet) => (sheet.panel.tabIndex = -1));

  const isOpen = (sheet) =>
    !sheet.panel.hidden && !sheet.panel.classList.contains("is-closing");

  function open(sheet) {
    sheets.forEach((other) => other !== sheet && close(other));
    const { panel, link } = sheet;
    // Asked back while it fades away (a quick switch, back then forward).
    if (panel.classList.contains("is-closing")) {
      clearTimeout(sheet.closeTimer);
      panel.classList.remove("is-closing");
      link.setAttribute("aria-expanded", "true");
      panel.focus({ preventScroll: true });
      onChange();
      return;
    }
    if (!panel.hidden) return;
    onBeforeOpen(sheet);
    panel.classList.add("is-opening");
    panel.hidden = false;
    void panel.offsetWidth; // commit the transparent state, then fade in
    panel.classList.remove("is-opening");
    panel.classList.add("is-open"); // starts the content stagger
    link.setAttribute("aria-expanded", "true");
    // Focus moves into the sheet; it goes back to whatever opened it on close.
    sheet.opener = document.activeElement;
    panel.focus({ preventScroll: true });
    onChange();
  }

  function close(sheet) {
    const { panel, link } = sheet;
    if (panel.hidden || panel.classList.contains("is-closing")) return;
    panel.classList.add("is-closing");
    link.setAttribute("aria-expanded", "false");
    onLayers();
    const opener = sheet.opener;
    sheet.opener = null;
    if (
      opener &&
      opener.isConnected &&
      (panel.contains(document.activeElement) || document.activeElement === document.body)
    ) {
      opener.focus({ preventScroll: true });
    }
    sheet.closeTimer = setTimeout(() => {
      panel.hidden = true;
      panel.classList.remove("is-closing", "is-open"); // reset for next open
    }, closeDelay);
    onChange();
    // Back on a project, its header line sweeps in as the sheet fades.
    queueMicrotask(() => afterClose());
  }

  const closeAll = () => sheets.forEach(close);
  const top = () => sheets.find(isOpen) || null;

  function destroy() {
    sheets.forEach((sheet) => {
      clearTimeout(sheet.closeTimer);
      sheet.panel.hidden = true;
      sheet.panel.classList.remove("is-opening", "is-closing", "is-open");
    });
  }

  return { items: sheets, isOpen, open, close, closeAll, top, destroy };
}
