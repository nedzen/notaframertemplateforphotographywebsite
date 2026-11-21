/* About and Contact sheets: open over the current page, close back to it. */

import { gridPanel, hooks, projectPanel, syncMainTop } from "./layout.js";

const FADE_MS = 450; // sheets: matches --dur-fade

export const sheets = [
  {
    panel: document.getElementById("about"),
    link: document.getElementById("nav-about"),
    hash: "#about",
  },
  {
    panel: document.getElementById("contact"),
    link: document.getElementById("nav-contact"),
    hash: "#contact",
  },
];
[...sheets.map((s) => s.panel), gridPanel, projectPanel].forEach(
  (el) => (el.tabIndex = -1)
);

export const sheetOpen = (s) =>
  !s.panel.hidden && !s.panel.classList.contains("is-closing");

export function openSheet(sheet) {
  sheets.forEach((s) => s !== sheet && closeSheet(s));
  const { panel, link } = sheet;
  // Asked back while it fades away (a quick switch, back then forward).
  if (panel.classList.contains("is-closing")) {
    clearTimeout(sheet.closeTimer);
    panel.classList.remove("is-closing");
    link.setAttribute("aria-expanded", "true");
    panel.focus({ preventScroll: true });
    hooks.syncCurrent();
    return;
  }
  if (!panel.hidden) return;
  syncMainTop();
  panel.classList.add("is-opening");
  panel.hidden = false;
  void panel.offsetWidth; // commit the transparent state, then fade in
  panel.classList.remove("is-opening");
  panel.classList.add("is-open"); // starts the content stagger
  link.setAttribute("aria-expanded", "true");
  // Focus moves into the sheet; it goes back to whatever opened it on close.
  sheet.opener = document.activeElement;
  panel.focus({ preventScroll: true });
  hooks.syncCurrent();
}

export function closeSheet(sheet) {
  const { panel, link } = sheet;
  if (panel.hidden || panel.classList.contains("is-closing")) return;
  panel.classList.add("is-closing");
  link.setAttribute("aria-expanded", "false");
  hooks.syncLayers();
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
  }, FADE_MS);
  hooks.syncCurrent();
  // Back on a project, its header line sweeps in as the sheet fades.
  queueMicrotask(() => hooks.afterSheetClose());
}

export const closeSheets = () => sheets.forEach(closeSheet);
