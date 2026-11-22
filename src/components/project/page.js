/* Project page: header, filmstrip, stage, keyboard/wheel and stage swipe. */

import { Media } from "../../core/media.js";
import { byId } from "../../core/dom.js";
import { durations } from "../../core/config.js";
import { reduceMotion } from "../../core/motion.js";
import {
  carouselEl,
  carouselOn,
  feedOn,
  makeMedia,
  mediaSrc,
  projectEnv,
  projectMedia,
  projectPanel,
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

const headerProject = byId("header-project");
const headerMeta = byId("header-meta");

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
  const data = projectMedia()[pstate.currentProject.dataset.project];
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
    setTimeout(() => el.remove(), durations.fade);
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
  const data = projectMedia()[row.dataset.project];
  const { rows, pathFor } = projectEnv();
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
  const count = (projectMedia()[ctx.row.dataset.project] || { media: [] }).media.length;
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
  const data = projectMedia()[row.dataset.project];
  pstate.currentProject = row;
  projectEnv().setActive(row); // the index underneath shows this project's set
  const next = fillHeader(row);
  // Warm NEXT once this page is in: its first photo (or a video's poster),
  // and with NEXT continued the rest of its first screen, decoded, so the
  // strip that brings them in is ready at once.
  const nextMedia = (projectMedia()[next.dataset.project] || { media: [] }).media;
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

// The app's composition root calls this once, after the injected services
// are configured. Every listener is tied to the returned lifetime.
export function initProjectPage() {
  const env = projectEnv();
  const { rows, state } = env;
  const controller = new AbortController();
  const on = (target, type, fn, options = {}) =>
    target.addEventListener(type, fn, { ...options, signal: controller.signal });

  rows.forEach((row) => {
    on(row, "click", (e) => {
      e.preventDefault();
      if (!projectMedia()[row.dataset.project]) return;
      env.closeSheets();
      env.goTo("project", { row, keep: state.targetPage === "index" });
      env.syncHash();
    });
  });

  on(projectBack, "click", (e) => {
    e.preventDefault();
    env.goTo("index", { keep: true });
    env.syncHash();
  });

  on(projectNext, "click", (e) => {
    e.preventDefault();
    const from = state.targetProject || pstate.currentProject;
    if (!from) return;
    const next = rows[(rows.indexOf(from) + 1) % rows.length];
    env.goTo("project", { row: next, continued: (carouselOn() && !!car) || feedOn() });
    env.syncHash();
  });

  const projectShowing = () =>
    state.currentPage === "project" && !state.transitioning && pstate.currentProject;

  on(document, "keydown", (e) => {
    if (!projectShowing() || env.isLightboxOpen() || feedOn() || env.isSheetOpen()) return; // the feed scrolls natively
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
  on(projectPanel, "wheel", (e) => {
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
  on(stage, "touchstart", (e) => {
    swipeStart = e.changedTouches[0];
  }, { passive: true });
  on(stage, "touchend", (e) => {
    if (!swipeStart) return;
    const end = e.changedTouches[0];
    const dx = end.clientX - swipeStart.clientX;
    const dy = end.clientY - swipeStart.clientY;
    swipeStart = null;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    showMedia(currentIndex + (dx < 0 ? 1 : -1));
  }, { passive: true });

  return { destroy: () => controller.abort() };
}

const getCurrentProject = () => pstate.currentProject;

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
