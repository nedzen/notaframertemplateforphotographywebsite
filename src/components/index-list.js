// Project index: rows, hover/focus previews and touch autoplay.
//
// The component reads the page state it is given and mutates only
// `state.activeRow`. Navigation is a pair of callbacks, so the index does
// not import the page machine.

import { Media } from "../core/media.js";

export function createIndexList({
  list,
  gallery,
  sets,
  rows,
  defaultRow,
  page,
  state,
  reduceMotion,
  autoplayLayout,
  phoneLayout,
  touchLayout,
  hoverInput,
  anySheetOpen = () => false,
  projectOpen = () => false,
  goTo = () => {},
  syncHash = () => {},
}) {
  const controller = new AbortController();
  const on = (target, type, fn, options = {}) =>
    target.addEventListener(type, fn, { ...options, signal: controller.signal });

  function setActive(row) {
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
    on(row, "mouseenter", () => setActive(row));
    // Keyboard parity: focusing a row reveals its images.
    on(row, "focus", () => setActive(row));
  });

  on(list, "mouseleave", () => {
    if (!projectOpen() && !autoplayLayout()) setActive(defaultRow);
  });

  on(list, "focusout", (e) => {
    if (!list.contains(e.relatedTarget) && !projectOpen() && !autoplayLayout())
      setActive(defaultRow);
  });

  // Resting state: project 01 selected with its images shown.
  setActive(defaultRow);

  // Autoplay: on the phone and a tablet the index shows one project at a
  // time and moves on by itself. While .is-autoplay is on the page, the
  // active row's line fills over --slide-ms
  // (scss/responsive/_phone-index.scss); when that
  // animation ends the next project becomes active.
  function syncAutoplay() {
    const onNow =
      autoplayLayout() &&
      !reduceMotion.matches &&
      page.classList.contains("is-loaded") &&
      state.currentPage === "index" &&
      !state.transitioning &&
      !anySheetOpen() &&
      document.visibilityState === "visible";
    page.classList.toggle("is-autoplay", onNow);
  }

  on(list, "animationend", (e) => {
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

  on(document, "visibilitychange", syncAutoplay);
  const queries = [phoneLayout, touchLayout, hoverInput, reduceMotion];
  queries.forEach((mq) => mq.addEventListener("change", syncAutoplay));

  // Tapping the tiles on touch sizes opens the project they show.
  on(gallery, "click", () => {
    if (!touchLayout.matches || state.currentPage !== "index" || state.transitioning)
      return;
    if (!state.activeRow) return;
    goTo("project", { row: state.activeRow, keep: true });
    syncHash();
  });

  function destroy() {
    controller.abort();
    queries.forEach((mq) => mq.removeEventListener("change", syncAutoplay));
  }

  return { setActive, syncAutoplay, destroy };
}
