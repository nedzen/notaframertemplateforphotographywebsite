// Composition root. Creates the components, injects their services, then
// starts the entrance. Nothing below this file knows the app's wiring.

import { byId } from "./core/dom.js";
import { reduceMotion } from "./core/motion.js";
import {
  autoplayLayout,
  hoverInput,
  phoneLayout,
  touchLayout,
} from "./core/viewport.js";
import {
  PROJECT_MEDIA,
  count,
  defaultRow,
  gallery,
  gridPanel,
  hooks,
  list,
  page,
  prepareEntrance,
  projectOpen,
  projectPanel,
  rows,
  sets,
  state,
  syncMainTop,
  mainTop,
} from "./app/context.js";
import { pathFor, routeHash } from "./app/router.js";
import { createTransitions } from "./app/transitions.js";
import { initContactForm } from "./components/contact-form.js";
import { createGrid } from "./components/grid/index.js";
import { createIndexList } from "./components/index-list.js";
import { createPreloader } from "./components/preloader.js";
import {
  configureProject,
  initProjectPage,
  setProjectMedia,
} from "./components/project/index.js";
import { createSheets } from "./components/sheets.js";

prepareEntrance();
setProjectMedia(PROJECT_MEDIA);

const indexList = createIndexList({
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
  anySheetOpen: () => !!sheets.top(),
  projectOpen,
  goTo: (name, ctx) => transitions.goTo(name, ctx),
  syncHash: () => transitions.syncHash(),
});

const sheets = createSheets({
  items: [
    { panel: byId("about"), link: byId("nav-about"), hash: "#about" },
    { panel: byId("contact"), link: byId("nav-contact"), hash: "#contact" },
  ],
  onBeforeOpen: syncMainTop,
  onLayers: () => transitions.syncLayers(),
  onChange: () => transitions.syncCurrent(),
  afterClose: () => hooks.afterSheetClose(),
});

const grid = createGrid({
  root: gridPanel,
  photosRoot: byId("photos"),
  monoButton: byId("nav-mono"),
  isBlocked: () => !!sheets.top(),
  escape: false, // the page machine peels layers with Escape
  beforeReveal: syncMainTop,
  getHeaderHeight: mainTop,
});

[gridPanel, projectPanel].forEach((el) => (el.tabIndex = -1));

configureProject({
  rows,
  sets,
  state,
  setActive: (row) => indexList.setActive(row),
  closeSheets: () => sheets.closeAll(),
  isSheetOpen: () => !!sheets.top(),
  isLightboxOpen: () => grid.hasExpanded(),
  goTo: (name, ctx) => transitions.goTo(name, ctx),
  syncHash: () => transitions.syncHash(),
  pathFor,
});

initProjectPage();

const transitions = createTransitions({ grid, index: indexList, sheets });

initContactForm(byId("contact-form"));

const preloader = createPreloader({
  preloader: byId("preloader"),
  frame: document.querySelector(".preloader__frame"),
  page,
  gallery,
  sets,
  defaultRow,
  count,
  rows,
  reduceMotion,
  phoneLayout,
  routeHash,
  applyRoute: transitions.applyRoute,
  syncAutoplay: indexList.syncAutoplay,
});

preloader.start();
