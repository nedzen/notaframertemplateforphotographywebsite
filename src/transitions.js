/* Page state machine: index ⇄ grid ⇄ project, sheets, URLs and events. */

import { Media } from "./media.js";
import {
  EXIT_MS,
  HOLD_MS,
  PROJECT_MEDIA,
  SINK_MS,
  SINK_STAGGER,
  defaultRow,
  gallery,
  gridPanel,
  headerMeta,
  headerProject,
  hooks,
  indexPanel,
  mainArea,
  navGrid,
  navProjects,
  phoneLayout,
  projectPanel,
  reduceMotion,
  rows,
  sets,
  state,
  syncMainTop,
  tickCount,
  uprightLayout,
  wait,
} from "./layout.js";
import { setActive, syncAutoplay } from "./index.js";
import { closeSheet, closeSheets, openSheet, sheetOpen, sheets } from "./sheets.js";
import {
  cleanupGrid,
  collapsePhoto,
  hasExpandedPhoto,
  monoButton,
  photos,
  revealPhotos,
} from "./grid.js";
import {
  buildCarousel,
  buildFeed,
  carouselEl,
  endSweep,
  car,
  carouselOn,
  carouselReady,
  cleanupFeed,
  continueCarousel,
  continueFeed,
  dropFeedNext,
  dropNextStrip,
  feedOn,
  getCurrentProject,
  glideCarousel,
  loadProject,
  nextStrip,
  returnCarousel,
  revealStrip,
  showMedia,
  stopCarousel,
  sweepHeaderLine,
  turnHeader,
  unloadProject,
} from "./project/index.js";
import { navigate, routeHash } from "./router.js";

// What's under the page on screen: the index can't be reached by Tab or
// pointer behind a project, the grid or a sheet, and its videos rest.
function syncLayers() {
  const showing = state.currentPage === "index";
  const covered = !showing || sheets.some(sheetOpen);
  indexPanel.inert = covered;
  gallery.inert = covered;
  if (showing === state.indexShowing) return;
  state.indexShowing = showing;
  if (showing) {
    if (state.activeRow) Media.playWithin(sets.get(state.activeRow.dataset.project), [...sets.values()]);
  } else {
    gallery.querySelectorAll("video").forEach((v) => v.pause());
  }
}

let queued = null;          // the latest request made mid-transition
let indexOpener = null;     // the control that left the index, refocused on return

// Each page: how its content leaves and how it arrives.
let indexEnterTimer = 0;
const pageDefs = {
  index: {
    exit(ctx) {
      // Keep the active set's first tile on screen when it is about to
      // become the project's first media. The grid covers the main rule,
      // so heading there the rule fades with the rest.
      mainArea.classList.add("is-leaving");
      mainArea.classList.toggle("is-keeping", !!ctx.keep);
      // The carousel takes over a pair whole (both photos land where they
      // are), so the second tile stays too.
      mainArea.classList.toggle("is-keeping-all", !!ctx.keep && carouselOn());
      mainArea.classList.toggle("is-losing-rule", ctx.to === "grid");
      if (mainArea.contains(document.activeElement)) indexOpener = document.activeElement;
    },
    arrive(ctx) {
      if (ctx.keep && state.activeRow) {
        // The stage hands one photo back; the carousel a pair whole.
        const tiles = sets.get(state.activeRow.dataset.project).querySelectorAll(".tile");
        [...tiles].slice(0, carouselOn() ? 2 : 1).forEach((t) => t.classList.add("is-kept"));
      }
      mainArea.classList.add("is-arriving");
      mainArea.classList.remove("is-leaving", "is-keeping", "is-keeping-all", "is-losing-rule");
      mainArea.classList.toggle("is-drawing-rule", ctx.from === "grid"); // the rule draws back in
    },
    enter() {
      mainArea.classList.remove("is-arriving");
      mainArea.classList.add("is-entering");
      if (!reduceMotion.matches) tickCount(rows.length, 450, 900);
      clearTimeout(indexEnterTimer); // a quick round trip: this arrival's own
      indexEnterTimer = setTimeout(() => {
        mainArea.classList.remove("is-entering", "is-drawing-rule");
        mainArea.querySelectorAll(".tile.is-kept").forEach((t) => t.classList.remove("is-kept"));
      }, 1700);
      // Focus returns where it left, or after NEXT to the row now showing:
      // focusing a row makes it the active one.
      const opener = rows.includes(indexOpener) ? state.activeRow : indexOpener;
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
      indexOpener = null;
    },
  },
  grid: {
    exit() {
      collapsePhoto(true);
      gridPanel.classList.add("is-leaving");
    },
    arrive() {
      syncMainTop();
      gridPanel.classList.remove("is-leaving");
      gridPanel.classList.add("is-open");
      gridPanel.hidden = false;
    },
    enter() {
      revealPhotos();
      monoButton.tabIndex = 0;
      gridPanel.focus({ preventScroll: true });
    },
    hide() {
      cleanupGrid();
      monoButton.tabIndex = -1;
      gridPanel.hidden = true;
      gridPanel.classList.remove("is-open", "is-leaving");
      photos.forEach((p) => p.classList.remove("is-in")); // next time they arrive again
    },
  },
  project: {
    exit(ctx) {
      // Leaving for the index with the photo kept: the set underneath is
      // put back to this project so the stage lands on its own tile.
      if (ctx.keep && getCurrentProject()) setActive(getCurrentProject());
      projectPanel.classList.add(ctx.switching ? "is-switching" : "is-leaving");
      projectPanel.classList.toggle("is-keeping", !!ctx.keep);
      // The header line fades out rising, word by word; on NEXT only the
      // name and count turn over. The page waits for it, so it is seen
      // through to the end rather than cut off by the next page.
      const sinking = ctx.switching ? [headerMeta] : [headerProject, headerMeta];
      sinking.forEach((el) => {
        el.classList.remove("is-arriving", "is-entering");
        el.classList.add("is-sinking");
      });
      // On NEXT the next project's name in the NEXT label turns over too.
      if (ctx.switching) headerProject.classList.add("is-turning");
      const words = ctx.switching ? 3 : 5; // name, year, count (+ BACK, NEXT)
      const sunk = reduceMotion.matches ? Promise.resolve() : wait(SINK_MS + (words - 1) * SINK_STAGGER);
      // The carousel's way back: the row rewinds onto the index tile and
      // the page waits for it to land too.
      if (ctx.keep && carouselOn()) return Promise.all([sunk, returnCarousel()]);
      // NEXT, continued: the row stays and glides on into the next project.
      if (ctx.switching && ctx.continued && car) {
        projectPanel.classList.add("is-continuing");
        return Promise.all([sunk, continueCarousel(ctx.row, () => turnHeader(ctx), ctx)]);
      }
      // The phone feed's NEXT: the column carries on upward, the next
      // project rising from the bottom (continueFeed).
      if (ctx.switching && ctx.continued && feedOn()) {
        return Promise.all([sunk, continueFeed(ctx.row, () => turnHeader(ctx))]);
      }
      return sunk;
    },
    arrive(ctx) {
      syncMainTop();
      loadProject(ctx.row);
      projectPanel.classList.remove("is-leaving", "is-keeping", "is-switching", "is-continuing");
      projectPanel.classList.add("is-open");
      headerMeta.classList.remove("is-early");
      projectPanel.classList.toggle("project-view--carousel", carouselOn());
      projectPanel.classList.toggle("project-view--feed", feedOn());
      // With the photo kept, the panel stays see-through until the stage
      // tile is in place over the index tile, so no white paints between.
      projectPanel.classList.toggle("is-bare", !!ctx.keep);
      projectPanel.hidden = false;
      headerProject.hidden = false;
      headerMeta.hidden = false;
      // The header line rises from its mask on arrival; on NEXT only the
      // name and year change, BACK / NEXT stay.
      // (NEXT, continued, has already turned it over — see turnHeader.)
      const rising = ctx.headerTurned ? [] : ctx.switching ? [headerMeta] : [headerProject, headerMeta];
      rising.forEach((el) => {
        el.classList.remove("is-sinking");
        el.classList.add("is-arriving");
      });
      if (ctx.switching && !ctx.headerTurned) headerProject.classList.replace("is-turning", "is-turned");
    },
    enter(ctx) {
      if (carouselOn()) {
        const arrivingStrip = nextStrip;
        // Continued from the previous project, the row is built at rest,
        // under the strip that brought its photos in.
        buildCarousel(getCurrentProject(), { keep: ctx.keep, settled: !!ctx.continued && !ctx.handoff, handoff: ctx.handoff });
        const built = car;
        // The opening waits until the photos it shows are decoded, so none
        // arrives as a grey tile. Coming from the index, the first photo is
        // the same file on the same spot: once it can paint, the panel
        // turns solid, the index goes, and the row glides left.
        carouselReady().then(() => {
          if (car !== built) return; // NEXT or BACK meanwhile
          carouselEl.classList.remove("is-waiting");
          requestAnimationFrame(() => {
            if (car !== built) return;
            if (ctx.keep) {
              projectPanel.classList.remove("is-bare");
              mainArea.classList.remove("is-leaving", "is-keeping", "is-keeping-all", "is-losing-rule");
            }
            // The row underneath can paint. Only the strip that brought it:
            // NEXT pressed again may have laid a new one meanwhile.
            if (ctx.continued && nextStrip === arrivingStrip) dropNextStrip();
            else if (ctx.continued && arrivingStrip) arrivingStrip.remove();
            if (built && !built.handedOff) glideCarousel(); // a handed-over row is already moving
          });
        });
      } else if (feedOn()) {
        buildFeed(getCurrentProject());
      } else {
        revealStrip();
      }
      void headerMeta.offsetWidth;
      if (headerProject.classList.contains("is-turned")) {
        headerProject.classList.replace("is-turned", "is-turning-in");
        setTimeout(() => headerProject.classList.remove("is-turning-in"), 1300);
      }
      [headerProject, headerMeta].forEach((el) => {
        if (!el.classList.contains("is-arriving")) return;
        el.classList.remove("is-arriving");
        el.classList.add("is-entering");
        endSweep(el);
      });
      if (!carouselOn() && !feedOn()) {
        showMedia(0, {
          mode: ctx.keep ? "instant" : "wipe",
          onShown: () => {
            projectPanel.classList.remove("is-bare");
            mainArea.classList.remove("is-leaving", "is-keeping", "is-keeping-all", "is-losing-rule");
          },
        });
      }
      // On NEXT, focus stays on NEXT so it can be pressed again.
      if (!ctx.switching) projectPanel.focus({ preventScroll: true });
    },
    hide() {
      stopCarousel();
      dropNextStrip();
      dropFeedNext();
      cleanupFeed();
      unloadProject();
      projectPanel.hidden = true;
      projectPanel.classList.remove("is-open", "is-leaving", "is-keeping", "is-switching");
    },
  },
};

// Change page. ctx: { row } for a project, { keep } when a photo on
// screen is carried across. A request during a transition runs after it.
async function goTo(name, ctx = {}) {
  state.targetPage = name;
  state.targetProject = name === "project" ? ctx.row : null;
  if (state.transitioning) {
    queued = [name, ctx];
    return;
  }
  if (name === state.currentPage && (name !== "project" || ctx.row === getCurrentProject())) return;
  state.transitioning = true;
  syncAutoplay();
  const from = state.currentPage;
  const switching = from === "project" && name === "project";
  ctx = { ...ctx, switching, from, to: name };
  // A photo is carried across only between the index and a project, where
  // the page and the gallery tile share a frame (not on the phone). With the
  // carousel both ways keep it: in, the row glides to column 1; back, it
  // rewinds onto the index tile. Upright, the index crops a landscape into
  // its one tile, so that photo has no same spot to go to.
  const shown = ctx.row || getCurrentProject() || defaultRow;
  const media = shown && PROJECT_MEDIA[shown.dataset.project];
  const sameSpot = !uprightLayout.matches || !media || !media.media.length || media.media[0].o !== "l";
  const keep = !!ctx.keep && !phoneLayout.matches && sameSpot && ((from === "index" && name === "project") || (from === "project" && name === "index"));
  ctx.keep = keep;

  // A page opened straight from the URL arrives without anything leaving.
  if (!ctx.direct) {
    const landed = pageDefs[from].exit(ctx);
    await wait(EXIT_MS);
    await wait(HOLD_MS);
    await landed; // an exit carrying a photo home holds until it lands
  }

  state.currentPage = name;
  pageDefs[name].arrive(ctx);
  if (!switching && from !== name && pageDefs[from].hide) pageDefs[from].hide();
  // The index underneath comes back to full once it is covered (with a
  // kept photo, once the stage tile has landed — see project.enter).
  if (from === "index" && name !== "index" && !keep) mainArea.classList.remove("is-leaving", "is-keeping", "is-keeping-all", "is-losing-rule");
  void document.body.offsetWidth; // commit the arriving states
  syncLayers();
  pageDefs[name].enter(ctx);
  syncCurrent();

  state.transitioning = false;
  syncAutoplay();
  if (queued) {
    const [n, c] = queued;
    queued = null;
    goTo(n, c);
  }
}

// The nav marks the topmost surface as the current page: an open sheet,
// else the grid, else PROJECTS (the index and the project page).
function syncCurrent() {
  const top = sheets.find(sheetOpen);
  [...sheets.map((s) => s.link), navGrid, navProjects].forEach((l) => l.removeAttribute("aria-current"));
  const link = top ? top.link : state.targetPage === "grid" ? navGrid : navProjects;
  link.setAttribute("aria-current", "page");
  navGrid.setAttribute("aria-expanded", String(state.targetPage === "grid"));
  syncLayers();
  syncAutoplay();
}

sheets.forEach((sheet) => {
  sheet.link.addEventListener("click", (e) => {
    e.preventDefault();
    sheetOpen(sheet) ? closeSheet(sheet) : openSheet(sheet);
    syncHash();
  });
});

navGrid.addEventListener("click", (e) => {
  e.preventDefault();
  if (sheets.some(sheetOpen)) {
    closeSheets(); // GRID under a sheet: back to the page
    if (state.targetPage !== "grid") goTo("grid");
  } else if (state.targetPage === "grid") {
    goTo("index");
  } else {
    goTo("grid");
  }
  syncHash();
});

navProjects.addEventListener("click", (e) => {
  e.preventDefault();
  closeSheets();
  goTo("index", { keep: state.targetPage === "project" });
  syncHash();
});

// Escape peels off the top layer: an expanded photo, then an open sheet,
// then the page (back to the index).
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (sheets.some(sheetOpen)) {
    closeSheets();
  } else if (hasExpandedPhoto()) {
    collapsePhoto(false);
    return;
  } else if (state.targetPage !== "index") {
    goTo("index", { keep: state.targetPage === "project" });
  }
  syncHash();
});

/* ---------- URLs ----------
   Every surface has a hash: #about, #grid, #contact, #<project slug>;
   the index is the bare URL. Actions push the hash for the state they
   asked for, so links are shareable and the back button walks the
   views; a hash on load opens its view once the entrance has run. */
function stateHash() {
  const top = sheets.find(sheetOpen);
  if (top) return top.hash;
  if (state.targetPage === "project" && state.targetProject) return `#${state.targetProject.dataset.project}`;
  if (state.targetPage === "grid") return "#grid";
  return "";
}

function syncHash() {
  const hash = stateHash();
  if (routeHash() === hash) return;
  navigate(hash);
}

function applyRoute({ direct = false } = {}) {
  const hash = routeHash();
  const sheet = sheets.find((s) => s.hash === hash);
  if (sheet) {
    openSheet(sheet);
    syncCurrent();
    return;
  }
  closeSheets();
  if (hash === "#grid") {
    goTo("grid", { direct });
    return;
  }
  const row = rows.find((r) => `#${r.dataset.project}` === hash);
  if (row) {
    goTo("project", { row, keep: !direct && state.targetPage === "index", direct });
    return;
  }
  goTo("index", { keep: state.targetPage === "project" });
}

window.addEventListener("popstate", () => applyRoute());

// The project page is built for its layout (the row, the filmstrip, the
// feed). Crossing a breakpoint with one open, a rotation or a resized
// window, builds it again for the new one.
let relayPending = false;
function relayProject() {
  if (relayPending) return;
  relayPending = true;
  requestAnimationFrame(() => {
    relayPending = false;
    if (state.currentPage !== "project" || !getCurrentProject()) return;
    if (state.transitioning) {
      setTimeout(relayProject, 250);
      return;
    }
    const row = getCurrentProject();
    pageDefs.project.hide();
    pageDefs.project.arrive({ row });
    void document.body.offsetWidth;
    pageDefs.project.enter({ row });
  });
}
phoneLayout.addEventListener("change", relayProject);
uprightLayout.addEventListener("change", relayProject);

export { applyRoute };

/* Hook assignment: feature modules call back into the page machine. */
hooks.goTo = goTo;
hooks.syncHash = syncHash;
hooks.syncCurrent = syncCurrent;
hooks.syncLayers = syncLayers;
hooks.closeSheets = closeSheets;
hooks.anySheetOpen = () => sheets.some(sheetOpen);
hooks.afterSheetClose = () => {
  if (
    state.currentPage === "project" &&
    state.targetPage === "project" &&
    !state.transitioning &&
    !sheets.some(sheetOpen)
  )
    sweepHeaderLine();
};
