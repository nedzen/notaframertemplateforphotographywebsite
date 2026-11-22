// App-wide DOM references, mutable page state and the hooks the page
// machine publishes. Components never import this file: the composition
// root passes what they need.

import { qs, qsa, byId } from "../core/dom.js";
import { touchLayout, phoneLayout } from "../core/viewport.js";

export const page = qs(".page");
export const list = byId("projects");
export const gallery = byId("gallery");
export const count = byId("project-count");

export const rows = qsa(".project", list);
export const sets = new Map(
  qsa(".gallery__set", gallery).map((set) => [set.dataset.project, set])
);
export const defaultRow = rows[0];

export const navProjects = byId("nav-projects");
export const navGrid = byId("nav-grid");
export const mainArea = qs(".main");
export const gridPanel = byId("grid");
export const projectPanel = byId("project");
export const header = qs(".header");
export const headerProject = byId("header-project");
export const headerMeta = byId("header-meta");
export const indexPanel = qs(".index");

export const PROJECT_MEDIA = window.__data.media;

export const state = {
  activeRow: null,
  indexShowing: true,
  currentPage: "index",
  targetPage: "index",
  targetProject: null,
  transitioning: false,
  currentProject: null,
};

// Navigation is wired by the page machine; feature modules call through
// these hooks so they never need to import transitions directly.
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

// The entrance starts before the first paint: the page is inert and every
// row knows its stagger index.
export function prepareEntrance() {
  page.classList.add("is-entering");
  page.inert = true;
  rows.forEach((row, i) => {
    const set = sets.get(row.dataset.project);
    [row, set].forEach((el) => {
      if (!el) return;
      el.style.setProperty("--i", i);
    });
  });
}

export const mainTop = () =>
  touchLayout.matches && !phoneLayout.matches
    ? header.offsetHeight
    : mainArea.offsetTop;

export function syncMainTop() {
  page.style.setProperty("--main-top", `${mainTop()}px`);
  page.style.setProperty("--line-drop", `${mainArea.offsetTop - mainTop()}px`);
}

window.addEventListener("resize", syncMainTop);
