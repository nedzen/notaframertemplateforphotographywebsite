/* Public API of the project feature, split into page, feed and carousel. */

export {
  getCurrentProject,
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

export { carouselOn, feedOn, carouselEl } from "./context.js";
