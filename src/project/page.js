/* Project page: header, filmstrip, stage, keyboard/wheel and stage swipe. */

import { Media } from "../media.js";
import {
  FADE_MS,
  headerMeta,
  headerProject,
  hooks,
  projectPanel,
  reduceMotion,
  rows,
  state,
} from "../layout.js";
import { setActive } from "../index.js";
import { closeSheets, sheetOpen, sheets } from "../sheets.js";
import { hasExpandedPhoto } from "../grid.js";
import { pathFor } from "../router.js";
import {
  PROJECT_MEDIA,
  carouselEl,
  carouselOn,
  feedOn,
  makeMedia,
  mediaSrc,
  projectPosition,
  pstate,
  stage,
  strip,
  tileSrc,
} from "./context.js";
import {
  car,
  nudgeCarousel,
  pushCarousel,
} from "./carousel.js";

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

/* ---------- Project page ----------
   Opened by an index row. Builds the filmstrip from #project-media,
   shows one media at a time on the stage (a portrait in the left half
   tile, a landscape across the full width), NEXT steps to the next
   project, arrow keys step the media. */
const projectTitle = document.getElementById("project-title");
const projectYear = document.getElementById("project-year");
const projectNext = document.getElementById("project-next");
const projectNextName = document.getElementById("project-next-name");
const projectBack = document.getElementById("project-back");
let currentIndex = 0;
let stageTile = null;

// Show media `index` of the current project, sized to the media's
// orientation once it has a frame. mode: "fade" crossfades over the old
// tile; "instant" lands with no transition (the photo is already on
// screen underneath); "wipe" is unmasked top-down (a new page's media).
async function showMedia(index, { mode = "fade", onShown } = {}) {
  const data = PROJECT_MEDIA[pstate.currentProject.dataset.project];
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
  projectNext.href = pathFor(`#${next.dataset.project}`);
  return next;
}

// NEXT, continued: the header turns over as the next project's photos
// arrive (at CONTINUE_TURN of the travel), not when the row has finally
// come to rest — a spring's last pixels take a while. The count starts on
// the first photo, which is where the row is landing.
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
  pstate.currentProject = row;
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
  pstate.currentProject = null;
}

rows.forEach((row) => {
  row.addEventListener("click", (e) => {
    e.preventDefault();
    if (!PROJECT_MEDIA[row.dataset.project]) return;
    closeSheets();
    hooks.goTo("project", { row, keep: state.targetPage === "index" });
    hooks.syncHash();
  });
});

projectBack.addEventListener("click", (e) => {
  e.preventDefault();
  hooks.goTo("index", { keep: true });
  hooks.syncHash();
});

projectNext.addEventListener("click", (e) => {
  e.preventDefault();
  const from = state.targetProject || pstate.currentProject;
  if (!from) return;
  const next = rows[(rows.indexOf(from) + 1) % rows.length];
  hooks.goTo("project", { row: next, continued: (carouselOn() && !!car) || feedOn() });
  hooks.syncHash();
});

const projectShowing = () => state.currentPage === "project" && !state.transitioning && pstate.currentProject;

document.addEventListener("keydown", (e) => {
  if (!projectShowing() || hasExpandedPhoto() || feedOn() || sheets.some(sheetOpen)) return; // the feed scrolls natively
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


export {
  getCurrentProject,
  loadProject,
  unloadProject,
  showMedia,
  turnHeader,
  sweepHeaderLine,
  revealStrip,
  endSweep,
};

const getCurrentProject = () => pstate.currentProject;
