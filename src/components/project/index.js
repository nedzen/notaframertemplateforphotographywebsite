// Public API of the project feature, split into page, feed and carousel.
//
// The app wires the feature with `configureProject({ rows, sets, state,
// setActive, closeSheets, isSheetOpen, isLightboxOpen, goTo, syncHash,
// pathFor })` and `setProjectMedia(window.__data.media)`.

export {
  getCurrentProject,
  initProjectPage,
  loadProject,
  unloadProject,
  showMedia,
  turnHeader,
  sweepHeaderLine,
  revealStrip,
  endSweep,
} from "./page.js";

export {
  buildFeed,
  continueFeed,
  dropFeedNext,
  cleanupFeed,
} from "./feed.js";

export {
  buildCarousel,
  carouselReady,
  glideCarousel,
  continueCarousel,
  returnCarousel,
  stopCarousel,
  dropNextStrip,
  pushCarousel,
  nudgeCarousel,
  car,
  nextStrip,
} from "./carousel.js";

export {
  carouselOn,
  feedOn,
  carouselEl,
  configureProject,
  setProjectMedia,
  projectMedia,
  projectEnv,
  pstate,
} from "./context.js";
