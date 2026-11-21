/* Shared DOM, breakpoints, mutable app state and small utilities. */

export const page = document.querySelector(".page");
export const list = document.getElementById("projects");
export const gallery = document.getElementById("gallery");
export const count = document.getElementById("project-count");

export const rows = Array.from(list.querySelectorAll(".project"));
export const sets = new Map(
  Array.from(gallery.querySelectorAll(".gallery__set")).map((set) => [
    set.dataset.project,
    set,
  ])
);
export const defaultRow = rows[0];
export const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// Mark the page as entering right away so the entrance timings are in
// place before the first paint; each row gets its index for the stagger.
page.classList.add("is-entering");
page.inert = true;
rows.forEach((row, i) => {
  const set = sets.get(row.dataset.project);
  [row, set].forEach((el) => {
    if (!el) return;
    el.style.setProperty("--i", i);
  });
});

export const touchLayout = window.matchMedia("(max-width: 1100px)");
export const phoneLayout = window.matchMedia("(max-width: 600px)");
export const hoverInput = window.matchMedia("(hover: hover)");
// Where nothing can hover, one project shows at a time and the index moves
// on by itself (see Autoplay): the phone, and a tablet. A narrow window
// with a mouse keeps the desktop's hover.
export const autoplayLayout = () =>
  phoneLayout.matches || (touchLayout.matches && !hoverInput.matches);
// A tablet held upright has room for one photo at a time, on the index and
// on a project.
export const uprightLayout = window.matchMedia(
  "(min-width: 601px) and (max-width: 1100px) and (orientation: portrait)"
);
// Upright, a project of one landscape shows whole, across the whole row.
export const wideSingle = (data) =>
  uprightLayout.matches && data.media.length === 1 && data.media[0].o === "l";

export const navProjects = document.getElementById("nav-projects");
export const navGrid = document.getElementById("nav-grid");
export const mainArea = document.querySelector(".main");
export const gridPanel = document.getElementById("grid");
export const projectPanel = document.getElementById("project");
export const headerProject = document.getElementById("header-project");
export const headerMeta = document.getElementById("header-meta");
export const indexPanel = document.querySelector(".index");

export const state = {
  activeRow: null,
  indexShowing: true,
  currentPage: "index",
  targetPage: "index",
  targetProject: null,
  transitioning: false,
  currentProject: null,
};

// Navigation is wired by transitions.js; feature modules call through these
// hooks so they never need to import the page state machine directly.
export const hooks = {
  goTo: () => {},
  syncHash: () => {},
  syncCurrent: () => {},
  syncLayers: () => {},
  closeSheets: () => {},
  anySheetOpen: () => false,
  afterSheetClose: () => {},
};

export const projectOpen = () =>
  state.currentProject && !projectPanel.hidden;

export const PROJECT_MEDIA = window.__data.media;

export const MARGIN = 10; // page margin used by the lightbox and feed
export const GUTTER = 4; // 12-column gutter
export const FADE_MS = 450; // sheets: matches --dur-fade
export const EXIT_MS = 300; // pages: content leaving
export const HOLD_MS = 120; // pages: empty paper between leaving and arriving
export const SINK_MS = 500; // the project header line leaving, per word
export const SINK_STAGGER = 40; // per word, in reading order

export const wait = (ms) =>
  new Promise((resolve) => setTimeout(resolve, reduceMotion.matches ? 0 : ms));

export function tickCount(n, delay, duration) {
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

export const mainTop = () =>
  touchLayout.matches && !phoneLayout.matches
    ? document.querySelector(".header").offsetHeight
    : mainArea.offsetTop;

export function syncMainTop() {
  page.style.setProperty("--main-top", `${mainTop()}px`);
  page.style.setProperty("--line-drop", `${mainArea.offsetTop - mainTop()}px`);
}

window.addEventListener("resize", syncMainTop);

// Stiffness and damping for a spring that comes within ~2% of rest in
// `settle` seconds.
export function spring(settle, bounce) {
  const w = 5.8 / settle;
  return { k: w * w, c: 2 * Math.max(0.05, 1 - bounce) * w };
}

export const px = (n) => `${n}px`;
export const rectFrame = (r) => ({
  left: px(r.left),
  top: px(r.top),
  width: px(r.width),
  height: px(r.height),
});
