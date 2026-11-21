/* ---------------------------------------------------------------------------
   Standalone adapter
   The template was written for a host that supplied URL and form hooks.
   These route clean URLs (/about, /grid, /contact, /projects/<slug>) to the
   template's own hash-based views and keep the back button working.
   --------------------------------------------------------------------------- */
(function () {
  const projectPath = (slug) => "/projects/" + slug;

  window.__pathFor = (hash) => {
    if (!hash || hash === "#" || hash === "#index") return "/";
    if (hash === "#about") return "/about";
    if (hash === "#grid") return "/grid";
    if (hash === "#contact") return "/contact";
    return projectPath(hash.slice(1));
  };

  window.__routeHash = () => {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/about") return "#about";
    if (path === "/grid") return "#grid";
    if (path === "/contact") return "#contact";
    const project = path.match(/^\/projects\/([^/]+)$/);
    return project ? "#" + project[1] : "";
  };

  const titleFor = (hash) => {
    if (!hash) return "Dylan Calluy — Photographer";
    if (hash === "#about") return "About — Dylan Calluy";
    if (hash === "#grid") return "Grid — Dylan Calluy";
    if (hash === "#contact") return "Contact — Dylan Calluy";
    const row = document.querySelector('.project[data-project="' + hash.slice(1) + '"] .project__name');
    return row ? row.textContent.trim() + " — Dylan Calluy" : "Dylan Calluy — Photographer";
  };

  window.__navigate = (hash) => {
    const path = window.__pathFor(hash);
    if (location.pathname !== path) history.pushState(null, "", path);
    document.title = titleFor(hash);
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.title = titleFor(window.__routeHash());
  });
  window.addEventListener("popstate", () => {
    document.title = titleFor(window.__routeHash());
  });

  // The template asks for a scaled variant; the bundle ships the full files.
  window.__sized = (url) => url || "";
  window.__photoSize = () => 1024;

  // The visible form is validated by the template; the success line is shown
  // here. Wire a real endpoint by listening for the contact:submit event.
  window.__sendForm = (form, fields) => {
    const send = form.querySelector(".contact__send");
    const note = form.querySelector(".contact__note");
    const detail = Object.fromEntries(fields.map((field) => [field.name, field.value]));
    form.classList.add("is-sent");
    if (send) {
      send.hidden = true;
      send.disabled = true;
    }
    if (note) note.hidden = false;
    form.dispatchEvent(new CustomEvent("contact:submit", { bubbles: true, detail }));
  };
})();

/* media.js — tiles can hold an <img> or a <video>.
   One small layer shared by the index (script.js) and, later, the
   project page, so nothing else has to know which it is.

   Markup convention for a video tile:
     <figure class="tile">
       <video src="assets/clip.mp4" poster="assets/clip.jpg"
              muted loop playsinline preload="none"></video>
     </figure>
   Muted + playsinline is what lets a page start it without a tap; script.js starts it once its project shows. The poster is
   the frame that shows until the clip is ready (and in the preloader,
   which only cycles images). */
window.Media = (() => {
  const SELECTOR = "img, video";
  const isVideo = (el) => el.tagName === "VIDEO";

  // Resolves once the element can paint: a decoded image or a video
  // with its first frame. Never rejects, and never waits longer than
  // `cap`, so a slow network can't hold a page.
  function ready(el, cap = 2000) {
    let wait;
    if (isVideo(el)) {
      wait =
        el.readyState >= 2
          ? Promise.resolve()
          : new Promise((resolve) => {
              el.addEventListener("loadeddata", resolve, { once: true });
              el.addEventListener("error", resolve, { once: true });
            });
    } else {
      wait = el.decode ? el.decode().catch(() => {}) : Promise.resolve();
    }
    return Promise.race([wait, new Promise((r) => setTimeout(r, cap))]);
  }

  // Natural size, for fitting a frame to the media's own ratio.
  function size(el) {
    if (isVideo(el)) return { width: el.videoWidth, height: el.videoHeight };
    return { width: el.naturalWidth, height: el.naturalHeight };
  }

  // A copy for an expanded view. It starts on the tile's own (already
  // decoded) file so nothing blanks; if the tile names a larger file in
  // data-full, that one is swapped in once it has decoded. A video copy
  // picks up from the same moment as the tile.
  function clone(el) {
    const copy = el.cloneNode();
    copy.removeAttribute("loading");
    if (isVideo(el)) {
      copy.muted = true;
      copy.currentTime = el.currentTime;
      copy.play().catch(() => {});
    } else if (el.dataset.full) {
      const full = new Image();
      full.src = el.dataset.full;
      full.decode().then(() => {
        if (copy.isConnected) copy.src = el.dataset.full;
      }).catch(() => {});
    }
    return copy;
  }

  const play = (v) => v.play().catch(() => {});
  const pause = (v) => v.pause();

  // Play the videos inside `container`, pause the rest of `others`.
  function playWithin(container, others = []) {
    others.forEach((o) => o !== container && o.querySelectorAll("video").forEach(pause));
    if (container) container.querySelectorAll("video").forEach(play);
  }

  // Videos under `container` play only while on screen (in `root`, or
  // the viewport). Returns a stop function.
  function playWhenVisible(container, root = null) {
    const videos = Array.from(container.querySelectorAll("video"));
    if (!videos.length) return () => {};
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => (e.isIntersecting ? play : pause)(e.target)),
      { root, threshold: 0.01 }
    );
    videos.forEach((v) => io.observe(v));
    return () => {
      io.disconnect();
      videos.forEach(pause);
    };
  }

  return { SELECTOR, isVideo, ready, size, clone, playWithin, playWhenVisible };
})();

const page = document.querySelector(".page");
const list = document.getElementById("projects");
const gallery = document.getElementById("gallery");
const count = document.getElementById("project-count");

const rows = Array.from(list.querySelectorAll(".project"));
const sets = new Map(
  Array.from(gallery.querySelectorAll(".gallery__set")).map((set) => [
    set.dataset.project,
    set,
  ])
);
const defaultRow = rows[0];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// Mark the page as entering right away so the entrance timings are in
// place before the first paint; each row gets its index for the stagger.
page.classList.add("is-entering");
page.inert = true; // nothing to click until the page is showing: its links are there, invisible, under the preloader
// Each row and its image set get their index (the entrance stagger).
rows.forEach((row, i) => {
  const set = sets.get(row.dataset.project);
  [row, set].forEach((el) => {
    if (!el) return;
    el.style.setProperty("--i", i);
  });
});

/* ---------- Active row + gallery set ---------- */
let activeRow = null;
let indexShowing = true; // the index's videos only run while it is on screen

function setActive(row) {
  if (!row || row === activeRow) return; // no projects yet: nothing to show
  activeRow = row;

  rows.forEach((r) => r.classList.toggle("is-active", r === row));
  sets.forEach((set, key) =>
    set.classList.toggle("is-active", key === row.dataset.project)
  );
  // Only the visible set's videos run.
  if (indexShowing) Media.playWithin(sets.get(row.dataset.project), [...sets.values()]);
}

const touchLayout = window.matchMedia("(max-width: 1100px)");
const phoneLayout = window.matchMedia("(max-width: 600px)");
const hoverInput = window.matchMedia("(hover: hover)");
// Where nothing can hover, one project shows at a time and the index moves
// on by itself (see Autoplay): the phone, and a tablet. A narrow window
// with a mouse keeps the desktop's hover.
const autoplayLayout = () => phoneLayout.matches || (touchLayout.matches && !hoverInput.matches);
// A tablet held upright has room for one photo at a time, on the index and
// on a project.
const uprightLayout = window.matchMedia("(min-width: 601px) and (max-width: 1100px) and (orientation: portrait)");
// Upright, a project of one landscape shows whole, across the whole row.
const wideSingle = (data) => uprightLayout.matches && data.media.length === 1 && data.media[0].o === "l";

rows.forEach((row) => {
  row.addEventListener("mouseenter", () => setActive(row));
  // Keyboard parity: focusing a row reveals its images.
  row.addEventListener("focus", () => setActive(row));
});

// Revert to the first project when the pointer leaves the list — unless
// a project page is open over it, whose tile the set underneath must
// keep matching.
const projectOpen = () => currentProject && !projectPanel.hidden;
// Where the index advances by itself the slider owns the active row (taps
// fire mouse events too).
list.addEventListener("mouseleave", () => {
  if (!projectOpen() && !autoplayLayout()) setActive(defaultRow);
});

// Revert when keyboard focus leaves the list entirely.
list.addEventListener("focusout", (e) => {
  if (!list.contains(e.relatedTarget) && !projectOpen() && !autoplayLayout()) setActive(defaultRow);
});

// Resting state: project 01 selected with its images shown.
setActive(defaultRow);

/* ---------- Surfaces ----------
   Two kinds, each with one behaviour.

   Pages — index, grid, project — replace each other. Every change is
   the same three beats: the current page's content leaves (a quick
   fade, nothing moves), a short hold on empty paper under the rule,
   then the new page arrives the way the site does on load (hairlines
   drawing, text a beat behind, media wiping top-down). The header and
   the main rule never move. The one exception: a photo already on
   screen where the next page needs it stays put while everything
   around it changes (index ⇄ project).

   Sheets — About, Contact — lay over the current page with the frost
   fade and return you to exactly where you were. */
const FADE_MS = 450; // sheets: matches --dur-fade
const EXIT_MS = 300; // pages: content leaving
const HOLD_MS = 120; // pages: empty paper between leaving and arriving
const SINK_MS = 500; // the project header line leaving, per word (styles.css)
const SINK_STAGGER = 40; // per word, in reading order
const navProjects = document.getElementById("nav-projects");
const navGrid = document.getElementById("nav-grid");
const mainArea = document.querySelector(".main");
const gridPanel = document.getElementById("grid");
const projectPanel = document.getElementById("project");
const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion.matches ? 0 : ms));

/* ----- Sheets ----- */
const sheets = [
  { panel: document.getElementById("about"), link: document.getElementById("nav-about"), hash: "#about" },
  { panel: document.getElementById("contact"), link: document.getElementById("nav-contact"), hash: "#contact" },
];
[...sheets.map((s) => s.panel), gridPanel, projectPanel].forEach((el) => (el.tabIndex = -1));
const sheetOpen = (s) => !s.panel.hidden && !s.panel.classList.contains("is-closing");

function openSheet(sheet) {
  sheets.forEach((s) => s !== sheet && closeSheet(s));
  const { panel, link } = sheet;
  // Asked back while it fades away (a quick switch, back then forward).
  if (panel.classList.contains("is-closing")) {
    clearTimeout(sheet.closeTimer);
    panel.classList.remove("is-closing");
    link.setAttribute("aria-expanded", "true");
    panel.focus({ preventScroll: true });
    syncCurrent();
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
  syncCurrent();
}

function closeSheet(sheet) {
  const { panel, link } = sheet;
  if (panel.hidden || panel.classList.contains("is-closing")) return;
  panel.classList.add("is-closing");
  link.setAttribute("aria-expanded", "false");
  syncLayers();
  const opener = sheet.opener;
  sheet.opener = null;
  if (opener && opener.isConnected && (panel.contains(document.activeElement) || document.activeElement === document.body)) {
    opener.focus({ preventScroll: true });
  }
  sheet.closeTimer = setTimeout(() => {
    panel.hidden = true;
    panel.classList.remove("is-closing", "is-open"); // reset for next open
  }, FADE_MS);
  syncCurrent();
  // Back on a project, its header line sweeps in as the sheet fades. Checked
  // once the caller is done: it may be leaving the project, or opening
  // another sheet.
  queueMicrotask(() => {
    if (currentPage === "project" && targetPage === "project" && !transitioning && !sheets.some(sheetOpen)) sweepHeaderLine();
  });
}

function sweepHeaderLine() {
  const line = [headerProject, headerMeta];
  line.forEach((el) => el.classList.add("is-arriving"));
  void headerMeta.offsetWidth;
  line.forEach((el) => {
    el.classList.replace("is-arriving", "is-entering");
    endSweep(el);
  });
}

// A header sweep's classes come off when its last rise ends (1.19s). A
// newer sweep takes over the timer, so an older one can't cut it short.
const sweepTimers = new Map();
function endSweep(el) {
  clearTimeout(sweepTimers.get(el));
  sweepTimers.set(el, setTimeout(() => el.classList.remove("is-entering"), 1300));
}

// What's under the page on screen: the index can't be reached by Tab or
// pointer behind a project, the grid or a sheet, and its videos rest.
const indexPanel = document.querySelector(".index");
function syncLayers() {
  const showing = currentPage === "index";
  const covered = !showing || sheets.some(sheetOpen);
  indexPanel.inert = covered;
  gallery.inert = covered;
  if (showing === indexShowing) return;
  indexShowing = showing;
  if (showing) {
    if (activeRow) Media.playWithin(sets.get(activeRow.dataset.project), [...sets.values()]);
  } else {
    gallery.querySelectorAll("video").forEach((v) => v.pause());
  }
}

const closeSheets = () => sheets.forEach(closeSheet);

/* ----- Pages ----- */
let currentPage = "index";  // what is on screen (or leaving)
let targetPage = "index";   // what the last action asked for
let targetProject = null;   // the row, when targetPage is "project"
let transitioning = false;
let queued = null;          // the latest request made mid-transition
let indexOpener = null;     // the control that left the index, refocused on return
let gridCleanup = () => {};

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
      if (ctx.keep && activeRow) {
        // The stage hands one photo back; the carousel a pair whole.
        const tiles = sets.get(activeRow.dataset.project).querySelectorAll(".tile");
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
      const opener = rows.includes(indexOpener) ? activeRow : indexOpener;
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
      gridCleanup();
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
      if (ctx.keep && currentProject) setActive(currentProject);
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
        buildCarousel(currentProject, { keep: ctx.keep, settled: !!ctx.continued && !ctx.handoff, handoff: ctx.handoff });
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
        buildFeed(currentProject);
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
      feedCleanup();
      unloadProject();
      projectPanel.hidden = true;
      projectPanel.classList.remove("is-open", "is-leaving", "is-keeping", "is-switching");
    },
  },
};

// Change page. ctx: { row } for a project, { keep } when a photo on
// screen is carried across. A request during a transition runs after it.
async function goTo(name, ctx = {}) {
  targetPage = name;
  targetProject = name === "project" ? ctx.row : null;
  if (transitioning) {
    queued = [name, ctx];
    return;
  }
  if (name === currentPage && (name !== "project" || ctx.row === currentProject)) return;
  transitioning = true;
  syncAutoplay();
  const from = currentPage;
  const switching = from === "project" && name === "project";
  ctx = { ...ctx, switching, from, to: name };
  // A photo is carried across only between the index and a project, where
  // the page and the gallery tile share a frame (not on the phone). With the
  // carousel both ways keep it: in, the row glides to column 1; back, it
  // rewinds onto the index tile. Upright, the index crops a landscape into
  // its one tile, so that photo has no same spot to go to.
  const shown = ctx.row || currentProject || defaultRow;
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

  currentPage = name;
  pageDefs[name].arrive(ctx);
  if (!switching && from !== name && pageDefs[from].hide) pageDefs[from].hide();
  // The index underneath comes back to full once it is covered (with a
  // kept photo, once the stage tile has landed — see project.enter).
  if (from === "index" && name !== "index" && !keep) mainArea.classList.remove("is-leaving", "is-keeping", "is-keeping-all", "is-losing-rule");
  void document.body.offsetWidth; // commit the arriving states
  syncLayers();
  pageDefs[name].enter(ctx);
  syncCurrent();

  transitioning = false;
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
  const link = top ? top.link : targetPage === "grid" ? navGrid : navProjects;
  link.setAttribute("aria-current", "page");
  navGrid.setAttribute("aria-expanded", String(targetPage === "grid"));
  syncLayers();
  syncAutoplay();
}

/* ---------- Autoplay ----------
   On the phone and a tablet the index shows one project at a time and moves
   on by itself. While .is-autoplay is on the page, the active row's line fills
   over --slide-ms (styles.css); when that animation ends the next
   project becomes active, which starts the line again on its row. It
   runs only on the settled index: no sheet open, no page change under
   way, the tab visible, motion allowed. Switching it off removes the
   line's animation; switching it back on starts the line from zero. */
function syncAutoplay() {
  const on =
    autoplayLayout() &&
    !reduceMotion.matches &&
    page.classList.contains("is-loaded") &&
    currentPage === "index" &&
    !transitioning &&
    !sheets.some(sheetOpen) &&
    document.visibilityState === "visible";
  page.classList.toggle("is-autoplay", on);
}

list.addEventListener("animationend", (e) => {
  if (e.animationName !== "slide-progress" || !activeRow) return;
  setActive(rows[(rows.indexOf(activeRow) + 1) % rows.length]);
  // A list longer than the gallery scrolls: keep the active row in it.
  if (!phoneLayout.matches) {
    const [row, box] = [activeRow.getBoundingClientRect(), list.getBoundingClientRect()];
    if (row.top < box.top) list.scrollTop = 0;
    else if (row.bottom > box.bottom) list.scrollTop += row.bottom - box.bottom;
  }
});

document.addEventListener("visibilitychange", syncAutoplay);
[phoneLayout, touchLayout, hoverInput].forEach((mq) => mq.addEventListener("change", syncAutoplay));
reduceMotion.addEventListener("change", syncAutoplay);

// Tapping the tiles on touch sizes opens the project they show.
gallery.addEventListener("click", (e) => {
  if (!touchLayout.matches || currentPage !== "index" || transitioning) return;
  if (!activeRow) return;
  goTo("project", { row: activeRow, keep: true });
  syncHash();
});

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
    if (targetPage !== "grid") goTo("grid");
  } else if (targetPage === "grid") {
    goTo("index");
  } else {
    goTo("grid");
  }
  syncHash();
});

navProjects.addEventListener("click", (e) => {
  e.preventDefault();
  closeSheets();
  goTo("index", { keep: targetPage === "project" });
  syncHash();
});

// Escape peels off the top layer: an expanded photo, then an open sheet,
// then the page (back to the index).
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (sheets.some(sheetOpen)) {
    closeSheets();
  } else if (expandedPhoto) {
    collapsePhoto(false);
    return;
  } else if (targetPage !== "index") {
    goTo("index", { keep: targetPage === "project" });
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
  if (targetPage === "project" && targetProject) return `#${targetProject.dataset.project}`;
  if (targetPage === "grid") return "#grid";
  return "";
}

function syncHash() {
  const hash = stateHash();
  if (__routeHash() === hash) return;
  __navigate(hash);
}

function applyRoute({ direct = false } = {}) {
  const hash = __routeHash();
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
    goTo("project", { row, keep: !direct && targetPage === "index", direct });
    return;
  }
  goTo("index", { keep: targetPage === "project" });
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
    if (currentPage !== "project" || !currentProject) return;
    if (transitioning) {
      setTimeout(relayProject, 250);
      return;
    }
    const row = currentProject;
    pageDefs.project.hide();
    pageDefs.project.arrive({ row });
    void document.body.offsetWidth;
    pageDefs.project.enter({ row });
  });
}
phoneLayout.addEventListener("change", relayProject);
uprightLayout.addEventListener("change", relayProject);

/* Contact form: no backend yet. A field left empty or an invalid email
   is marked (solid hairline, black label) and focused; a complete form
   swaps SEND for the thank-you line. */
const contactForm = document.getElementById("contact-form");
contactForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const fields = Array.from(contactForm.querySelectorAll(".field__input"));
  fields.forEach((f) => f.closest(".field").classList.toggle("is-invalid", !f.checkValidity()));
  const first = fields.find((f) => !f.checkValidity());
  if (first) {
    first.focus();
    return;
  }
  __sendForm(contactForm, fields);
});
contactForm.addEventListener("input", (e) => {
  e.target.closest(".field").classList.remove("is-invalid");
});

/* Grid: MONO drains the sheet to greyscale and back. The label never
   changes; its colour shows the state (aria-pressed in CSS). The button
   is only shown while the grid is open and is kept out of the tab order
   while hidden. */
const monoButton = document.getElementById("nav-mono");
monoButton.addEventListener("click", () => {
  const on = gridPanel.classList.toggle("is-mono");
  monoButton.setAttribute("aria-pressed", String(on));
});

/* Grid: tiles fade in as they scroll into view. On open, the tiles
   already on screen get a stagger through --i; later ones arrive as the
   user scrolls. */
/* The sheet is shuffled on every load: the figures are put back into
   the container in a new random order, so the reveal stagger, the
   expanded view's arrow keys and the DOM all follow the same order. */
const photosBox = document.getElementById("photos");
const photos = Array.from(photosBox.querySelectorAll(".photo"));
for (let i = photos.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [photos[i], photos[j]] = [photos[j], photos[i]];
}
photos.forEach((photo) => photosBox.appendChild(photo));

/* Contact-sheet placement. Each row lists the columns its tiles start
   on — the six two-column slots (1, 3, 5, 7, 9, 11); the slots left out
   are the gaps that give the sheet its rhythm. A tile's shape comes from
   its own photo (data-orient): portrait 470:631, landscape 945:631, the
   site's two ratios. The pattern repeats for as many photos as there are. */
const SHEET = [
  [1, 3, 7, 11],
  [1, 3, 7, 9, 11],
  [1, 5, 7, 11],
  [3, 5, 9, 11],
  [1, 3, 7, 11],
  [1, 5, 9],
];

(function placePhotos() {
  let row = 0;
  let slot = 0;
  photos.forEach((photo) => {
    const pattern = SHEET[row % SHEET.length];
    photo.style.setProperty("--c", pattern[slot]);
    photo.style.setProperty("--r", row + 1);
    photo.dataset.slot = slot; // position in its row, for the scroll-in stagger
    photo.tabIndex = 0;
    photo.setAttribute("role", "button");
    photo.setAttribute("aria-label", "Expand photo");
    photo.classList.toggle("photo--landscape", photo.dataset.orient === "l");
    slot += 1;
    if (slot >= pattern.length) {
      slot = 0;
      row += 1;
    }
  });
})();

// The grid view covers the whole page; its content starts where the main
// area starts, so it needs the header's current height (it flexes with
// the viewport). On a tablet the spare height above the rule belongs to the
// index alone: the pages that open start under the header.
const mainTop = () => (touchLayout.matches && !phoneLayout.matches ? document.querySelector(".header").offsetHeight : mainArea.offsetTop);
function syncMainTop() {
  page.style.setProperty("--main-top", `${mainTop()}px`);
  page.style.setProperty("--line-drop", `${mainArea.offsetTop - mainTop()}px`);
}
window.addEventListener("resize", syncMainTop);

function revealPhotos() {
  syncMainTop();
  photos.forEach((p) => {
    p.classList.remove("is-in");
    p.style.removeProperty("--lead"); // the opening's beat again
  });
  const gridView = document.getElementById("grid");
  gridView.scrollTop = 0;
  void gridView.offsetWidth; // commit the hidden state so the reveal runs

  // The first screen is revealed right away with a stagger, in reading
  // order, without waiting on the observer.
  const bottom = gridView.getBoundingClientRect().bottom;
  const pending = new Set(photos);
  let order = 0;
  photos.forEach((p) => {
    if (p.getBoundingClientRect().top < bottom) {
      p.style.setProperty("--i", order++);
      p.classList.add("is-in");
      pending.delete(p);
    }
  });

  // Everything below arrives on its own as it scrolls into view, once a
  // tile is a little way past the bottom edge; tiles in the same row
  // cascade left to right. On touch sizes, where a flick travels far and
  // the rows are plain (two or three across, in order), a tile starts as
  // soon as it shows, without the opening's beat, so the sheet never
  // trails the finger with empty rows.
  const touch = touchLayout.matches;
  const perRow = phoneLayout.matches ? 2 : 3;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const p = entry.target;
        p.style.setProperty("--i", touch ? photos.indexOf(p) % perRow : p.dataset.slot);
        if (touch) p.style.setProperty("--lead", "0ms");
        p.classList.add("is-in");
        io.unobserve(p);
      });
    },
    touch
      ? { root: gridView, threshold: 0.05 }
      : { root: gridView, rootMargin: "0px 0px -10% 0px", threshold: 0.15 }
  );
  pending.forEach((p) => io.observe(p));
  const stopVideos = Media.playWhenVisible(gridView, gridView);
  gridCleanup = () => {
    io.disconnect();
    stopVideos();
    collapsePhoto(true);
    gridCleanup = () => {};
  };
}

/* ---------- Grid: expanded photo ----------
   A click lifts a copy of the tile's image into a fixed frame that moves
   to the centre and grows to the photo's full frame; a click anywhere,
   Escape, or leaving the grid sends it back. The copy travels on the
   soft in-out curve; the sheet behind it blurs and fades (styles.css). */
const EXPAND_MS = 600;
const EXPAND_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";
// EXPAND_EASE as a function, for a scroll that runs alongside a flight.
function cubicBezier(x1, y1, x2, y2) {
  const bez = (a, b) => (t) => ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
  const bx = bez(x1, x2);
  const by = bez(y1, y2);
  return (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = bx(t) - x;
      const slope = 3 * (1 - 3 * x2 + 3 * x1) * t * t + 2 * (3 * x2 - 6 * x1) * t + 3 * x1;
      if (Math.abs(d) < 1e-5 || Math.abs(slope) < 1e-6) break;
      t -= d / slope;
    }
    return by(Math.max(0, Math.min(1, t)));
  };
}
const expandEase = cubicBezier(0.65, 0, 0.35, 1);
const MARGIN = 10;
const GUTTER = 4;
const lightbox = document.createElement("div");
lightbox.className = "lightbox";
lightbox.hidden = true;
gridPanel.appendChild(lightbox);
let expandedPhoto = null;

const px = (n) => `${n}px`;
const rectFrame = (r) => ({ left: px(r.left), top: px(r.top), width: px(r.width), height: px(r.height) });

// The photo's frame: the site's two tile ratios only — a portrait in the
// 470:631 frame, a landscape in the 945:631 one (the photo is cropped to
// fit, as in the tiles) — at most 8 columns wide and the gallery's
// height, centred on the page both ways. On touch sizes (≤ 1100px) it
// uses the full width and centres under the sticky header.
const TOUCH_MAX = 1100;
const PORTRAIT = 470 / 631;
const LANDSCAPE = 945 / 631;
function expandedRect(media) {
  const touch = window.innerWidth <= TOUCH_MAX;
  const headerH = mainTop();
  const maxH = window.innerHeight - 2 * MARGIN - headerH;
  const col = (window.innerWidth - 2 * MARGIN - 11 * GUTTER) / 12;
  const maxW = touch ? window.innerWidth - 2 * MARGIN : col * 8 + 7 * GUTTER;
  // A lazy photo may not have loaded yet: its tile knows its shape.
  const natural = Media.size(media);
  const photo = media.closest(".photo");
  const wide = natural.width && natural.height ? natural.width > natural.height : !!photo && photo.dataset.orient === "l";
  const ratio = wide ? LANDSCAPE : PORTRAIT;
  let width = maxW;
  let height = width / ratio;
  if (height > maxH) {
    height = maxH;
    width = height * ratio;
  }
  const top = touch ? headerH + (window.innerHeight - headerH - height) / 2 : (window.innerHeight - height) / 2;
  return { left: (window.innerWidth - width) / 2, top, width, height };
}

function expandPhoto(photo) {
  if (expandedPhoto || gridPanel.classList.contains("is-collapsing")) return;
  const media = photo.querySelector(Media.SELECTOR);
  const from = media.getBoundingClientRect();
  const to = expandedRect(media);
  const copy = Media.clone(media);
  lightbox.replaceChildren(copy);
  Object.assign(lightbox.style, rectFrame(from));
  lightbox.hidden = false;
  expandedPhoto = photo;
  photo.classList.add("is-source");
  gridPanel.classList.add("is-expanded");
  const timing = { duration: reduceMotion.matches ? 0 : EXPAND_MS, easing: EXPAND_EASE, fill: "forwards" };
  lightbox.animate([rectFrame(from), rectFrame(to)], timing);
}

function collapsePhoto(instant) {
  if (!expandedPhoto) return;
  const photo = expandedPhoto;
  expandedPhoto = null;
  gridPanel.classList.remove("is-expanded");
  const finish = () => {
    // The tile appears and the copy goes in the same frame — no fade
    // between them, so nothing can scroll one away from the other.
    photo.classList.add("is-landing"); // reveal without a transition
    photo.classList.remove("is-source");
    void photo.offsetWidth;
    if (!expandedPhoto) {
      lightbox.hidden = true;
      lightbox.replaceChildren(); // a video copy would play on unseen
    }
    gridPanel.classList.remove("is-collapsing");
    requestAnimationFrame(() => photo.classList.remove("is-landing"));
  };
  if (instant || reduceMotion.matches) {
    lightbox.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    lightbox.hidden = true;
    lightbox.replaceChildren();
    photo.classList.remove("is-source");
    return;
  }
  gridPanel.classList.add("is-collapsing");
  const from = lightbox.getBoundingClientRect();
  const source = photo.querySelector(Media.SELECTOR);
  let to = source.getBoundingClientRect();
  lightbox.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  // Only the visible (topmost) image flies back; anything left stacked
  // under it by an interrupted step goes now.
  const copies = Array.from(lightbox.children);
  const copy = copies[copies.length - 1];
  copies.slice(0, -1).forEach((el) => el.remove());
  const timing = { duration: EXPAND_MS, easing: EXPAND_EASE, fill: "forwards" };
  // After stepping, the tile may be off screen. On desktop the sheet
  // comes to meet the photo (below); on touch sizes the frame fades out
  // where it is and the sheet lands on that tile under the blur.
  const offScreen = to.bottom < 0 || to.top > window.innerHeight;
  if (offScreen && touchLayout.matches) {
    photo.scrollIntoView({ block: "center" });
    to = source.getBoundingClientRect();
    const back = lightbox.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: "ease", fill: "forwards" });
    back.onfinish = finish;
    return;
  }
  if (offScreen) {
    // The sheet scrolls to bring the tile to the centre while the photo
    // flies to it — on the flight's own curve and
    // duration, so the two arrive together. A tile that has not yet
    // been revealed (it would rise 24px as it came into view) is settled
    // in place first, so the photo lands where the tile will be.
    if (!photo.classList.contains("is-in")) {
      photo.classList.add("is-settled", "is-in");
      void photo.offsetWidth;
      photo.classList.remove("is-settled");
      to = source.getBoundingClientRect();
    }
    const gridView = document.getElementById("grid");
    const startTop = gridView.scrollTop;
    const viewTop = gridView.getBoundingClientRect().top;
    const centred = (window.innerHeight - to.height) / 2;
    const endTop = Math.max(0, Math.min(gridView.scrollHeight - gridView.clientHeight, startTop + to.top - viewTop - (centred - viewTop)));
    to = { left: to.left, top: to.top - (endTop - startTop), width: to.width, height: to.height };
    const t0 = performance.now();
    const scrollStep = (now) => {
      const p = Math.min(1, (now - t0) / EXPAND_MS);
      gridView.scrollTop = startTop + (endTop - startTop) * expandEase(p);
      if (p < 1 && gridPanel.classList.contains("is-collapsing")) requestAnimationFrame(scrollStep);
    };
    requestAnimationFrame(scrollStep);
  }
  // The frame shrinks onto the tile, the photo as the tile shows it.
  const back = lightbox.animate([rectFrame(from), rectFrame(to)], timing);
  back.onfinish = finish;
}

// The arrow keys and the wheel step the expanded photo through the
// sheet: the frame glides to the next photo's size while the image
// crossfades inside it. The sheet behind holds still; the return flight
// deals with a tile that has gone off screen (see collapsePhoto).
const STEP_MS = 700;
function stepExpanded(dir) {
  if (!expandedPhoto || gridPanel.classList.contains("is-collapsing")) return;
  const next = photos[(photos.indexOf(expandedPhoto) + dir + photos.length) % photos.length];
  const media = next.querySelector(Media.SELECTOR);
  const previous = expandedPhoto;
  expandedPhoto = next;
  previous.classList.remove("is-source");
  next.classList.add("is-source");
  // Focus follows the photo on show, so closing lands the keyboard on it.
  next.focus({ preventScroll: true });

  const from = lightbox.getBoundingClientRect();
  const to = expandedRect(media);
  lightbox.getAnimations().forEach((a) => a.cancel());
  Object.assign(lightbox.style, rectFrame(from));
  const timing = { duration: reduceMotion.matches ? 0 : STEP_MS, easing: EXPAND_EASE, fill: "forwards" };
  lightbox.animate([rectFrame(from), rectFrame(to)], timing);

  const old = Array.from(lightbox.children);
  const copy = Media.clone(media);
  lightbox.appendChild(copy);
  copy.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduceMotion.matches ? 0 : FADE_MS, easing: "ease", fill: "forwards" }).onfinish = () => {
    old.forEach((el) => el.remove());
  };
}

// The expanded photo follows a resize or a rotation.
window.addEventListener("resize", () => {
  if (!expandedPhoto || gridPanel.classList.contains("is-collapsing")) return;
  lightbox.getAnimations().forEach((a) => a.cancel());
  Object.assign(lightbox.style, rectFrame(expandedRect(expandedPhoto.querySelector(Media.SELECTOR))));
});

// By keyboard: Enter or Space on a tile expands it.
gridPanel.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const photo = e.target.closest(".photo");
  if (!photo || expandedPhoto) return;
  e.preventDefault();
  expandPhoto(photo);
});

document.addEventListener("keydown", (e) => {
  if (!expandedPhoto || sheets.some(sheetOpen)) return;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    e.preventDefault();
    stepExpanded(1);
  }
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    e.preventDefault();
    stepExpanded(-1);
  }
});

// Touch: while a photo is expanded the sheet holds still (styles.css,
// touch-action), a sideways swipe steps to the previous or next photo and
// a swipe down closes it; a tap closes it too (the click below).
let lightboxSwipe = null;
let lightboxSwiped = 0;
gridPanel.addEventListener("pointerdown", (e) => {
  if (!expandedPhoto || e.pointerType === "mouse") return;
  lightboxSwipe = { x: e.clientX, y: e.clientY };
});
gridPanel.addEventListener("pointerup", (e) => {
  const start = lightboxSwipe;
  lightboxSwipe = null;
  if (!start || !expandedPhoto) return;
  const dx = e.clientX - start.x;
  const dy = e.clientY - start.y;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
    stepExpanded(dx < 0 ? 1 : -1); // swipe left: the next photo
    lightboxSwiped = performance.now();
  } else if (dy > 60 && dy > Math.abs(dx)) {
    collapsePhoto(false);
    lightboxSwiped = performance.now();
  }
});
gridPanel.addEventListener("pointercancel", () => (lightboxSwipe = null));

gridPanel.addEventListener("click", (e) => {
  if (performance.now() - lightboxSwiped < 500) return; // the swipe's own click
  if (expandedPhoto) {
    collapsePhoto(false);
    return;
  }
  const photo = e.target.closest(".photo");
  if (photo) expandPhoto(photo);
});

// The wheel steps the expanded photo by distance, like the arrow keys:
// every SCROLL_STEP px of travel is one photo, at most one every
// SCROLL_GAP ms, so a long scroll runs through several and a short one
// moves one. Either axis counts (a trackpad swipe sideways or a wheel).
const SCROLL_STEP = 100;
const SCROLL_GAP = 160;
const scroll = { acc: 0, at: 0, stepped: 0 };
function scrollExpanded(delta, now) {
  if (now - scroll.at > 200) scroll.acc = 0; // a fresh gesture starts clean
  scroll.at = now;
  scroll.acc += delta;
  if (Math.abs(scroll.acc) < SCROLL_STEP || now - scroll.stepped < SCROLL_GAP) return;
  stepExpanded(Math.sign(scroll.acc));
  scroll.acc = 0;
  scroll.stepped = now;
}

// While a photo is expanded the sheet holds still: the wheel is taken
// here (rather than by overflow: hidden, so the browser keeps the
// gesture on the sheet) and steps the photo; while the photo flies back
// the sheet waits for it to land. A click or Escape closes.
gridPanel.addEventListener("wheel", (e) => {
  if (gridPanel.classList.contains("is-collapsing")) {
    e.preventDefault();
    return;
  }
  if (!expandedPhoto) return;
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerWidth : 1;
  scrollExpanded((Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit, e.timeStamp);
}, { passive: false });

/* ---------- Project page ----------
   Opened by an index row. Builds the filmstrip from #project-media,
   shows one media at a time on the stage (a portrait in the left half
   tile, a landscape across the full width), NEXT steps to the next
   project, arrow keys step the media. */
const PROJECT_MEDIA = __data.media;
const strip = document.getElementById("project-strip");
const stage = document.getElementById("project-stage");
const headerProject = document.getElementById("header-project");
const headerMeta = document.getElementById("header-meta");
const projectTitle = document.getElementById("project-title");
const projectYear = document.getElementById("project-year");
const projectNext = document.getElementById("project-next");
const projectNextName = document.getElementById("project-next-name");
const projectBack = document.getElementById("project-back");
let currentProject = null; // the row
let currentIndex = 0;
let stageTile = null;

// Each item in #project-media is { img: "media/<folder>/<name>" } (the
// stage uses its -2000 copy, the filmstrip its -800 one) or { video,
// poster } with full paths. Built by tools/build-media.py.
const mediaSrc = (item) => (item.img ? __sized(item.img, 1024) : item.poster);

// A portrait at tile size is ~470px wide: 1400px covers it on a retina
// screen; landscapes (945px) keep the 2000px copy. A video's stand-in is
// its poster.
const tileSrc = (item) => (item.img ? __sized(item.img, __photoSize()) : item.poster);

function makeMedia(item) {
  if (item.img) {
    const img = document.createElement("img");
    img.src = tileSrc(item);
    img.decoding = "async";
    img.alt = item.alt || "";
    return img;
  }
  const video = document.createElement("video");
  video.src = item.video;
  if (item.alt) video.setAttribute("aria-label", item.alt);
  video.poster = item.poster;
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "metadata";
  return video;
}

// Show media `index` of the current project, sized to the media's
// orientation once it has a frame. mode: "fade" crossfades over the old
// tile; "instant" lands with no transition (the photo is already on
// screen underneath); "wipe" is unmasked top-down (a new page's media).
async function showMedia(index, { mode = "fade", onShown } = {}) {
  const data = PROJECT_MEDIA[currentProject.dataset.project];
  if (!data || !data.media.length) return;
  currentIndex = (index + data.media.length) % data.media.length;
  strip.querySelectorAll(".strip__thumb").forEach((t, i) => {
    t.classList.toggle("is-current", i === currentIndex);
    t.setAttribute("aria-current", i === currentIndex ? "true" : "false");
  });
  const current = strip.querySelectorAll(".strip__thumb")[currentIndex];
  if (current) current.scrollIntoView({ block: "nearest", inline: "nearest" });

  const tile = document.createElement("figure");
  tile.className = "stage__tile";
  if (mode === "instant") tile.classList.add("stage__tile--instant");
  if (mode === "wipe" && !reduceMotion.matches) tile.classList.add("stage__tile--wipe");
  const media = makeMedia(data.media[currentIndex]);
  tile.appendChild(media);
  stageTile = tile;
  await Media.ready(media);
  if (stageTile !== tile) return; // superseded by a faster click
  const { width, height } = Media.size(media);
  tile.classList.toggle("stage__tile--wide", width && height ? width > height : data.media[currentIndex].o === "l");
  const old = [...stage.children]; // whatever is showing, however many steps ago
  stage.appendChild(tile);
  void tile.offsetWidth;
  tile.classList.add("is-in");
  if (onShown) onShown();
  if (media.tagName === "VIDEO") media.play().catch(() => {});
  old.forEach((el) => {
    el.classList.remove("is-in");
    setTimeout(() => el.remove(), FADE_MS);
  });
}

function buildStrip(data) {
  strip.replaceChildren();
  data.media.forEach((item, i) => {
    const thumb = document.createElement("button");
    thumb.type = "button";
    thumb.className = "strip__thumb";
    thumb.setAttribute("role", "listitem");
    thumb.setAttribute("aria-label", `Image ${i + 1} of ${data.media.length}`);
    thumb.style.setProperty("--i", i);
    thumb.classList.add("is-new");
    const img = document.createElement("img");
    img.src = mediaSrc(item);
    img.alt = "";
    thumb.appendChild(img);
    thumb.addEventListener("click", () => showMedia(i));
    strip.appendChild(thumb);
  });
}

// Let the new thumbs fade in, staggered by the entrance delays.
function revealStrip() {
  projectPanel.classList.add("is-entering");
  void strip.offsetWidth;
  strip.querySelectorAll(".strip__thumb.is-new").forEach((t) => t.classList.remove("is-new"));
  setTimeout(() => projectPanel.classList.remove("is-entering"), 1200);
}

// Put a project's content in place (header line, strip, empty stage);
// the page controller decides how it arrives.
// The header line's words for a project: name, year, NEXT's name.
function fillHeader(row) {
  const data = PROJECT_MEDIA[row.dataset.project];
  projectTitle.textContent = row.querySelector(".project__name").textContent;
  projectYear.textContent = (data && data.year) || "";
  const next = rows[(rows.indexOf(row) + 1) % rows.length];
  projectNextName.textContent = next.querySelector(".project__name").textContent;
  projectNext.href = __pathFor(`#${next.dataset.project}`);
  return next;
}

// NEXT, continued: the header turns over as the next project's photos
// arrive (at CONTINUE_TURN of the travel), not when the row has finally
// come to rest — a spring's last pixels take a while. The count starts on
// the first photo, which is where the row is landing.
const CONTINUE_TURN = 0.85;
function turnHeader(ctx) {
  ctx.headerTurned = true;
  fillHeader(ctx.row);
  const count = (PROJECT_MEDIA[ctx.row.dataset.project] || { media: [] }).media.length;
  projectPosition.textContent = `01 / ${String(count).padStart(2, "0")}`;
  headerMeta.classList.remove("is-sinking");
  headerMeta.classList.add("is-arriving", "is-early"); // shown while the page is still changing
  headerProject.classList.replace("is-turning", "is-turned");
  void headerMeta.offsetWidth;
  headerMeta.classList.replace("is-arriving", "is-entering");
  headerProject.classList.replace("is-turned", "is-turning-in");
  endSweep(headerMeta);
  setTimeout(() => headerProject.classList.remove("is-turning-in"), 1300);
}

function loadProject(row) {
  const data = PROJECT_MEDIA[row.dataset.project];
  currentProject = row;
  setActive(row); // the index underneath shows this project's set
  const next = fillHeader(row);
  // Warm NEXT once this page is in: its first photo (or a video's poster),
  // and with NEXT continued the rest of its first screen, decoded, so the
  // strip that brings them in is ready at once.
  const nextMedia = (PROJECT_MEDIA[next.dataset.project] || { media: [] }).media;
  const continuing = carouselOn() || feedOn(); // NEXT carries the next project in
  const warm = nextMedia.slice(0, continuing ? 4 : 1);
  setTimeout(() => warm.forEach((item) => {
    const img = new Image();
    img.src = tileSrc(item);
    if (continuing && img.decode) img.decode().catch(() => {});
  }), 1500);
  buildStrip(data || { media: [] });
  stage.replaceChildren();
  stageTile = null;
  strip.scrollTop = 0;
}

function unloadProject() {
  headerProject.hidden = true;
  headerMeta.hidden = true;
  [headerProject, headerMeta].forEach((el) => el.classList.remove("is-arriving", "is-entering", "is-sinking"));
  headerProject.classList.remove("is-turning", "is-turned", "is-turning-in");
  headerMeta.classList.remove("is-early");
  stage.replaceChildren();
  stageTile = null;
  strip.replaceChildren();
  currentProject = null;
}

rows.forEach((row) => {
  row.addEventListener("click", (e) => {
    e.preventDefault();
    if (!PROJECT_MEDIA[row.dataset.project]) return;
    closeSheets();
    goTo("project", { row, keep: targetPage === "index" });
    syncHash();
  });
});

projectBack.addEventListener("click", (e) => {
  e.preventDefault();
  goTo("index", { keep: true });
  syncHash();
});

projectNext.addEventListener("click", (e) => {
  e.preventDefault();
  const from = targetProject || currentProject;
  if (!from) return;
  const next = rows[(rows.indexOf(from) + 1) % rows.length];
  goTo("project", { row: next, continued: (carouselOn() && !!car) || feedOn() });
  syncHash();
});

const projectShowing = () => currentPage === "project" && !transitioning && currentProject;

document.addEventListener("keydown", (e) => {
  if (!projectShowing() || expandedPhoto || feedOn() || sheets.some(sheetOpen)) return; // the feed scrolls natively
  if (carouselOn()) {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") nudgeCarousel(1);
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") nudgeCarousel(-1);
    return;
  }
  if (e.key === "ArrowRight" || e.key === "ArrowDown") showMedia(currentIndex + 1);
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") showMedia(currentIndex - 1);
});

// Scrolling steps the media on desktop (down = next, up = previous):
// every WHEEL_STEP px of travel is one step, in either direction, with
// a short minimum gap so a fast flick still reads as a sequence. The
// event is consumed so the document never moves.
const WHEEL_STEP = 100; // px of travel per step
const WHEEL_GAP = 160;  // ms minimum between steps
let wheelTravel = 0;
let wheelLastStep = 0;
projectPanel.addEventListener("wheel", (e) => {
  if (feedOn() || !projectShowing()) return;
  e.preventDefault();
  if (carouselOn()) {
    // Either axis moves the row: a trackpad's sideways swipe or a wheel.
    // Wheels that report lines or pages are converted to pixels.
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? carouselEl.clientWidth : 1;
    pushCarousel((Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit);
    return;
  }
  wheelTravel += e.deltaY;
  if (Math.abs(wheelTravel) < WHEEL_STEP) return;
  const now = performance.now();
  if (now - wheelLastStep < WHEEL_GAP) return; // travel keeps counting
  showMedia(currentIndex + (wheelTravel > 0 ? 1 : -1));
  wheelTravel = 0;
  wheelLastStep = now;
}, { passive: false });

/* ---------- Project page: phone feed ----------
   Every photo of the project stacked full width at its own shape (a
   portrait 470:631, a landscape 945:631), 4px apart; the page scrolls
   through them and each fades in rising 24px as it arrives (the grid's
   reveal; the first screen staggered 70ms). Like the desktop row it never
   ends: nearing the end, the series is laid on again, and the header's
   count wraps with it. Videos play only while on screen. */
const feedEl = document.getElementById("project-feed");
let feedCleanup = () => {};

function buildFeed(row) {
  feedCleanup();
  const data = PROJECT_MEDIA[row.dataset.project];
  if (!data || !data.media.length) return;
  const n = data.media.length;
  const items = []; // every figure laid so far, in order
  const stops = []; // each pass's video watcher
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add("is-in");
    io.unobserve(en.target);
  }), { root: projectPanel, rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  const first = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add("is-in");
    first.unobserve(en.target);
  }), { root: projectPanel, rootMargin: "0px 0px 25% 0px" });

  // One more pass of the series.
  const lay = () => {
    const pass = document.createElement("div");
    pass.className = "feed__pass";
    data.media.forEach((item, i) => {
      const media = makeMedia(item);
      if (media.tagName === "VIDEO") {
        media.autoplay = false; // started while on screen
        media.preload = "metadata";
      } else if (items.length + i > 1) {
        media.loading = "lazy";
      }
      const fig = document.createElement("figure");
      fig.className = `feed__item feed__item--${item.o === "l" ? "l" : "p"}`;
      fig.appendChild(media);
      pass.appendChild(fig);
      items.push(fig);
      io.observe(fig);
    });
    feedEl.appendChild(pass);
    stops.push(Media.playWhenVisible(pass, projectPanel));
  };

  // The header line stays under the nav (styles.css); the first photo
  // starts 10px under it, where the header ends.
  const place = () => (projectPanel.style.paddingTop = `${document.querySelector(".header").getBoundingClientRect().bottom}px`);
  place();
  feedEl.style.transform = "";
  lay();
  projectPanel.scrollTop = 0;

  // Keep a screen and a half laid ahead; count the photo crossing 40% of
  // the screen's height, within its pass.
  const pad = (k) => String(k).padStart(2, "0");
  const update = () => {
    if (!feedOn()) return; // on its way out: the layout just changed
    while (projectPanel.scrollTop + projectPanel.clientHeight * 2.5 > projectPanel.scrollHeight) {
      const before = projectPanel.scrollHeight;
      lay();
      if (projectPanel.scrollHeight <= before) break; // nothing laid out: never loop on it
    }
    const line = window.innerHeight * 0.4;
    let at = 0;
    for (let i = 0; i < items.length && items[i].getBoundingClientRect().top <= line; i++) at = i;
    projectPosition.textContent = `${pad((at % n) + 1)} / ${pad(n)}`;
  };
  let frame = 0;
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(() => ((frame = 0), update()));
  };
  projectPanel.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", place);
  update();
  if (feedNext) {
    // Arriving under the column that brought these photos in: laid out of
    // sight, already in place, and shown when the column has landed.
    feedEl.classList.add("is-under");
    items.forEach((f) => f.classList.add("is-in", "is-settled"));
    const show = () => {
      feedEl.classList.remove("is-under");
      requestAnimationFrame(() => dropFeedNext());
    };
    if (feedNext.landed) show();
    else feedNext.onLanded = show;
  } else {
    // The first screen arrives staggered — every photo with any part on
    // screen, however little (the scroll-in line, 8% up, would leave one
    // peeking at the bottom blank), with a quarter screen to spare: iOS
    // Safari can measure the screen short of its floating toolbar while
    // photos still show under it. The rest arrive as they scroll in.
    let order = 0;
    items.forEach((f) => {
      const onScreen = f.getBoundingClientRect().top < window.innerHeight * 1.25;
      f.style.setProperty("--i", onScreen ? order++ : 0);
      if (onScreen) first.observe(f);
    });
  }
  feedCleanup = () => {
    io.disconnect();
    first.disconnect();
    stops.forEach((stop) => stop());
    cancelAnimationFrame(frame);
    projectPanel.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", place);
    projectPanel.style.removeProperty("padding-top");
    feedEl.replaceChildren();
    feedEl.style.transform = "";
    feedEl.classList.remove("is-under");
    feedCleanup = () => {};
  };
}

// NEXT on the phone feed: the vertical twin of the desktop NEXT. The next
// project's photos are laid just below the last photo on screen, in a
// column of their own over the feed, and everything glides up on a spring
// (the scroll's kind, its pull building over 0.35s) until the next
// project's first photo rests under the header line. The incoming photos
// arrive unfolded — each held down by UNFOLD of its distance below the
// outgoing project's last photo — and close up as they travel; the
// outgoing ones fold away upward. Once the outgoing photos have passed
// under the header the page arrives (NEXT works again) while the column
// lands; the next project's feed is laid underneath and shown as the
// column goes. Resolves on the hand-over.
const SPRING_FEED_NEXT = spring(1.0, 0);
let feedNext = null;
function dropFeedNext() {
  if (!feedNext) return;
  cancelAnimationFrame(feedNext.raf);
  feedNext.column.remove();
  feedEl.classList.remove("is-under");
  feedNext = null;
}

async function continueFeed(row, onArriving = () => {}) {
  const data = PROJECT_MEDIA[row.dataset.project];
  if (!data || !data.media.length) return;
  dropFeedNext();
  const H = window.innerHeight;
  const rest = document.querySelector(".header").getBoundingClientRect().bottom; // where the first photo rests
  const width = feedEl.getBoundingClientRect().width;
  // The outgoing photos on screen, and where the last of them ends.
  const figs = [...feedEl.querySelectorAll(".feed__item")];
  let edge = H;
  let lastHeight = 0;
  const outgoing = [];
  figs.forEach((f) => {
    const r = f.getBoundingClientRect();
    if (r.top < H && r.bottom > rest - H) outgoing.push({ f, top: r.top });
    if (r.top < H && r.bottom >= edge - 0.5) {
      edge = r.bottom;
      lastHeight = r.height;
    }
  });
  // Past the junction the feed's own next photos would show through the
  // incoming gaps: they go.
  figs.forEach((f) => {
    if (f.getBoundingClientRect().top >= edge - 0.5) f.style.visibility = "hidden";
  });
  // The incoming column: as much of the next project as fills a screen.
  const column = document.createElement("div");
  column.className = "feed__incoming";
  Object.assign(column.style, { width: `${width}px`, transform: `translate3d(0, ${H * 2}px, 0)` });
  const tiles = [];
  for (let i = 0, filled = 0; i === 0 || filled < H; i++) {
    const item = data.media[i % data.media.length];
    const media = makeMedia(item);
    if (media.tagName === "VIDEO") {
      media.autoplay = false;
      media.preload = "auto";
    }
    const fig = document.createElement("figure");
    fig.className = `feed__item feed__item--${item.o === "l" ? "l" : "p"} is-in is-settled`;
    fig.appendChild(media);
    column.appendChild(fig);
    tiles.push({ fig, media });
    filled += width * (item.o === "l" ? 631 / 945 : 631 / 470) + GUTTER;
  }
  projectPanel.appendChild(column);
  tiles.forEach((t) => (t.y = t.fig.offsetTop));
  const next = { column, tiles, raf: 0, onLanded: null };
  feedNext = next;
  await stripReady(tiles);
  if (feedNext !== next) return;
  const start = edge + GUTTER; // the incoming first photo, just below the last one
  const travel = start - rest;
  const from = lastHeight + GUTTER;
  let handed = false;
  const render = (y) => {
    const out = clamp01(y / travel);
    // Once handed over the feed is the next project's own: hands off.
    if (!handed) {
      feedEl.style.transform = `translate3d(0, ${(-y).toFixed(2)}px, 0)`;
      outgoing.forEach((o) => {
        const pull = UNFOLD * out * (edge + GUTTER - o.top);
        o.f.style.transform = pull > 0.01 ? `translate3d(0, ${(-pull).toFixed(2)}px, 0)` : "";
      });
    }
    column.style.transform = `translate3d(0, ${(start - y).toFixed(2)}px, 0)`;
    tiles.forEach((t) => {
      const hold = UNFOLD * (1 - out) * (from + t.y);
      t.fig.style.transform = hold > 0.01 ? `translate3d(0, ${hold.toFixed(2)}px, 0)` : "";
    });
    // The junction (the last outgoing photo, folded away) under the header?
    return edge - y - UNFOLD * out * from <= rest;
  };
  render(0);
  if (reduceMotion.matches) {
    render(travel);
    onArriving();
    next.landed = true; // buildFeed shows the feed straight away
    return;
  }
  return new Promise((resolve) => {
    let y = 0;
    let v = 0;
    let last = 0;
    let t0 = 0;
    const step = (now) => {
      if (feedNext !== next) return resolve();
      if (!t0) t0 = now;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const ramp = Math.min(1, (now - t0) / 350);
      const k = SPRING_FEED_NEXT.k * ramp * ramp * (3 - 2 * ramp) + 0.02;
      for (let left = dt; left > 1e-6; left -= 1 / 240) {
        const h = Math.min(1 / 240, left);
        v += (k * (travel - y) - SPRING_FEED_NEXT.c * v) * h;
        y += v * h;
      }
      const landed = (Math.abs(travel - y) < 0.5 && Math.abs(v) < 20) || now - t0 > 3000;
      if (landed) y = travel;
      const gone = render(y);
      if (!handed && (gone || landed)) {
        handed = true;
        onArriving();
        resolve(); // the page arrives: the next project's feed is laid under the column
      }
      if (landed) {
        next.raf = 0;
        if (next.onLanded) next.onLanded();
        else next.landed = true;
        return;
      }
      next.raf = requestAnimationFrame(step);
    };
    next.raf = requestAnimationFrame(step);
  });
}

/* ---------- Project page: carousel ----------
   The desktop project page (?project=stage brings back the filmstrip and
   single stage). The project runs as one row across the width at the
   gallery's height: a portrait is half the gallery, a landscape all of
   it, 4px apart — the index tiles' own sizes — repeated so it never ends.
   Opening from the index, the row starts with the first photo exactly on
   the index tile and glides left until it rests on column 1, the rest of
   the series sliding in from the right as if scrolled; opening any other
   way, the whole row slides in from the right. The wheel (either axis), a
   drag or the arrow keys move a target; the row glides after it. Each
   photo is a touch larger than its frame and drifts against the movement
   by its distance from the centre — the parallax. The header counts the
   photo at the start of the row. */
const CAROUSEL = new URLSearchParams(location.search).get("project") !== "stage";
const carouselOn = () => CAROUSEL && !phoneLayout.matches;
// On phones the project page is a vertical feed (see buildFeed).
const feedOn = () => phoneLayout.matches;
const carouselEl = document.getElementById("project-carousel");
const carouselTrack = carouselEl.querySelector(".carousel__track");
const projectPosition = document.getElementById("project-position");
// Motion. The row has mass: a spring pulls it toward its target with
// some velocity of its own, so a flick coasts and a drag's release speed
// carries on. Two numbers tune it: how long a scroll takes to settle (its
// weight) and how much it overshoots (0 = none). The opening is the same
// spring, softer, released from rest — any input mid-way just blends in.
const CAROUSEL_SETTLE = 0.6;      // s for a scroll to come within ~2% of rest
const CAROUSEL_BOUNCE = 0;        // 0 = no overshoot; 0.1–0.2 = a touch
const CAROUSEL_OPEN_SETTLE = 1.4; // the same, for the opening
const CAROUSEL_OPEN_RAMP = 0.5;   // s the opening's pull takes to build up, so it eases off the mark
// The way back is timed rather than a spring, so the
// page can promise its length: it always takes this long, from any photo.
const CAROUSEL_RETURN_MS = 1000;
const CAROUSEL_FLING = 0.28;      // s of the release speed a drag carries on for
// The unfold: in the opening the arriving series starts stretched out —
// the further a photo is behind the first, the wider its gap — and closes
// up as the row lands, so later photos visibly fall in after earlier ones.
const UNFOLD = 0.25;         // stretch at the start (0.25 = gaps widen by a quarter of the distance)
const UNFOLD_RELEASE = 0.3;  // s the stretch takes to ease out if the opening is interrupted
const CAROUSEL_DRIFT = 3;   // % of a tile's width a photo drifts near the screen's edge
const CAROUSEL_OVERSCALE = 0.08; // photos sit at 108% in their frames, room for the drift

// Stiffness and damping for a spring that comes within ~2% of rest in
// `settle` seconds.
function spring(settle, bounce) {
  const w = 5.8 / settle;
  return { k: w * w, c: 2 * Math.max(0.05, 1 - bounce) * w };
}
const SPRING_SCROLL = spring(CAROUSEL_SETTLE, CAROUSEL_BOUNCE);
const SPRING_OPEN = spring(CAROUSEL_OPEN_SETTLE, 0);
let car = null;

const mod = (n, m) => ((n % m) + m) % m;

// Builds the row and places it for its opening: the first photo starts on
// column 5 when it is carried over from the index (opts.keep), otherwise
// the whole row starts off to the right. glideCarousel() then brings it
// home — the first photo on column 1 — on the same follow as a scroll.
// The gallery's geometry inside the row: cols 5–12 of the 12-col grid.
// A portrait is half the gallery, a landscape all of it. Upright the gallery
// is one portrait, so a landscape is two, and a lone one is the whole row.
function carouselGeometry(data) {
  const col = (carouselEl.clientWidth - 11 * GUTTER) / 12;
  const galleryWidth = col * 8 + 7 * GUTTER;
  const wide = wideSingle(data);
  const anchor = wide ? 0 : col * 4 + 4 * GUTTER; // where it rests alone: column 5
  const portrait = uprightLayout.matches ? galleryWidth : (galleryWidth - GUTTER) / 2;
  const landscape = portrait * 2 + GUTTER;
  const widths = wide ? [carouselEl.clientWidth] : data.media.map((m) => (m.o === "l" ? landscape : portrait));
  const setWidth = widths.reduce((a, b) => a + b, 0) + GUTTER * widths.length;
  return { anchor, widths, setWidth, single: widths.length === 1 };
}

// A carousel tile for one item (a video waits for the row to start it,
// buffering meanwhile — see startCarouselVideos).
function carouselTile(item, width) {
  const tile = document.createElement("figure");
  tile.className = "carousel__tile";
  tile.style.width = `${width}px`;
  if (item.o === "l" && uprightLayout.matches && width === carouselEl.clientWidth) tile.style.height = `${(width * 631) / 945}px`; // its own shape, under the rule
  const media = makeMedia(item);
  media.draggable = false;
  if (media.tagName === "VIDEO") {
    media.autoplay = false;
    media.preload = "auto";
  }
  tile.appendChild(media);
  return { tile, media };
}

function buildCarousel(row, { keep = false, settled = false, handoff = null } = {}) {
  stopCarousel();
  const data = PROJECT_MEDIA[row.dataset.project];
  if (!data || !data.media.length) return;
  // A project of one photo or video isn't a row: it rests on cols 5–12,
  // where the index shows it, and holds still.
  const { anchor, widths, setWidth, single } = carouselGeometry(data);
  const copies = single ? 1 : Math.ceil(carouselEl.clientWidth / setWidth) + 2;
  const tiles = [];
  carouselTrack.replaceChildren();
  // Coming from the index, the row stays invisible (the index tiles show
  // through the see-through panel) until its photos are decoded.
  carouselEl.classList.toggle("is-waiting", keep);
  carouselEl.classList.toggle("is-single", single);
  for (let c = 0; c < copies; c++) {
    data.media.forEach((item, i) => {
      const { tile, media } = carouselTile(item, widths[i]);
      carouselTrack.appendChild(tile);
      tiles.push({ tile, media, index: i, left: 0, width: widths[i] });
    });
  }
  tiles.forEach((t) => (t.left = t.tile.offsetLeft));
  // Home puts the first photo at the row's left edge (column 1); a single
  // one on column 5, which it already holds coming from the index.
  const home = single ? -anchor : 0;
  const offset = reduceMotion.matches || settled || (single && keep) ? 0 : keep ? anchor : carouselEl.clientWidth;
  // Coming from the index, the photos already on screen keep their exact
  // places: the unfold is measured from the last of them, so the first one
  // to arrive from the right is the first to be held out.
  let held = 0;
  if (keep) {
    for (let i = 0; anchor + held + widths[i] + GUTTER < carouselEl.clientWidth; i++) held += widths[i] + GUTTER;
  }
  car = {
    setWidth, single, home, anchor, widths, x: home - offset, target: home - offset, v: 0, spring: SPRING_SCROLL,
    tiles, raf: 0, last: 0, count: data.media.length, step: widths[0] + GUTTER, at: -1,
    opening: offset > 0, unfold: offset > 0 && !reduceMotion.matches ? { amount: 1, from: offset, held, keep } : null,
    size: [carouselEl.clientWidth, carouselEl.clientHeight],
  };
  // Taking over a spring NEXT mid-motion: the row starts where the strip
  // that brought its photos in is, at its speed, unfolded as much, and
  // carries on to rest on the same spring; the strip rides along on top
  // until the row can paint.
  if (handoff) {
    const { remaining, v, d, strip } = handoff;
    Object.assign(car, {
      x: home - remaining, target: home, v, spring: SPRING_NEXT, opening: true, handedOff: true,
      unfold: { amount: remaining / d, from: d, held: -strip.from, keep: false },
      ghost: strip,
    });
    car.raf = requestAnimationFrame(runCarousel);
  }
  // A video handed over from the index plays on; one arriving from the
  // right shows its poster while it slides and starts as it lands.
  if (!car.opening || keep) startCarouselVideos();
  renderCarousel();
  if (keep) {
    // Pick a clip up where the index tile left it.
    const lead = tiles.find((t) => t.index === 0 && Math.abs(t.left - carouselPos(car.x) - anchor) < 1);
    const from = sets.get(row.dataset.project).querySelector("video");
    if (lead && from && lead.media.tagName === "VIDEO") lead.media.currentTime = from.currentTime;
  }
}

// Resolves when the photos that matter for the opening can paint: the
// ones on screen where the row starts and where it comes to rest (capped,
// so a slow file can't hold the page). Everything else decodes meanwhile.
function carouselReady() {
  if (!car) return Promise.resolve();
  const w = carouselEl.clientWidth;
  const onScreenAt = (x) => {
    const pos = carouselPos(x);
    return car.tiles.filter((t) => t.left - pos < w && t.left - pos + t.width > 0);
  };
  const key = new Set([...onScreenAt(car.x), ...onScreenAt(car.home)]);
  car.tiles.forEach((t) => key.has(t) || (t.media.decode && t.media.decode().catch(() => {})));
  // A video that isn't playing yet only needs its poster, not its first
  // frame (which can take a while to arrive).
  const ready = (m) => {
    if (m.tagName !== "VIDEO" || car.playing) return Media.ready(m, 900);
    const poster = new Image();
    poster.src = m.poster;
    return Media.ready(poster, 900);
  };
  return Promise.all([...key].map((t) => ready(t.media)));
}

// The opening: release the row toward home on the soft spring, and start
// the unfold's clock.
function glideCarousel() {
  if (!car) return;
  car.spring = SPRING_OPEN;
  car.target = car.home;
  car.v = 0;
  car.openAt = performance.now();
  if (!car.raf) car.raf = requestAnimationFrame(runCarousel);
}

// The way back: the row rewinds — to the right, back through the photos
// you've seen — until the first photo rests on column 5, the index tile
// it came from (a project still arriving carries on onto it instead). The unfold runs in reverse (the overscale
// and drift ease out with it), so the photos land exactly as the index
// shows them; the end of the series, which would cross the index's
// columns 1–4, fades. Resolves once the row has landed.
function returnCarousel() {
  if (!car) return Promise.resolve();
  const { anchor, setWidth } = car;
  // Head for the first photo's place on the tile (x = -anchor) the short
  // way, within a lap: scrolled forward, the row rewinds right; still
  // arriving from the right (NEXT, a link), it carries on left. A single
  // photo goes straight to its place.
  const ahead = car.x + anchor;
  const target = car.single ? car.home : ahead >= 0 ? car.x - mod(ahead, setWidth) : car.x + mod(-ahead, setWidth);
  const from = Math.abs(car.x - target);
  let held = 0; // the photos the index shows: a pair or one landscape
  for (let i = 0; anchor + held + car.widths[i] + GUTTER < carouselEl.clientWidth; i++) held += car.widths[i] + GUTTER;
  Object.assign(car, {
    opening: false, target,
    unfold: { amount: 0, from: Math.max(1, from), held, keep: true },
  });
  carouselEl.classList.add("is-returning");
  return new Promise((resolve) => {
    // A cubic from where the row is, at its current speed, to rest on the
    // tile: soft at both ends, exactly CAROUSEL_RETURN_MS long. Its clock
    // starts on the first frame.
    car.returning = { from: Math.max(1, from), done: resolve, x0: car.x, v0: car.v, t0: 0 };
    if (from < 0.5 || reduceMotion.matches) {
      car.x = target;
      car.v = 0;
      landCarousel();
    } else if (!car.raf) car.raf = requestAnimationFrame(runCarousel);
  });
}

// Landed: the photos are the index's; a clip hands its moment back to
// the index tile it came from.
function landCarousel() {
  const { done } = car.returning;
  car.returning = null;
  car.landed = true;
  car.unfold.amount = 1;
  renderCarousel();
  const lead = car.tiles.find((t) => t.index === 0 && Math.abs(t.left - carouselPos(car.x) - car.anchor) < 1);
  const to = currentProject && sets.get(currentProject.dataset.project).querySelector("video");
  if (lead && to && lead.media.tagName === "VIDEO") to.currentTime = lead.media.currentTime;
  done();
}

// NEXT, on desktop, keeps scrolling: the next project's photos are laid
// on straight after the last photo now on screen, in a strip of their own
// over the row, and the row glides on, on a spring like the scroll's,
// until the next project's first photo rests where its own page puts it
// (column 1; a single one on column 5, with columns 1–4 empty). The
// incoming project arrives unfolded and the outgoing one folds out as it
// leaves. As soon as the outgoing photos have left the screen the next
// project's row takes over mid-motion (see buildCarousel's handoff) and
// the page arrives, so NEXT works again at once. Resolves on hand-over.
let nextStrip = null;
const SPRING_NEXT = spring(1.0, 0);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// How far a photo is held out (incoming, +) or pulled ahead (outgoing, −)
// at this point of the glide; `dist` is its distance from the junction.
function nextShift(nx, dist, incoming) {
  const out = clamp01((car.x - nx.x0) / nx.d);
  return incoming ? UNFOLD * (1 - out) * dist : -UNFOLD * out * dist;
}
function dropNextStrip() {
  if (nextStrip) nextStrip.remove();
  nextStrip = null;
  if (car) car.ghost = null;
}

// Ready to paint: a photo decoded, a video's poster (it plays once the
// next project's own row takes over). Capped, so a slow file can't hold
// the page.
function stripReady(tiles, cap = 700) {
  return Promise.all(tiles.map(({ media }) => {
    if (media.tagName !== "VIDEO") return Media.ready(media, cap);
    const poster = new Image();
    poster.src = media.poster;
    return Media.ready(poster, cap);
  }));
}

async function continueCarousel(row, onArriving = () => {}, ctx = null) {
  const data = PROJECT_MEDIA[row.dataset.project];
  if (!car || !data || !data.media.length) return;
  // A strip still waiting to hand over (NEXT pressed twice): let the row
  // under it paint first, so dropping it shows no gap.
  if (nextStrip) await carouselReady();
  dropNextStrip();
  const row0 = car;
  if (!row0) return;
  const { anchor, widths, single } = carouselGeometry(data);
  const w = carouselEl.clientWidth;
  // The strip: as much of the next project as its page shows at rest,
  // parked out of sight until its photos can paint (warmed in advance by
  // loadProject, so this is usually instant).
  const strip = document.createElement("div");
  strip.className = "carousel__next";
  const track = document.createElement("div");
  track.className = "carousel__track";
  track.style.transform = `translate3d(${w * 3}px, 0, 0)`;
  strip.appendChild(track);
  const tiles = [];
  for (let i = 0, filled = 0; i === 0 || (!single && filled < w); i++) {
    const k = i % widths.length;
    const t = carouselTile(data.media[k], widths[k]);
    track.appendChild(t.tile);
    tiles.push({ ...t, width: widths[k], left: 0 });
    filled += widths[k] + GUTTER;
  }
  carouselEl.appendChild(strip);
  tiles.forEach((t) => (t.left = t.tile.offsetLeft));
  nextStrip = strip;
  await stripReady(tiles);
  if (car !== row0 || nextStrip !== strip) return;
  // Where the row's photos on screen end now, and how wide the last one is.
  const box = carouselEl.getBoundingClientRect();
  let edge = w;
  let lastWidth = 0;
  car.tiles.forEach((t) => {
    if (t.before) return;
    const r = t.tile.getBoundingClientRect();
    if (r.left - box.left < w && r.right - box.left > edge - 0.5) {
      edge = r.right - box.left;
      lastWidth = t.width;
    }
  });
  const travel = edge + GUTTER;
  const home = single ? anchor : 0;
  // The row's own speed carries on, but never backwards and never so fast
  // that the spring would overshoot the landing.
  car.v = Math.max(0, Math.min(2 * travel, car.v));
  // The outgoing row's videos hold their frame: a clip decoding while it
  // is carried across the screen costs the glide its smoothness.
  stopCarouselVideos();
  stopCarouselVideos = () => {};
  return new Promise((resolve) => {
    car.continuing = {
      t0: 0, x0: car.x, d: travel, done: resolve, onArriving, turned: false, ctx,
      // Past here the outgoing row is hidden: its next photos would show
      // through the incoming strip's gaps.
      cut: edge,
      // The unfold is measured from the outgoing project's last photo, so
      // the gap between the projects opens and closes too.
      strip: { track, tiles, start: travel + home, depth: single ? 0 : 1, from: lastWidth + GUTTER },
    };
    renderCarousel();
    renderNextStrip();
    if (reduceMotion.matches) {
      car.x += travel;
      renderCarousel();
      renderNextStrip();
      car.continuing = null;
      onArriving();
      resolve();
    } else if (!car.raf) car.raf = requestAnimationFrame(runCarousel);
  });
}

// The strip moves with the row and drifts the same way (a single photo,
// which never moves on its page, has no overscale or drift). It arrives
// unfolded, like an opening: each photo held out by a quarter (UNFOLD) of
// its distance behind the outgoing project's last photo, the stretch
// closing with the travel so it lands exactly.
function renderNextStrip() {
  const c = car.continuing;
  if (!c) return;
  const { track, tiles, start, depth, from } = c.strip;
  const travelled = car.x - c.x0;
  const x = start - travelled;
  track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
  const half = carouselEl.clientWidth / 2;
  const scale = (1 + CAROUSEL_OVERSCALE * depth).toFixed(4);
  tiles.forEach((t) => {
    const shift = nextShift(c, from + t.left, true);
    t.tile.style.transform = shift > 0.01 ? `translate3d(${shift.toFixed(2)}px, 0, 0)` : "";
    const centre = x + t.left + shift + t.width / 2;
    const drift = depth * Math.max(-1.2, Math.min(1.2, (centre - half) / half));
    t.media.style.transform = `translate3d(${(-drift * CAROUSEL_DRIFT).toFixed(3)}%, 0, 0) scale(${scale})`;
  });
}

// After a spring NEXT hands over, the strip keeps riding over the row in
// step (same place, unfold and parallax) until the row can paint.
function renderGhost() {
  const { track, tiles, depth, from } = car.ghost;
  const x = -car.x; // the row's first photo
  track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
  const half = carouselEl.clientWidth / 2;
  const scale = (1 + CAROUSEL_OVERSCALE * depth).toFixed(4);
  const amount = car.unfold ? car.unfold.amount : 0;
  tiles.forEach((t) => {
    const shift = UNFOLD * amount * (from + t.left);
    t.tile.style.transform = shift > 0.01 ? `translate3d(${shift.toFixed(2)}px, 0, 0)` : "";
    const centre = x + t.left + shift + t.width / 2;
    const drift = depth * Math.max(-1.2, Math.min(1.2, (centre - half) / half));
    t.media.style.transform = `translate3d(${(-drift * CAROUSEL_DRIFT).toFixed(3)}%, 0, 0) scale(${scale})`;
  });
}

// The track's offset for a row position: the row wraps, a single photo
// doesn't.
const carouselPos = (x) => (car.single ? x : mod(x, car.setWidth));

function renderCarousel() {
  const pos = carouselPos(car.x);
  carouselTrack.style.transform = `translate3d(${-pos}px, 0, 0)`;
  const w = carouselEl.clientWidth;
  const half = w / 2;
  // While opening, only the series from the arriving first photo onwards
  // shows: whatever would sit to its left (the end of the series) waits.
  // Going back, the series is read from the copy heading for column 5.
  const leadLeft = car.returning || car.landed ? car.anchor - (car.x - car.target) : -car.x;
  // NEXT, continued: the outgoing row ends where the incoming strip starts,
  // and folds out as it leaves — the mirror of the incoming unfold: each
  // photo pulled ahead by UNFOLD of its distance from the junction, growing
  // with the travel (the gap at the junction stays about the same, the
  // gaps behind it open as the ones ahead close).
  const nx = car.continuing;
  const cut = nx ? nx.cut - (car.x - nx.x0) - 0.5 : Infinity;
  const out = nx ? Math.max(0, Math.min(1, (car.x - nx.x0) / nx.d)) : 0;
  const ref = car.step / 2; // the counter follows the photo at the row's start
  let at = car.opening ? 0 : car.at; // arriving: the first photo
  // Handed over from the index, the photos start exactly as the index
  // shows them (100%, no drift); the overscale and the parallax grow in
  // with the row's travel, so nothing jumps.
  // A single photo never moves, so it has no overscale or drift at all —
  // unless it is leaving with NEXT, continued: then it eases into the
  // row's parallax over the first half of the travel.
  const leaving = Math.min(1, out / 0.5);
  const depth = car.landed ? 0
    : car.single ? leaving * leaving * (3 - 2 * leaving)
    : car.unfold && car.unfold.keep ? 1 - car.unfold.amount : 1;
  const scale = (1 + CAROUSEL_OVERSCALE * depth).toFixed(4);
  car.tiles.forEach((t) => {
    const left = t.left - pos;
    // Only photos at or near the screen are touched (the unfold only ever
    // pushes a photo further right, so one past the edge stays past it).
    if (left > w || left + t.width < -half) return;
    // The unfold: stretched by the distance behind the first photo (or the
    // last one handed over from the index).
    const u = car.unfold;
    let shift = u ? UNFOLD * u.amount * Math.max(0, left - leadLeft - u.held) : 0;
    if (nx && left < cut) shift += nextShift(nx, cut + GUTTER - left, false);
    const centre = left + shift + t.width / 2;
    // Capped so the drift (≤ 3.6%) stays inside the photo's 8% overscale.
    const drift = depth * Math.max(-1.2, Math.min(1.2, (centre - half) / half));
    const tileT = shift ? `translate3d(${shift.toFixed(2)}px, 0, 0)` : "";
    const mediaT = `translate3d(${(-drift * CAROUSEL_DRIFT).toFixed(3)}%, 0, 0) scale(${scale})`;
    if (t.tileT !== tileT) t.tile.style.transform = t.tileT = tileT;
    if (t.mediaT !== mediaT) t.media.style.transform = t.mediaT = mediaT;
    // Always a boolean: classList.toggle with an undefined force flips the
    // class instead of setting it.
    const before = (!!(car.opening || car.returning || car.landed) && left < leadLeft - 0.5) || left >= cut;
    if (t.before !== before) t.tile.classList.toggle("is-before", (t.before = before));
    if (!car.opening && left <= ref && left + t.width + GUTTER > ref) at = t.index;
  });
  if (car.ghost) renderGhost();
  if (at !== car.at && !nx) { // the outgoing count holds still as it turns over
    car.at = at;
    const pad = (n) => String(n).padStart(2, "0");
    projectPosition.textContent = `${pad(at + 1)} / ${pad(car.count)}`;
  }
}

function runCarousel(now) {
  if (!car) return;
  const dt = car.last ? Math.min(0.05, (now - car.last) / 1000) : 1 / 60;
  car.last = now;
  // The spring, in small fixed steps so it stays stable at any frame rate.
  let { k, c } = car.spring;
  if (car.spring === SPRING_OPEN) {
    // From rest a spring pulls hardest at once; the opening's pull builds
    // up instead (damping in step, so it stays just as smooth).
    const p = Math.min(1, (now - car.openAt) / 1000 / CAROUSEL_OPEN_RAMP);
    const ramp = Math.max(0.02, p * p * (3 - 2 * p));
    [k, c] = [k * ramp, c * Math.sqrt(ramp)];
  }
  const nx = car.continuing;
  if (nx) {
    // NEXT: the scroll's kind of spring, its pull building up over 0.35s.
    if (!nx.t0) nx.t0 = now;
    const elapsed = now - nx.t0;
    const target = nx.x0 + nx.d;
    const ramp = Math.min(1, elapsed / 350);
    const k = SPRING_NEXT.k * ramp * ramp * (3 - 2 * ramp) + 0.02;
    for (let left = dt; left > 1e-6; left -= 1 / 240) {
      const h = Math.min(1 / 240, left);
      car.v += (k * (target - car.x) - SPRING_NEXT.c * car.v) * h;
      car.x += car.v * h;
    }
    const landed = (Math.abs(target - car.x) < 0.5 && Math.abs(car.v) < 20) || elapsed > 3000;
    if (landed) {
      car.x = target;
      car.v = 0;
    }
    // Hand over as soon as the outgoing photos have left the screen (the
    // last one's right edge, pulled ahead by the fold, past the left edge):
    // the next project's row carries on with the same spring from here, so
    // the page arrives — and NEXT works again — without waiting for the
    // spring's last, slow pixels.
    const junction = nx.cut - (car.x - nx.x0);
    if (!landed && nx.ctx && junction - GUTTER + nextShift(nx, nx.strip.from, false) <= 0) {
      nx.ctx.handoff = { remaining: target - car.x, v: car.v, d: nx.d, strip: nx.strip };
      if (!nx.turned) {
        nx.turned = true;
        nx.onArriving();
      }
      renderCarousel();
      renderNextStrip();
      car.raf = 0;
      car.continuing = null;
      nx.done();
      return;
    }
    if (!nx.turned && (landed || (car.x - nx.x0) / nx.d >= CONTINUE_TURN)) {
      nx.turned = true;
      nx.onArriving();
    }
    renderCarousel();
    renderNextStrip();
    if (!landed) {
      car.raf = requestAnimationFrame(runCarousel);
    } else {
      car.raf = 0;
      car.continuing = null;
      nx.done();
    }
    return;
  }
  const r = car.returning;
  if (r) {
    // The way back: a cubic Hermite from (x0, v0) to (target, 0).
    if (!r.t0) r.t0 = now;
    const T = CAROUSEL_RETURN_MS / 1000;
    const p = Math.min(1, (now - r.t0) / CAROUSEL_RETURN_MS);
    const d = car.target - r.x0;
    car.x = r.x0 + d * (3 * p * p - 2 * p * p * p) + r.v0 * T * (p - 2 * p * p + p * p * p);
    car.v = (d * (6 * p - 6 * p * p) + r.v0 * T * (1 - 4 * p + 3 * p * p)) / T;
  } else {
    for (let left = dt; left > 1e-6; left -= 1 / 240) {
      const h = Math.min(1 / 240, left);
      car.v += (k * (car.target - car.x) - c * car.v) * h;
      car.x += car.v * h;
    }
  }
  const settled = r ? now - r.t0 >= CAROUSEL_RETURN_MS : Math.abs(car.target - car.x) < 0.05 && Math.abs(car.v) < 2;
  if (settled) {
    car.x = car.target;
    car.v = 0;
    car.opening = false;
  }
  if (!car.playing && (!car.opening || Math.abs(car.home - car.x) < 40)) startCarouselVideos();
  // The unfold closes with the row's travel home; interrupted, it eases out.
  const u = car.unfold;
  if (u && car.returning) {
    u.amount = Math.max(0, Math.min(1, 1 - Math.abs(car.target - car.x) / car.returning.from));
  } else if (u && !car.landed) {
    u.amount = car.opening
      ? Math.max(0, Math.min(1, (car.home - car.x) / u.from))
      : u.amount * Math.exp(-dt / UNFOLD_RELEASE);
    if (u.amount < 0.001) car.unfold = null;
  }
  if (settled && car.returning) {
    landCarousel();
    car.raf = 0;
    return;
  }
  renderCarousel();
  const moving = !car.landed && (!settled || !!car.unfold);
  car.raf = moving ? requestAnimationFrame(runCarousel) : 0;
  if (!moving) car.last = 0;
}

// Scrolling and keys move the target; the row follows on the spring.
// Input during the opening takes over from where the row is, at its
// current speed.
function pushCarousel(dx) {
  if (!car || car.single || car.returning || car.landed || car.continuing) return;
  car.spring = SPRING_SCROLL;
  car.opening = false;
  car.target += dx;
  if (!car.raf) car.raf = requestAnimationFrame(runCarousel);
}

// Arrow keys: one portrait tile's width.
function nudgeCarousel(dir) {
  if (car) pushCarousel(dir * car.step);
}

let stopCarouselVideos = () => {};
// Videos in the row play only while on screen.
function startCarouselVideos() {
  if (!car || car.playing) return;
  car.playing = true;
  stopCarouselVideos = Media.playWhenVisible(carouselTrack, carouselEl);
}

function stopCarousel() {
  if (car && car.raf) cancelAnimationFrame(car.raf);
  stopCarouselVideos();
  stopCarouselVideos = () => {};
  car = null;
  carouselEl.classList.remove("is-waiting", "is-returning");
  carouselTrack.replaceChildren();
  projectPosition.textContent = "";
}

// Drag: the row follows the pointer one to one; on release it keeps the
// pointer's speed and coasts on the spring to a stop.
let drag = null;
carouselEl.addEventListener("pointerdown", (e) => {
  if (!car || car.single || car.returning || car.landed || car.continuing || e.button !== 0) return;
  drag = { x: e.clientX, v: 0, t: performance.now() };
  carouselEl.setPointerCapture(e.pointerId);
  carouselEl.classList.add("is-dragging");
  car.spring = SPRING_SCROLL;
  car.opening = false;
  car.target = car.x;
  car.v = 0;
});
carouselEl.addEventListener("pointermove", (e) => {
  if (!drag || !car) return;
  const dx = drag.x - e.clientX;
  const now = performance.now();
  const dt = Math.max(1, now - drag.t) / 1000;
  drag.v = drag.v * 0.6 + (dx / dt) * 0.4; // px/s, smoothed
  [drag.x, drag.t] = [e.clientX, now];
  car.x += dx;
  car.target = car.x;
  car.v = 0;
  renderCarousel();
});
["pointerup", "pointercancel"].forEach((type) =>
  carouselEl.addEventListener(type, () => {
    if (!drag) return;
    // A pause before letting go means no fling; a hard flick carries about
    // a screen at most.
    const v = performance.now() - drag.t > 80 ? 0 : Math.max(-4000, Math.min(4000, drag.v));
    drag = null;
    carouselEl.classList.remove("is-dragging");
    if (!car) return;
    car.v = v;
    car.target = car.x + v * CAROUSEL_FLING;
    if (!car.raf) car.raf = requestAnimationFrame(runCarousel);
  })
);

// A real change of size rebuilds the row at rest (first photo on
// column 1); resize events that leave it the same size change nothing.
let carouselResize = 0;
window.addEventListener("resize", () => {
  clearTimeout(carouselResize);
  carouselResize = setTimeout(() => {
    if (!car || !currentProject || currentPage !== "project") return;
    if (car.returning || car.continuing) return; // a page change is waiting on it
    const [w, h] = car.size;
    if (carouselEl.clientWidth === w && carouselEl.clientHeight === h) return;
    buildCarousel(currentProject, { settled: true });
  }, 150);
});

let swipeStart = null;
stage.addEventListener("touchstart", (e) => {
  swipeStart = e.changedTouches[0];
}, { passive: true });
stage.addEventListener("touchend", (e) => {
  if (!swipeStart) return;
  const end = e.changedTouches[0];
  const dx = end.clientX - swipeStart.clientX;
  const dy = end.clientY - swipeStart.clientY;
  swipeStart = null;
  if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
  showMedia(currentIndex + (dx < 0 ? 1 : -1));
}, { passive: true });

/* ---------- Preloader ----------
   A frame half the size of the first tile, centred on the page
   horizontally and on the gallery vertically, cycles its photos with a
   top-down reveal, then grows onto the first tile. The tile is revealed
   under it the moment it lands, so the hand-off is invisible. */
const preloader = document.getElementById("preloader");
const frame = preloader && preloader.querySelector(".preloader__frame");
const PRELOAD_START = 200;  // ms before the first photo arrives
const PRELOAD_STEP = 380;   // ms between photos (shorter than the 0.7s clip, so they cascade)
const PRELOAD_SETTLE = 700; // ms for the last photo's clip to open before the expand
const PRELOAD_HOLD = 180;   // ms the last photo rests before expanding
const PRELOAD_EXPAND = 1200;
// With six photos: 200 + 5 × 310 + 450 = 2.2s from start to the last
// clip opening, then the hold, then the expand.

// The other projects' photos may hold their file in data-src, so they
// don't compete with the preloader's first photo.
// Starting during the cycle gives them its length to arrive before the
// first hover.
function loadWaitingPhotos() {
  gallery.querySelectorAll("img[data-src]").forEach((img) => {
    img.src = img.dataset.src;
    img.removeAttribute("data-src");
  });
}

// Each photo in its own clipped layer, revealed top-down while the photo
// zooms out (styles.css); the previous photo just sits underneath. New
// reveals start before the last zoom has settled. Resolves once the last
// photo's clip is open.
function runCycle(sources) {
  setTimeout(loadWaitingPhotos, PRELOAD_START + PRELOAD_STEP); // the first photo is on screen by then
  const layers = sources.map((src) => {
    const layer = document.createElement("div");
    layer.className = "preloader__layer";
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    layer.appendChild(img);
    return frame.appendChild(layer);
  });
  return new Promise((resolve) => {
    layers.forEach((layer, i) => {
      setTimeout(() => layer.classList.add("is-shown"), PRELOAD_START + i * PRELOAD_STEP);
    });
    setTimeout(resolve, PRELOAD_START + (layers.length - 1) * PRELOAD_STEP + PRELOAD_SETTLE);
  });
}

function firstTileRect() {
  // A first project with no media yet lands on the gallery's box.
  const set = defaultRow && sets.get(defaultRow.dataset.project);
  return ((set && set.querySelector(".tile")) || gallery).getBoundingClientRect();
}

// Where the frame cycles. Desktop and tablet: half the first tile,
// centred on the page across and on the gallery down. Phone: the first
// tile there is small and near the top, so the frame takes 42% of the
// width at the tile's ratio, centred on the screen, then glides up into
// the tile.
function frameRect() {
  const t = firstTileRect();
  let w, h, left, top;
  if (phoneLayout.matches) {
    w = window.innerWidth * 0.42;
    h = (w * t.height) / t.width;
    [left, top] = [(window.innerWidth - w) / 2, (window.innerHeight - h) / 2];
  } else {
    [w, h] = [t.width / 2, t.height / 2];
    [left, top] = [window.innerWidth / 2 - w / 2, t.top + t.height / 2 - h / 2];
  }
  return { left, top, width: w, height: h };
}

function placeFrame() {
  Object.assign(frame.style, rectFrame(frameRect()));
}

function runPreloader() {
  if (!preloader) return Promise.resolve();
  // The preloader lands on the index's first tile, so it only makes
  // sense for the index: a URL with a hash skips it and opens its page.
  if (reduceMotion.matches || __routeHash()) {
    preloader.remove();
    return Promise.resolve();
  }

  page.classList.add("is-preloading");
  placeFrame();
  window.addEventListener("resize", placeFrame);

  // The markup's images are only the source list; build the layers from it.
  const sources = Array.from(frame.querySelectorAll("img")).map((img) => img.getAttribute("src"));
  frame.replaceChildren();

  return runCycle(sources)
    .then(() => new Promise((r) => setTimeout(r, PRELOAD_HOLD)))
    .then(
      () =>
        new Promise((resolve) => {
          window.removeEventListener("resize", placeFrame);
          const grow = frame.animate([rectFrame(frame.getBoundingClientRect()), rectFrame(firstTileRect())], {
            duration: PRELOAD_EXPAND,
            easing: "cubic-bezier(0.65, 0, 0.35, 1)",
            fill: "forwards",
          });
          // A resize mid-grow re-aims it, from where the frame would cycle
          // now to where the tile now is, keeping its progress.
          const reaim = () => grow.effect.setKeyframes([rectFrame(frameRect()), rectFrame(firstTileRect())]);
          window.addEventListener("resize", reaim);
          grow.onfinish = () => {
            window.removeEventListener("resize", reaim);
            resolve();
          };
        })
    );
}

/* ---------- Entrance ----------
   Wait for the font and the preloader's images (capped so a slow network
   can't hold the page), run the preloader, then flip the class that lets
   the CSS transitions run. The count ticks up in the same window as
   INDEX rising. */
// Counts 0 → n on an ease-out: quick through the low numbers, slowing
// as it approaches the last one.
function tickCount(n, delay, duration) {
  const start = performance.now() + delay;
  count.textContent = "0";
  function step(now) {
    const t = Math.min(1, Math.max(0, (now - start) / duration));
    const eased = 1 - Math.pow(1 - t, 2.2);
    count.textContent = String(Math.round(eased * n));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function enter() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      loadWaitingPhotos(); // no preloader ran, if they're still waiting
      page.inert = false;
      page.classList.add("is-loaded");
      syncAutoplay();
      // The first tile is now visible under the frame; drop the frame on
      // the next paint.
      if (preloader) {
        requestAnimationFrame(() => {
          preloader.remove();
          page.classList.remove("is-preloading");
        });
      }
      if (reduceMotion.matches) {
        count.textContent = String(rows.length);
      } else {
        tickCount(rows.length, 1100, 900);
      }
      // Past the end of the longest transition (the main hairline).
      setTimeout(() => page.classList.remove("is-entering"), 3000);
      // A hash on the URL opens its page straight away (no preloader ran).
      if (__routeHash()) applyRoute({ direct: true });

      // Decode the other sets' images while idle so the first hover on a
      // project doesn't spend its opening frames decoding a JPEG.
      const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 400));
      idle(() => {
        sets.forEach((set) => {
          if (set.classList.contains("is-active")) return;
          set.querySelectorAll("img").forEach((img) => img.decode().catch(() => {}));
        });
      });
    });
  });
}

const firstMedia = Array.from(
  (defaultRow ? sets.get(defaultRow.dataset.project).querySelectorAll(Media.SELECTOR) : [])
).concat(frame ? Array.from(frame.querySelectorAll("img")) : []);
const ready = Promise.all([
  document.fonts.ready,
  ...firstMedia.map((el) => Media.ready(el)),
]);
Promise.race([ready, new Promise((r) => setTimeout(r, 2000))])
  .then(runPreloader)
  .then(enter);
