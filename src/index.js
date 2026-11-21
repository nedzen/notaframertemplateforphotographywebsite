/* Index: project rows, hover/focus previews and touch autoplay. */

import { Media } from "./media.js";
import {
  autoplayLayout,
  defaultRow,
  gallery,
  hooks,
  hoverInput,
  list,
  page,
  phoneLayout,
  projectOpen,
  reduceMotion,
  rows,
  sets,
  state,
  touchLayout,
} from "./layout.js";

export function setActive(row) {
  if (!row || row === state.activeRow) return; // no projects yet: nothing to show
  state.activeRow = row;

  rows.forEach((r) => r.classList.toggle("is-active", r === row));
  sets.forEach((set, key) =>
    set.classList.toggle("is-active", key === row.dataset.project)
  );
  // Only the visible set's videos run.
  if (state.indexShowing)
    Media.playWithin(sets.get(row.dataset.project), [...sets.values()]);
}

rows.forEach((row) => {
  row.addEventListener("mouseenter", () => setActive(row));
  // Keyboard parity: focusing a row reveals its images.
  row.addEventListener("focus", () => setActive(row));
});

list.addEventListener("mouseleave", () => {
  if (!projectOpen() && !autoplayLayout()) setActive(defaultRow);
});

list.addEventListener("focusout", (e) => {
  if (!list.contains(e.relatedTarget) && !projectOpen() && !autoplayLayout())
    setActive(defaultRow);
});

// Resting state: project 01 selected with its images shown.
setActive(defaultRow);

/* Autoplay: on the phone and a tablet the index shows one project at a
   time and moves on by itself. While .is-autoplay is on the page, the
   active row's line fills over --slide-ms (styles.css); when that
   animation ends the next project becomes active. */
export function syncAutoplay() {
  const on =
    autoplayLayout() &&
    !reduceMotion.matches &&
    page.classList.contains("is-loaded") &&
    state.currentPage === "index" &&
    !state.transitioning &&
    !hooks.anySheetOpen() &&
    document.visibilityState === "visible";
  page.classList.toggle("is-autoplay", on);
}

list.addEventListener("animationend", (e) => {
  if (e.animationName !== "slide-progress" || !state.activeRow) return;
  setActive(rows[(rows.indexOf(state.activeRow) + 1) % rows.length]);
  // A list longer than the gallery scrolls: keep the active row in it.
  if (!phoneLayout.matches) {
    const [row, box] = [
      state.activeRow.getBoundingClientRect(),
      list.getBoundingClientRect(),
    ];
    if (row.top < box.top) list.scrollTop = 0;
    else if (row.bottom > box.bottom) list.scrollTop += row.bottom - box.bottom;
  }
});

document.addEventListener("visibilitychange", syncAutoplay);
[phoneLayout, touchLayout, hoverInput].forEach((mq) =>
  mq.addEventListener("change", syncAutoplay)
);
reduceMotion.addEventListener("change", syncAutoplay);

// Tapping the tiles on touch sizes opens the project they show.
gallery.addEventListener("click", () => {
  if (!touchLayout.matches || state.currentPage !== "index" || state.transitioning)
    return;
  if (!state.activeRow) return;
  hooks.goTo("project", { row: state.activeRow, keep: true });
  hooks.syncHash();
});
